import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { privateKeyToAccount } from "viem/accounts";
import { hashTypedData } from "viem";
import { decodeJwt, SignJWT } from "jose";
import {
  AuthChallengeResponseSchema,
  AuthTokensSchema,
  SessionViewSchema,
  ApiErrorSchema,
  buildTypedData,
  hashDigest,
  loginDomain,
  recoverSigner,
} from "@mandate/schema";
import {
  discoverMigrations,
  runMigrations,
} from "../../../../packages/platform/src/migrations.js";
import fixture from "../../../../packages/schema/fixtures/login-v7.json";
import { createApi } from "../../src/app.js";

// Public Anvil fixture keys only; these accounts must never hold live funds.
const owner = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const other = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const deviceId = "0x" + "de".repeat(32);
const config = {
  origin: "https://api.mandate.example",
  issuer: "https://api.mandate.example",
  audience: "mandate-owner-api",
  signingKey: new Uint8Array(32).fill(7),
};
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "TEST_DATABASE_URL required; real database acceptance cannot be skipped",
  );
const caPath = process.env.TEST_DATABASE_CA;
if (!caPath) throw new Error("TEST_DATABASE_CA required");
const ca = await readFile(caPath, "utf8");
const base = {
  connectionString: url,
  max: 8,
  connectionTimeoutMillis: 3000,
  ssl: { ca, rejectUnauthorized: true },
};
const admin = new Pool(base);

type Environment = Awaited<ReturnType<typeof environment>>;
async function environment(trustedProxyAddresses?: string[]) {
  const schema = "auth_" + randomBytes(8).toString("hex");
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ ...base, options: "-c search_path=" + schema });
  const client = await pool.connect();
  try {
    const migrations = await discoverMigrations(
      new URL("../../migrations", import.meta.url).pathname,
    );
    assert.equal(
      (await runMigrations(client, migrations, { schema })).applied.length,
      migrations.length,
    );
    assert.equal(migrations.length, 6);
    assert.equal(
      (await runMigrations(client, migrations, { schema })).applied.length,
      0,
    );
  } finally {
    client.release();
  }
  let now = 1793000000;
  const app = await createApi({
    database: pool,
    auth: config,
    clock: () => now,
    logger: false,
    ...(trustedProxyAddresses ? { trustedProxyAddresses } : {}),
  });
  const challenge = async (account = owner) => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/challenge",
      payload: { ownerAddress: account.address, deviceId },
    });
    assert.equal(response.statusCode, 200, response.body);
    return AuthChallengeResponseSchema.parse(response.json());
  };
  const signature = (
    data: Awaited<ReturnType<typeof challenge>>,
    account = owner,
  ) =>
    account.signTypedData(
      buildTypedData("Login", data.typedData.message, data.typedData.domain),
    );
  const login = async (account = owner) => {
    const data = await challenge(account);
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/verify",
      payload: {
        challengeId: data.challengeId,
        signature: await signature(data, account),
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    return AuthTokensSchema.parse(response.json());
  };
  const get = (accessToken: string) =>
    app.inject({
      url: "/v1/auth/sessions",
      headers: { authorization: "Bearer " + accessToken },
    });
  const refresh = (tokens: { sessionId: string; refreshToken: string }) =>
    app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: {
        sessionId: tokens.sessionId,
        refreshToken: tokens.refreshToken,
      },
    });
  const revoke = (
    accessToken: string,
    sessionIds: string[] | "ALL",
    key = randomUUID(),
  ) =>
    app.inject({
      method: "POST",
      url: "/v1/auth/sessions/revoke",
      headers: {
        authorization: "Bearer " + accessToken,
        "idempotency-key": key,
      },
      payload: { sessionIds },
    });
  return {
    app,
    pool,
    challenge,
    signature,
    login,
    get,
    refresh,
    revoke,
    advance: (seconds: number) => {
      now += seconds;
    },
    now: () => now,
    close: async () => {
      await app.close();
      if (!pool.ended) await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    },
  };
}
async function withDatabase(
  run: (env: Environment) => Promise<void>,
  trustedProxyAddresses?: string[],
) {
  const env = await environment(trustedProxyAddresses);
  try {
    await run(env);
  } finally {
    await env.close();
  }
}

test("P2-M0 fixture: shared Login2 digest and recovered owner match API consumer", async () => {
  const value = fixture.valid[0];
  assert.ok(value);
  assert.equal(hashDigest("Login", value.message, value.domain), value.digest);
  assert.equal(
    hashTypedData(buildTypedData("Login", value.message, value.domain)),
    value.digest,
  );
  assert.equal(
    (
      await recoverSigner(
        "Login",
        value.message,
        value.domain,
        await owner.signTypedData(
          buildTypedData("Login", value.message, value.domain),
        ),
      )
    ).toLowerCase(),
    owner.address.toLowerCase(),
  );
});

test("P2-W01.T01 exact Login2 succeeds once, challenge consumption races create one session", () =>
  withDatabase(async (e) => {
    const data = await e.challenge();
    assert.equal(data.typedData.message.origin, config.origin);
    assert.deepEqual(data.typedData.domain, loginDomain());
    assert.equal(
      Number(data.typedData.message.expiresAt) -
        Number(data.typedData.message.issuedAt),
      300,
    );
    const signed = await e.signature(data);
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        e.app.inject({
          method: "POST",
          url: "/v1/auth/verify",
          payload: { challengeId: data.challengeId, signature: signed },
        }),
      ),
    );
    assert.equal(responses.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(responses.filter((r) => r.statusCode === 401).length, 7);
    assert.equal(
      (
        await e.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM owner_sessions",
        )
      ).rows[0]?.n,
      1,
    );
    const success = responses.find((r) => r.statusCode === 200);
    assert.ok(success);
    const tokens = AuthTokensSchema.parse(success.json());
    const claims = decodeJwt(tokens.accessToken);
    assert.equal(claims.auth_time, e.now());
    assert.equal(claims.exp! - claims.iat!, 900);
    assert.equal(claims.aud, config.audience);
    assert.equal(Buffer.from(tokens.refreshToken, "base64url").byteLength, 32);
    const persisted = JSON.stringify(
      (await e.pool.query("SELECT * FROM refresh_tokens")).rows,
    );
    assert.ok(!persisted.includes(tokens.refreshToken));
    assert.ok(
      persisted.includes(
        createHash("sha256").update(tokens.refreshToken).digest("hex"),
      ),
    );
  }));

test("P2-W01.T01 signed origin/device/domain/owner mutations, unknown fields and expiry reject", () =>
  withDatabase(async (e) => {
    const data = await e.challenge();
    for (const [message, domain, account] of [
      [
        { ...data.typedData.message, origin: "https://evil.example" },
        data.typedData.domain,
        owner,
      ],
      [
        { ...data.typedData.message, deviceId: "0x" + "ff".repeat(32) },
        data.typedData.domain,
        owner,
      ],
      [data.typedData.message, data.typedData.domain, other],
    ] as const) {
      const signature = await account.signTypedData(
        buildTypedData("Login", message, domain),
      );
      assert.equal(
        (
          await e.app.inject({
            method: "POST",
            url: "/v1/auth/verify",
            payload: { challengeId: data.challengeId, signature },
          })
        ).statusCode,
        401,
      );
    }
    const wrongDomain = { ...data.typedData.domain, chainId: 1 };
    const badSignature = await owner.signTypedData({
      ...buildTypedData("Login", data.typedData.message, data.typedData.domain),
      domain: wrongDomain,
    });
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/verify",
          payload: { challengeId: data.challengeId, signature: badSignature },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/verify",
          payload: {
            challengeId: data.challengeId,
            signature: await e.signature(data),
            ownerAddress: other.address,
          },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/challenge",
          headers: { origin: "https://evil.example" },
          payload: { ownerAddress: owner.address, deviceId },
        })
      ).statusCode,
      401,
    );
    e.advance(300);
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/verify",
          payload: {
            challengeId: data.challengeId,
            signature: await e.signature(data),
          },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await e.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM owner_sessions",
        )
      ).rows[0]?.n,
      0,
    );
  }));

test("P2-M0 challenge bounds: canonical validator, rate cap, nonce entropy and request size", () =>
  withDatabase(async (e) => {
    const a = await e.challenge();
    const b = await e.challenge();
    assert.notEqual(a.typedData.message.nonce, b.typedData.message.nonce);
    assert.notEqual(a.challengeId, b.challengeId);
    for (const payload of [
      { ownerAddress: owner.address, deviceId, typedData: {} },
      { ownerAddress: "bad", deviceId },
      { ownerAddress: owner.address, deviceId: "short" },
    ])
      assert.equal(
        (
          await e.app.inject({
            method: "POST",
            url: "/v1/auth/challenge",
            payload,
          })
        ).statusCode,
        422,
      );
    for (let i = 0; i < 8; i++) await e.challenge();
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/challenge",
          payload: { ownerAddress: owner.address, deviceId },
        })
      ).statusCode,
      429,
    );
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/challenge",
          payload: { data: "x".repeat(10000) },
        })
      ).statusCode,
      413,
    );
  }));

test("P2-W01.T02 rotation races revoke family, including the winning JWT; random tokens cannot revoke", () =>
  withDatabase(async (e) => {
    const tokens = await e.login();
    assert.equal(
      (await e.refresh({ ...tokens, refreshToken: "x".repeat(43) })).statusCode,
      401,
    );
    assert.equal((await e.get(tokens.accessToken)).statusCode, 200);
    const [a, b] = await Promise.all([e.refresh(tokens), e.refresh(tokens)]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 401]);
    const winner = AuthTokensSchema.parse(
      (a.statusCode === 200 ? a : b).json(),
    );
    assert.notEqual(winner.refreshToken, tokens.refreshToken);
    assert.equal((await e.get(tokens.accessToken)).statusCode, 401);
    assert.equal((await e.get(winner.accessToken)).statusCode, 401);
    assert.equal((await e.refresh(winner)).statusCode, 401);
    assert.ok(
      (
        await e.pool.query<{ revoked_at: string | null }>(
          "SELECT revoked_at FROM refresh_token_families",
        )
      ).rows[0]?.revoked_at,
    );
    const newLogin = await e.login();
    assert.notEqual(newLogin.sessionId, tokens.sessionId);
    assert.equal((await e.get(newLogin.accessToken)).statusCode, 200);
  }));

test("P2-W01.T02 sequential used-token replay revocation commits before its 401 response", () =>
  withDatabase(async (e) => {
    const tokens = await e.login();
    const result = await e.refresh(tokens);
    assert.equal(result.statusCode, 200);
    const rotated = AuthTokensSchema.parse(result.json());
    assert.equal((await e.get(rotated.accessToken)).statusCode, 200);
    assert.equal((await e.refresh(tokens)).statusCode, 401);
    assert.equal((await e.get(rotated.accessToken)).statusCode, 401);
  }));

test("P2-W01.T03 seven-day idle and thirty-day absolute limits survive refresh", () =>
  withDatabase(async (e) => {
    const idle = await e.login();
    e.advance(604800);
    assert.equal((await e.refresh(idle)).statusCode, 401);
    let tokens = await e.login();
    const created = e.now();
    for (let i = 0; i < 5; i++) {
      e.advance(6 * 86400);
      const result = await e.refresh(tokens);
      if (i === 4) {
        assert.equal(e.now() - created, 2592000);
        assert.equal(result.statusCode, 401);
        break;
      }
      assert.equal(result.statusCode, 200, result.body);
      tokens = AuthTokensSchema.parse(result.json());
      assert.equal(decodeJwt(tokens.accessToken).auth_time, created);
      assert.ok(Number(tokens.refreshExpiresAt) <= created + 2592000);
    }
  }));

test("P2-W01.T04 fresh refresh preserves original auth_time and cannot revoke other/all sessions", () =>
  withDatabase(async (e) => {
    const first = await e.login();
    const second = await e.login();
    e.advance(301);
    const tokens = AuthTokensSchema.parse((await e.refresh(first)).json());
    assert.equal(decodeJwt(tokens.accessToken).auth_time, e.now() - 301);
    for (const ids of ["ALL", [second.sessionId]] as const) {
      const response = await e.revoke(
        tokens.accessToken,
        typeof ids === "string" ? ids : [...ids],
      );
      assert.equal(response.statusCode, 401);
      assert.equal(
        ApiErrorSchema.parse(response.json()).code,
        "REAUTH_REQUIRED",
      );
    }
    assert.equal((await e.get(second.accessToken)).statusCode, 200);
    const fresh = await e.login();
    assert.equal(
      (await e.revoke(fresh.accessToken, [second.sessionId])).statusCode,
      200,
    );
    assert.equal((await e.get(second.accessToken)).statusCode, 401);
  }));

test("P2-W01.T05 JWT expiry, signature, audience, issuer, algorithm, type and DB identity are checked", () =>
  withDatabase(async (e) => {
    const tokens = await e.login();
    const payload = decodeJwt(tokens.accessToken);
    for (const changes of [
      { aud: "agent" },
      { iss: "https://evil.example" },
      { sub: other.address.toLowerCase() },
      { auth_time: e.now() + 1 },
      { ownerAddress: other.address },
      { deviceId: "0x" + "ab".repeat(32) },
      { kind: "agent" },
      { sessionId: randomUUID() },
    ]) {
      const token = await new SignJWT({ ...payload, ...changes })
        .setProtectedHeader({ alg: "HS256", typ: "owner+jwt" })
        .sign(config.signingKey);
      assert.equal((await e.get(token)).statusCode, 401);
    }
    for (const [alg, typ, key] of [
      ["HS384", "owner+jwt", new Uint8Array(48).fill(7)],
      ["HS256", "JWT", config.signingKey],
      ["HS256", "owner+jwt", new Uint8Array(32).fill(8)],
    ] as const) {
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg, typ })
        .sign(key);
      assert.equal((await e.get(token)).statusCode, 401);
    }
    assert.equal((await e.get("agent-opaque-token")).statusCode, 401);
    assert.equal(
      (await e.app.inject({ url: "/v1/auth/sessions" })).statusCode,
      401,
    );
    e.advance(900);
    assert.equal((await e.get(tokens.accessToken)).statusCode, 401);
    const fresh = AuthTokensSchema.parse((await e.refresh(tokens)).json());
    await e.pool.end();
    const down = await e.get(fresh.accessToken);
    assert.equal(down.statusCode, 503);
    assert.equal(ApiErrorSchema.parse(down.json()).retryable, true);
    assert.ok(!down.body.includes("pool"));
    assert.equal((await e.app.inject({ url: "/healthz" })).statusCode, 200);
  }));

test("P2-W01.T06 logout only revokes current API session and cannot replay cached authorization", () =>
  withDatabase(async (e) => {
    const a = await e.login();
    const b = await e.login();
    const headers = {
      authorization: "Bearer " + a.accessToken,
      "idempotency-key": randomUUID(),
    };
    const input = {
      method: "POST",
      url: "/v1/auth/logout",
      headers,
      payload: {},
    } as const;
    assert.equal((await e.app.inject(input)).statusCode, 200);
    assert.equal((await e.app.inject(input)).statusCode, 401);
    assert.equal((await e.get(a.accessToken)).statusCode, 401);
    assert.equal((await e.refresh(a)).statusCode, 401);
    assert.equal((await e.get(b.accessToken)).statusCode, 200);
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/admin/stop",
          headers,
          payload: {},
        })
      ).statusCode,
      501,
    );
    assert.equal((await e.app.inject({ url: "/readyz" })).statusCode, 503);
    assert.equal(
      (
        await e.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM owner_identities",
        )
      ).rows[0]?.n,
      1,
    );
  }));

test("P2-W01.T07 sessions are isolated by owner despite reused deviceId, revoke rejects foreign IDs atomically", () =>
  withDatabase(async (e) => {
    const a = await e.login();
    const b = await e.login(other);
    const c = await e.login();
    const list = await e.get(a.accessToken);
    const body: unknown = list.json();
    assert.ok(
      body &&
        typeof body === "object" &&
        "items" in body &&
        Array.isArray(body.items),
    );
    const items = body.items.map((item: unknown) =>
      SessionViewSchema.parse(item),
    );
    assert.equal(items.length, 2);
    assert.ok(items.every((s) => s.deviceId === deviceId));
    assert.deepEqual(
      items.filter((s) => s.current).map((s) => s.sessionId),
      [a.sessionId],
    );
    assert.equal(
      (await e.revoke(a.accessToken, [b.sessionId, c.sessionId])).statusCode,
      403,
    );
    assert.equal((await e.get(c.accessToken)).statusCode, 200);
    assert.equal(
      (
        await e.refresh({
          sessionId: b.sessionId,
          refreshToken: a.refreshToken,
        })
      ).statusCode,
      401,
    );
    assert.equal((await e.get(b.accessToken)).statusCode, 200);
    assert.equal((await e.revoke(a.accessToken, "ALL")).statusCode, 200);
    assert.equal((await e.get(a.accessToken)).statusCode, 401);
    assert.equal((await e.get(c.accessToken)).statusCode, 401);
    assert.equal((await e.get(b.accessToken)).statusCode, 200);
  }));

test("P2-03.T01 authenticated UUID idempotency serializes twenty mutations and rejects changed bodies", () =>
  withDatabase(async (e) => {
    const a = await e.login();
    const b = await e.login();
    const c = await e.login();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        e.revoke(a.accessToken, [b.sessionId], key),
      ),
    );
    assert.ok(
      results.every((r) => r.statusCode === 200 && r.body === results[0]?.body),
    );
    assert.equal(
      (
        await e.pool.query<{ n: number }>(
          "SELECT count(*)::int n FROM auth_idempotency",
        )
      ).rows[0]?.n,
      1,
    );
    assert.equal(
      (await e.revoke(a.accessToken, [c.sessionId], key)).statusCode,
      409,
    );
    assert.equal((await e.get(c.accessToken)).statusCode, 200);
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/logout",
          headers: { authorization: "Bearer " + a.accessToken },
          payload: {},
        })
      ).statusCode,
      422,
    );
    await e.revoke(c.accessToken, [a.sessionId]);
    assert.equal(
      (await e.revoke(a.accessToken, [b.sessionId], key)).statusCode,
      401,
    );
  }));

test("P2-M0 durable restart, stored challenge binding and session expiry deny unexpired JWT", () =>
  withDatabase(async (e) => {
    const challenge = await e.challenge();
    await e.pool.query(
      "UPDATE auth_challenges SET typed_data=jsonb_set(typed_data,'{message,origin}',to_jsonb($2::text)) WHERE id=$1",
      [challenge.challengeId, "https://other.example"],
    );
    assert.equal(
      (
        await e.app.inject({
          method: "POST",
          url: "/v1/auth/verify",
          payload: {
            challengeId: challenge.challengeId,
            signature: await e.signature(challenge),
          },
        })
      ).statusCode,
      401,
    );
    const tokens = await e.login();
    const restarted = await createApi({
      database: e.pool,
      auth: config,
      clock: e.now,
      logger: false,
    });
    try {
      assert.equal(
        (
          await restarted.inject({
            url: "/v1/auth/sessions",
            headers: { authorization: "Bearer " + tokens.accessToken },
          })
        ).statusCode,
        200,
      );
    } finally {
      await restarted.close();
    }
    await e.pool.query(
      "UPDATE owner_sessions SET idle_expires_at=created_at+600 WHERE id=$1",
      [tokens.sessionId],
    );
    e.advance(600);
    assert.equal((await e.get(tokens.accessToken)).statusCode, 401);
    assert.equal((await e.refresh(tokens)).statusCode, 401);
  }));

test("P2-M0 auth operates with runtime DML privileges and no schema creation privilege", () =>
  withDatabase(async (e) => {
    const schema = (
      await e.pool.query<{ name: string }>("SELECT current_schema() name")
    ).rows[0]?.name;
    assert.ok(schema);
    const role = "auth_runtime_" + randomBytes(8).toString("hex");
    await admin.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEROLE`);
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
    await admin.query(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA "${schema}" TO "${role}"`,
    );
    const pool = new Pool({
      ...base,
      options: "-c search_path=" + schema + " -c role=" + role,
    });
    const app = await createApi({
      database: pool,
      auth: config,
      clock: e.now,
      logger: false,
    });
    try {
      assert.equal(
        (await pool.query<{ name: string }>("SELECT current_user name")).rows[0]
          ?.name,
        role,
      );
      await assert.rejects(pool.query("CREATE TABLE forbidden(id integer)"), {
        code: "42501",
      });
      const challengeResponse = await app.inject({
        method: "POST",
        url: "/v1/auth/challenge",
        payload: { ownerAddress: owner.address, deviceId },
      });
      assert.equal(challengeResponse.statusCode, 200);
      const challenge = AuthChallengeResponseSchema.parse(
        challengeResponse.json(),
      );
      const result = await app.inject({
        method: "POST",
        url: "/v1/auth/verify",
        payload: {
          challengeId: challenge.challengeId,
          signature: await e.signature(challenge),
        },
      });
      assert.equal(result.statusCode, 200, result.body);
      const tokens = AuthTokensSchema.parse(result.json());
      const refresh = await app.inject({
        method: "POST",
        url: "/v1/auth/refresh",
        payload: {
          sessionId: tokens.sessionId,
          refreshToken: tokens.refreshToken,
        },
      });
      assert.equal(refresh.statusCode, 200, refresh.body);
      assert.equal(
        (
          await app.inject({
            url: "/v1/auth/sessions",
            headers: { authorization: "Bearer " + tokens.accessToken },
          })
        ).statusCode,
        200,
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM "${role}"`,
      );
      await admin.query(`REVOKE ALL ON SCHEMA "${schema}" FROM "${role}"`);
      await admin.query(`DROP ROLE "${role}"`);
    }
  }));

function invalidVerify(
  e: Environment,
  remoteAddress: string,
  forwarded: string,
) {
  return e.app.inject({
    method: "POST",
    url: "/v1/auth/verify",
    remoteAddress,
    headers: { "x-forwarded-for": forwarded },
    payload: { challengeId: randomUUID(), signature: "0x" + "11".repeat(65) },
  });
}

test("P2-M0 ingress: trusted Caddy preserves separate real-client rate buckets", () =>
  withDatabase(
    async (e) => {
      for (let i = 0; i < 60; i++)
        assert.equal(
          (await invalidVerify(e, "127.0.0.1", "203.0.113.10")).statusCode,
          401,
        );
      assert.equal(
        (await invalidVerify(e, "127.0.0.1", "203.0.113.10")).statusCode,
        429,
      );
      const b = await e.app.inject({
        method: "POST",
        url: "/v1/auth/challenge",
        remoteAddress: "127.0.0.1",
        headers: { "x-forwarded-for": "203.0.113.20" },
        payload: { ownerAddress: owner.address, deviceId },
      });
      assert.equal(b.statusCode, 200, b.body);
    },
    ["127.0.0.1"],
  ));

test("P2-M0 ingress: untrusted direct peer cannot evade its rate bucket with spoofed XFF", () =>
  withDatabase(
    async (e) => {
      for (let i = 0; i < 60; i++)
        assert.equal(
          (await invalidVerify(e, "203.0.113.10", "198.51.100." + (i + 1)))
            .statusCode,
          401,
        );
      assert.equal(
        (await invalidVerify(e, "203.0.113.10", "198.51.100.250")).statusCode,
        429,
      );
    },
    ["127.0.0.1"],
  ));

test("P2-M0 ingress: spoofed forwarding prefixes cannot override nearest untrusted client", () =>
  withDatabase(
    async (e) => {
      for (let i = 0; i < 60; i++)
        assert.equal(
          (
            await invalidVerify(
              e,
              "127.0.0.1",
              "198.51.100." + (i + 1) + ", 203.0.113.10",
            )
          ).statusCode,
          401,
        );
      assert.equal(
        (await invalidVerify(e, "127.0.0.1", "198.51.100.250, 203.0.113.10"))
          .statusCode,
        429,
      );
      assert.equal(
        (await invalidVerify(e, "127.0.0.1", "198.51.100.250, 203.0.113.20"))
          .statusCode,
        401,
      );
    },
    ["127.0.0.1"],
  ));

test("P2-M0 unsupported authentication content type is a nonretryable client error", () =>
  withDatabase(async (e) => {
    const result = await e.app.inject({
      method: "POST",
      url: "/v1/auth/challenge",
      headers: { "content-type": "application/xml" },
      payload: "<challenge/>",
    });
    assert.equal(result.statusCode, 415);
    assert.equal(ApiErrorSchema.parse(result.json()).retryable, false);
  }));

test("close real PostgreSQL admin pool", async () => {
  await admin.end();
});
