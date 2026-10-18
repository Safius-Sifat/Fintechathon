import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Pool, PoolClient } from "pg";
import {
  AddressSchema,
  Hex32Schema,
  AuthChallengeResponseSchema,
  AuthTokensSchema,
  canonicalJson,
  loginDomain,
  recoverSigner,
  typedDataJson,
  type SessionView,
} from "@mandate/schema";
import { AuthError, denied } from "./errors.js";
import { validateAuthConfig, type AuthConfig } from "./config.js";

const ACCESS_SECONDS = 900;
const IDLE_SECONDS = 604800;
const ABSOLUTE_SECONDS = 2592000;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const token = () => randomBytes(32).toString("base64url");

type Session = {
  id: string;
  owner_address: string;
  device_id: string;
  device_label: string;
  auth_time: string;
  created_at: string;
  last_used_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
  revoked_at: string | null;
};
type Challenge = {
  id: string;
  owner_address: string;
  device_id: string;
  nonce: string;
  typed_data: unknown;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
};
export type OwnerContext = {
  sessionId: string;
  ownerAddress: string;
  deviceId: string;
  authTime: number;
};

function live(session: Session | undefined, now: number): session is Session {
  return (
    !!session &&
    session.revoked_at === null &&
    now < Number(session.idle_expires_at) &&
    now < Number(session.absolute_expires_at)
  );
}

export class AuthService {
  readonly config: AuthConfig;
  constructor(
    readonly database: Pool,
    config: AuthConfig,
    readonly clock: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.config = validateAuthConfig(config);
  }
  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    let discard = false;
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }
  async limit(ip: string, owner?: string): Promise<void> {
    const now = this.clock();
    const window = now - (now % 60);
    const limits: [string, number][] = [
      ["global", 1000],
      ["ip:" + hash(ip), 60],
    ];
    if (owner) limits.push(["owner:" + owner.toLowerCase(), 10]);
    const allowed = await this.transaction(async (client) => {
      await client.query(
        "DELETE FROM auth_rate_limits WHERE window_start < $1",
        [window - 60],
      );
      for (const [bucket, max] of limits) {
        const result = await client.query<{ requests: number }>(
          "INSERT INTO auth_rate_limits(bucket,window_start,requests) VALUES($1,$2,1) ON CONFLICT(bucket,window_start) DO UPDATE SET requests=auth_rate_limits.requests+1 RETURNING requests",
          [bucket, window],
        );
        if ((result.rows[0]?.requests ?? Infinity) > max) return false;
      }
      return true;
    });
    if (!allowed)
      throw new AuthError(429, "Authentication rate limit exceeded.");
  }
  async challenge(ownerAddress: string, deviceId: string) {
    const now = this.clock();
    const nonce = "0x" + randomBytes(32).toString("hex");
    const result = AuthChallengeResponseSchema.parse({
      challengeId: randomUUID(),
      typedData: typedDataJson(
        "Login",
        {
          origin: this.config.origin,
          nonce,
          deviceId,
          issuedAt: String(now),
          expiresAt: String(now + 300),
        },
        loginDomain(),
      ),
    });
    await this.transaction(async (client) => {
      await client.query("DELETE FROM auth_challenges WHERE expires_at < $1", [
        now - 300,
      ]);
      await client.query(
        "INSERT INTO auth_challenges(id,owner_address,device_id,nonce,typed_data,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          result.challengeId,
          ownerAddress.toLowerCase(),
          deviceId,
          nonce,
          result.typedData,
          now,
          now + 300,
        ],
      );
    });
    return result;
  }
  async verify(challengeId: string, signature: `0x${string}`) {
    return this.transaction(async (client) => {
      const challenge = (
        await client.query<Challenge>(
          "SELECT * FROM auth_challenges WHERE id=$1 FOR UPDATE",
          [challengeId],
        )
      ).rows[0];
      const now = this.clock();
      if (
        !challenge ||
        challenge.consumed_at !== null ||
        now >= Number(challenge.expires_at) ||
        now < Number(challenge.issued_at)
      )
        denied("Login challenge is invalid, expired or consumed.");
      const stored = AuthChallengeResponseSchema.parse({
        challengeId,
        typedData: challenge.typed_data,
      });
      const expected = typedDataJson(
        "Login",
        {
          origin: this.config.origin,
          nonce: challenge.nonce,
          deviceId: challenge.device_id,
          issuedAt: challenge.issued_at,
          expiresAt: challenge.expires_at,
        },
        loginDomain(),
      );
      if (canonicalJson(stored.typedData) !== canonicalJson(expected))
        denied("Login challenge binding is invalid.");
      let signer: string;
      try {
        signer = await recoverSigner(
          "Login",
          stored.typedData.message,
          loginDomain(),
          signature,
        );
      } catch {
        return denied("Login signature is invalid.");
      }
      if (signer.toLowerCase() !== challenge.owner_address)
        denied("Login signature does not match owner.");
      await client.query(
        "UPDATE auth_challenges SET consumed_at=$2 WHERE id=$1",
        [challengeId, now],
      );
      await client.query(
        "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [challenge.owner_address, now],
      );
      const sessionId = randomUUID();
      const session = (
        await client.query<Session>(
          "INSERT INTO owner_sessions(id,owner_address,device_id,auth_time,created_at,last_used_at,idle_expires_at,absolute_expires_at) VALUES($1,$2,$3,$4,$4,$4,$5,$6) RETURNING *",
          [
            sessionId,
            challenge.owner_address,
            challenge.device_id,
            now,
            now + IDLE_SECONDS,
            now + ABSOLUTE_SECONDS,
          ],
        )
      ).rows[0];
      if (!session) throw new Error("Session insert failed");
      const family = randomUUID();
      await client.query(
        "INSERT INTO refresh_token_families(id,session_id) VALUES($1,$2)",
        [family, sessionId],
      );
      return this.issue(client, session, family, now);
    });
  }
  async issue(
    client: PoolClient,
    session: Session,
    family: string,
    now: number,
  ) {
    const refreshToken = token();
    const refreshExpiry = Math.min(
      now + IDLE_SECONDS,
      Number(session.absolute_expires_at),
    );
    await client.query(
      "INSERT INTO refresh_tokens(token_hash,family_id,created_at,expires_at) VALUES($1,$2,$3,$4)",
      [hash(refreshToken), family, now, refreshExpiry],
    );
    const accessToken = await new SignJWT({
      kind: "owner",
      ownerAddress: AddressSchema.parse(session.owner_address),
      sessionId: session.id,
      deviceId: session.device_id,
      auth_time: Number(session.auth_time),
    })
      .setProtectedHeader({ alg: "HS256", typ: "owner+jwt" })
      .setSubject(session.owner_address)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_SECONDS)
      .sign(this.config.signingKey);
    return AuthTokensSchema.parse({
      accessToken,
      sessionId: session.id,
      expiresAt: String(now + ACCESS_SECONDS),
      refreshToken,
      refreshExpiresAt: String(refreshExpiry),
    });
  }
  async refresh(sessionId: string, refreshToken: string) {
    const result = await this.transaction(async (client) => {
      const session = (
        await client.query<Session>(
          "SELECT * FROM owner_sessions WHERE id=$1 FOR UPDATE",
          [sessionId],
        )
      ).rows[0];
      const now = this.clock();
      if (!live(session, now)) return null;
      const current = (
        await client.query<{
          family_id: string;
          expires_at: string;
          replaced_at: string | null;
          revoked_at: string | null;
        }>(
          "SELECT t.family_id,t.expires_at,t.replaced_at,f.revoked_at FROM refresh_tokens t JOIN refresh_token_families f ON f.id=t.family_id WHERE t.token_hash=$1 AND f.session_id=$2 FOR UPDATE OF t,f",
          [hash(refreshToken), sessionId],
        )
      ).rows[0];
      if (!current || current.revoked_at !== null) return null;
      if (current.replaced_at !== null) {
        await client.query(
          "UPDATE refresh_token_families SET revoked_at=$2 WHERE id=$1",
          [current.family_id, now],
        );
        await client.query(
          "UPDATE owner_sessions SET revoked_at=$2 WHERE id=$1",
          [sessionId, now],
        );
        return null;
      }
      if (now >= Number(current.expires_at)) return null;
      await client.query(
        "UPDATE refresh_tokens SET replaced_at=$2 WHERE token_hash=$1",
        [hash(refreshToken), now],
      );
      await client.query(
        "UPDATE owner_sessions SET last_used_at=$2,idle_expires_at=LEAST($3,absolute_expires_at) WHERE id=$1",
        [sessionId, now, now + IDLE_SECONDS],
      );
      return this.issue(client, session, current.family_id, now);
    });
    if (!result)
      denied(
        "Refresh credential expired, invalid or family revoked; complete a new signed login.",
      );
    return result;
  }
  async authenticate(authorization: string | undefined): Promise<OwnerContext> {
    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) ||
      authorization.length > 8192
    )
      denied();
    let context: OwnerContext;
    const now = this.clock();
    try {
      const { payload } = await jwtVerify(
        authorization.slice(7),
        this.config.signingKey,
        {
          algorithms: ["HS256"],
          typ: "owner+jwt",
          issuer: this.config.issuer,
          audience: this.config.audience,
          currentDate: new Date(now * 1000),
          requiredClaims: [
            "sub",
            "iat",
            "exp",
            "auth_time",
            "sessionId",
            "ownerAddress",
            "deviceId",
            "kind",
          ],
        },
      );
      if (
        payload.kind !== "owner" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.deviceId !== "string" ||
        typeof payload.auth_time !== "number" ||
        !Number.isSafeInteger(payload.auth_time) ||
        payload.auth_time > now ||
        typeof payload.iat !== "number" ||
        payload.iat > now ||
        typeof payload.exp !== "number" ||
        payload.exp - payload.iat !== ACCESS_SECONDS ||
        typeof payload.sub !== "string" ||
        AddressSchema.parse(payload.ownerAddress).toLowerCase() !== payload.sub
      )
        denied();
      context = {
        sessionId: payload.sessionId,
        ownerAddress: payload.sub,
        deviceId: payload.deviceId,
        authTime: payload.auth_time,
      };
    } catch {
      return denied();
    }
    const session = (
      await this.database.query<Session>(
        "SELECT s.* FROM owner_sessions s JOIN owner_identities o ON o.owner_address=s.owner_address WHERE s.id::text=$1",
        [context.sessionId],
      )
    ).rows[0];
    if (
      !live(session, now) ||
      session.owner_address !== context.ownerAddress ||
      session.device_id !== context.deviceId ||
      Number(session.auth_time) !== context.authTime
    )
      denied();
    return context;
  }
  async sessions(context: OwnerContext): Promise<{ items: SessionView[] }> {
    const result = await this.database.query<Session>(
      "SELECT * FROM owner_sessions WHERE owner_address=$1 ORDER BY created_at,id",
      [context.ownerAddress],
    );
    return {
      items: result.rows.map((s) => ({
        sessionId: s.id,
        deviceId: Hex32Schema.parse(s.device_id),
        deviceLabel: s.device_label,
        createdAt: s.created_at,
        lastUsedAt: s.last_used_at,
        expiresAt: String(
          Math.min(Number(s.idle_expires_at), Number(s.absolute_expires_at)),
        ),
        revoked: s.revoked_at !== null,
        current: s.id === context.sessionId,
      })),
    };
  }
  async mutate(
    context: OwnerContext,
    route: "/v1/auth/logout" | "/v1/auth/sessions/revoke",
    key: string,
    body: { sessionIds: string[] | "ALL" } | Record<string, never>,
  ) {
    return this.transaction(async (client) => {
      await client.query(
        "SELECT owner_address FROM owner_identities WHERE owner_address=$1 FOR UPDATE",
        [context.ownerAddress],
      );
      const session = (
        await client.query<Session>(
          "SELECT * FROM owner_sessions WHERE id=$1 FOR UPDATE",
          [context.sessionId],
        )
      ).rows[0];
      const now = this.clock();
      if (
        !live(session, now) ||
        session.owner_address !== context.ownerAddress ||
        Number(session.auth_time) !== context.authTime
      )
        denied();
      if (
        route === "/v1/auth/sessions/revoke" &&
        now - Number(session.auth_time) > 300
      )
        throw new AuthError(
          401,
          "A recent owner-signed login is required.",
          "REAUTH_REQUIRED",
        );
      const bodyHash = hash(canonicalJson(body));
      const prior = (
        await client.query<{ body_hash: string; response: unknown }>(
          "SELECT body_hash,response FROM auth_idempotency WHERE owner_address=$1 AND route=$2 AND key=$3",
          [context.ownerAddress, route, key],
        )
      ).rows[0];
      if (prior) {
        if (prior.body_hash !== bodyHash)
          throw new AuthError(
            409,
            "Idempotency key was used with a different body.",
            "DUPLICATE_REQUEST",
          );
        return prior.response;
      }
      let ids: string[];
      if (route === "/v1/auth/logout") ids = [session.id];
      else if (body.sessionIds === "ALL")
        ids = (
          await client.query<{ id: string }>(
            "SELECT id FROM owner_sessions WHERE owner_address=$1 ORDER BY id",
            [context.ownerAddress],
          )
        ).rows.map((r) => r.id);
      else {
        ids = Array.isArray(body.sessionIds)
          ? [...new Set(body.sessionIds)].sort()
          : [];
        const owned = await client.query<{ id: string }>(
          "SELECT id FROM owner_sessions WHERE owner_address=$1 AND id=ANY($2::uuid[])",
          [context.ownerAddress, ids],
        );
        if (owned.rowCount !== ids.length)
          throw new AuthError(403, "Session is outside this owner's scope.");
      }
      await client.query(
        "UPDATE owner_sessions SET revoked_at=COALESCE(revoked_at,$2) WHERE id=ANY($1::uuid[])",
        [ids, now],
      );
      await client.query(
        "UPDATE refresh_token_families SET revoked_at=COALESCE(revoked_at,$2) WHERE session_id=ANY($1::uuid[])",
        [ids, now],
      );
      const response =
        route === "/v1/auth/logout" ? { revoked: true } : { revokedIds: ids };
      await client.query(
        "INSERT INTO auth_idempotency(owner_address,route,key,body_hash,response,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [context.ownerAddress, route, key, bodyHash, response, now],
      );
      return response;
    });
  }
}
