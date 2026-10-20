import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAuthConfig, validateAuthConfig } from "../src/auth/config.js";
import { createApi } from "../src/app.js";
const config = {
  origin: "https://api.mandate.example",
  issuer: "https://api.mandate.example",
  audience: "mandate-owner-api",
  signingKey: new Uint8Array(32).fill(7),
};
test("auth configuration requires an explicit strong key and exact HTTPS origin", async () => {
  assert.equal(await loadAuthConfig({}), null);
  for (const origin of [
    "http://localhost",
    "https://api.mandate.example/",
    "https://a.example/path",
    "https://user@a.example",
    "invalid",
  ])
    assert.throws(() => validateAuthConfig({ ...config, origin }));
  assert.throws(() =>
    validateAuthConfig({ ...config, signingKey: new Uint8Array(16) }),
  );
  assert.throws(() => validateAuthConfig({ ...config, audience: "" }));
  const directory = await mkdtemp(join(tmpdir(), "mandate-auth-config-"));
  try {
    const path = join(directory, "secret");
    await writeFile(path, Buffer.alloc(32, 7).toString("base64url"), {
      mode: 0o600,
    });
    assert.equal(
      (
        await loadAuthConfig({
          AUTH_ORIGIN: config.origin,
          AUTH_JWT_SECRET_FILE: path,
        })
      )?.audience,
      config.audience,
    );
    await writeFile(path, "invalid");
    await assert.rejects(
      loadAuthConfig({
        AUTH_ORIGIN: config.origin,
        AUTH_JWT_SECRET_FILE: path,
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("unconfigured auth fails closed while foundation health stays available", async () => {
  const app = await createApi({ database: null, auth: null, logger: false });
  try {
    assert.equal((await app.inject({ url: "/healthz" })).statusCode, 200);
    assert.equal((await app.inject({ url: "/readyz" })).statusCode, 503);
    assert.equal((await app.inject({ url: "/health/db" })).statusCode, 503);
    for (const url of [
      "challenge",
      "verify",
      "refresh",
      "logout",
      "sessions/revoke",
    ])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/v1/auth/" + url,
            payload: {},
          })
        ).statusCode,
        503,
      );
    assert.equal(
      (await app.inject({ url: "/v1/auth/sessions" })).statusCode,
      503,
    );
    assert.equal(
      (await app.inject({ method: "POST", url: "/v1/wallets", payload: {} }))
        .statusCode,
      503,
    );
    assert.equal(
      (await app.inject({ url: "/v1/not-a-route" })).statusCode,
      501,
    );
  } finally {
    await app.close();
  }
});

test("proxy trust defaults off and accepts only explicit IP addresses for API ingress", async () => {
  const { createFoundationApp } = await import("@mandate/platform");
  const peer = async (
    service: "api" | "provider" | "policy",
    addresses?: string[],
  ) => {
    const app = createFoundationApp(service, {
      logger: false,
      ...(addresses ? { trustedProxyAddresses: addresses } : {}),
    });
    app.get("/peer", (request) => ({ ip: request.ip }));
    try {
      return (
        await app.inject({
          url: "/peer",
          remoteAddress: "127.0.0.1",
          headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.10" },
        })
      ).json<{ ip: string }>().ip;
    } finally {
      await app.close();
    }
  };
  assert.equal(await peer("api"), "127.0.0.1");
  assert.equal(await peer("api", ["127.0.0.1"]), "203.0.113.10");
  assert.equal(await peer("provider", ["127.0.0.1"]), "127.0.0.1");
  assert.equal(await peer("policy", ["127.0.0.1"]), "127.0.0.1");
  for (const addresses of [["true"], ["*"], ["0.0.0.0/0"], ["loopback"], [""]])
    assert.throws(
      () => createFoundationApp("api", { trustedProxyAddresses: addresses }),
      /ingress/,
    );
});

test("API startup reads the explicit trusted ingress configuration", async () => {
  const { startFoundationService } = await import("@mandate/platform");
  const names = [
    "APP_ENV",
    "DATABASE_URL",
    "DEPLOYMENT_MANIFEST_FILE",
    "API_HOST",
    "API_PORT",
    "API_TRUSTED_PROXY_ADDRESSES",
  ] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  process.env.APP_ENV = "production";
  delete process.env.DATABASE_URL;
  delete process.env.DEPLOYMENT_MANIFEST_FILE;
  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT = "0";
  process.env.API_TRUSTED_PROXY_ADDRESSES = "127.0.0.1";
  try {
    const app = await startFoundationService("api", 0, async (server) => {
      server.get("/peer", (request) => ({ ip: request.ip }));
    });
    try {
      const response = await app.inject({
        url: "/peer",
        remoteAddress: "127.0.0.1",
        headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.10" },
      });
      assert.equal(response.json<{ ip: string }>().ip, "203.0.113.10");
    } finally {
      await app.close();
    }
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("P2-06.T01 readiness names failing dependencies and stays 503", async () => {
  const { createFoundationApp } = await import("@mandate/platform");
  const app = createFoundationApp("api", {
    logger: false,
    readiness: async () => ({ database: false, chain: true }),
  });
  try {
    const r = await app.inject({ url: "/readyz" });
    assert.equal(r.statusCode, 503);
    assert.deepEqual(r.json().checks, { database: false, chain: true });
    const failing = createFoundationApp("api", {
      logger: false,
      readiness: async () => {
        throw new Error("secret=xyz");
      },
    });
    const body = (await failing.inject({ url: "/readyz" })).body;
    assert.ok(!body.includes("secret"));
    await failing.close();
  } finally {
    await app.close();
  }
});
