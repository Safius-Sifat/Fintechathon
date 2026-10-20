import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApiErrorSchema, WalletViewSchema } from "@mandate/schema";
import {
  admin,
  apiEnvironment,
  insertTask,
  ownerA,
  ownerB,
} from "./support.js";

after(() => admin.end());

async function withApi(
  run: (e: Awaited<ReturnType<typeof apiEnvironment>>) => Promise<void>,
) {
  const e = await apiEnvironment();
  try {
    await run(e);
  } finally {
    await e.close();
  }
}
const count = async (
  e: { pool: { query: (q: string) => Promise<{ rows: { n: string }[] }> } },
  table: string,
) =>
  Number(
    (await e.pool.query(`SELECT count(*)::text AS n FROM ${table}`)).rows[0]!.n,
  );

test("P2-03.T01 same Idempotency-Key/body x20 concurrently creates one wallet, job and response; changed body 409", () =>
  withApi(async (e) => {
    const auth = await e.login(ownerA);
    const key = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        e.call("POST", "/v1/wallets", auth, {}, key),
      ),
    );
    for (const r of responses) assert.equal(r.statusCode, 200, r.body);
    const ids = new Set(
      responses.map((r) => WalletViewSchema.parse(r.json()).walletId),
    );
    assert.equal(ids.size, 1);
    assert.equal(await count(e, "wallets"), 1);
    assert.equal(await count(e, "jobs"), 1);
    assert.equal(await count(e, "idempotency_keys"), 1);
    const view = WalletViewSchema.parse(responses[0]!.json());
    assert.equal(view.provisioningState, "DEPLOYING");
    assert.equal(view.address, null);
    assert.equal(view.executorAddress, null);

    // A different key still cannot create a second wallet for the same owner.
    const other = await e.call("POST", "/v1/wallets", auth, {});
    assert.equal(WalletViewSchema.parse(other.json()).walletId, view.walletId);
    assert.equal(await count(e, "wallets"), 1);

    // Changed body on the token route: same key with a different expiry is a 409.
    const walletId = view.walletId;
    const tokenKey = randomUUID();
    const body = {
      walletId,
      taskId: null,
      scopes: ["read"],
      expiresAt: String(e.now() + 3600),
    };
    const first = await e.call(
      "POST",
      "/v1/agent-tokens",
      auth,
      body,
      tokenKey,
    );
    assert.equal(first.statusCode, 200, first.body);
    const changed = await e.call(
      "POST",
      "/v1/agent-tokens",
      auth,
      { ...body, expiresAt: String(e.now() + 7200) },
      tokenKey,
    );
    assert.equal(changed.statusCode, 409);
    assert.equal(
      ApiErrorSchema.parse(changed.json()).code,
      "DUPLICATE_REQUEST",
    );
    // The plaintext token is revealed once; a same-body replay does not reveal it again.
    const replay = await e.call(
      "POST",
      "/v1/agent-tokens",
      auth,
      body,
      tokenKey,
    );
    assert.equal(replay.statusCode, 409);
    assert.ok(!replay.body.includes("mat_"));
    assert.equal(await count(e, "agent_tokens"), 1);
    const stored = await e.pool.query<{ response: unknown }>(
      "SELECT response FROM idempotency_keys WHERE route='/v1/agent-tokens'",
    );
    assert.ok(!JSON.stringify(stored.rows).includes("mat_"));
  }));

test("P2-03.T02 owner A JWT or A agent token cannot read or mutate B wallet/task/token", () =>
  withApi(async (e) => {
    const a = await e.login(ownerA);
    const b = await e.login(ownerB);
    const walletA = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", a, {})).json(),
    ).walletId;
    const walletB = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", b, {})).json(),
    ).walletId;
    const taskA = await insertTask(e.pool, walletA, e.now());
    const taskB = await insertTask(e.pool, walletB, e.now());
    const ok200 = (r: { statusCode: number; body: string }) =>
      assert.equal(r.statusCode, 200, r.body);
    const expectScope = (r: {
      statusCode: number;
      json: () => unknown;
      body: string;
    }) => {
      assert.equal(r.statusCode, 403, r.body);
      assert.equal(ApiErrorSchema.parse(r.json()).code, "AUTH_SCOPE");
      assert.ok(!r.body.includes(walletB) && !r.body.includes(taskB));
    };
    expectScope(await e.call("GET", `/v1/wallets/${walletB}`, a));
    expectScope(await e.call("GET", `/v1/tasks/${taskB}`, a));
    // Unknown resources are indistinguishable from foreign ones.
    expectScope(await e.call("GET", `/v1/tasks/${randomUUID()}`, a));
    expectScope(
      await e.call("POST", "/v1/agent-tokens", a, {
        walletId: walletB,
        taskId: null,
        scopes: ["read"],
        expiresAt: String(e.now() + 3600),
      }),
    );
    expectScope(
      await e.call("POST", "/v1/agent-tokens", a, {
        walletId: walletA,
        taskId: taskB,
        scopes: ["read"],
        expiresAt: String(e.now() + 3600),
      }),
    );

    const issued = await e.call("POST", "/v1/agent-tokens", a, {
      walletId: walletA,
      taskId: taskA,
      scopes: ["read"],
      expiresAt: String(e.now() + 3600),
    });
    assert.equal(issued.statusCode, 200, issued.body);
    const { id, token } = issued.json() as { id: string; token: string };
    const agent = "Bearer " + token;
    ok200(await e.call("GET", `/v1/tasks/${taskA}`, agent));
    ok200(await e.call("GET", `/v1/wallets/${walletA}`, agent));
    expectScope(await e.call("GET", `/v1/wallets/${walletB}`, agent));
    expectScope(await e.call("GET", `/v1/tasks/${taskB}`, agent));
    // A task-restricted token cannot read another task in its own wallet.
    const taskA2 = await insertTask(e.pool, walletA, e.now());
    expectScope(await e.call("GET", `/v1/tasks/${taskA2}`, agent));
    // Agent tokens never reach owner routes.
    expectScope(await e.call("POST", "/v1/wallets", agent, {}));
    expectScope(
      await e.call("POST", "/v1/agent-tokens", agent, {
        walletId: walletA,
        taskId: null,
        scopes: ["run"],
        expiresAt: String(e.now() + 3600),
      }),
    );
    // B cannot revoke A's token; A can, and the token stops working.
    expectScope(await e.call("DELETE", `/v1/agent-tokens/${id}`, b));
    ok200(await e.call("DELETE", `/v1/agent-tokens/${id}`, a));
    assert.equal(
      (await e.call("GET", `/v1/tasks/${taskA}`, agent)).statusCode,
      401,
    );
    // Expired tokens fail too.
    const short = await e.call("POST", "/v1/agent-tokens", a, {
      walletId: walletA,
      taskId: null,
      scopes: ["read"],
      expiresAt: String(e.now() + 60),
    });
    e.advance(61);
    assert.equal(
      (
        await e.call(
          "GET",
          `/v1/wallets/${walletA}`,
          "Bearer " + (short.json() as { token: string }).token,
        )
      ).statusCode,
      401,
    );
    // Missing scope: a run-only token cannot read.
    const a2 = await e.login(ownerA);
    const runOnly = await e.call("POST", "/v1/agent-tokens", a2, {
      walletId: walletA,
      taskId: null,
      scopes: ["run"],
      expiresAt: String(e.now() + 3600),
    });
    expectScope(
      await e.call(
        "GET",
        `/v1/wallets/${walletA}`,
        "Bearer " + (runOnly.json() as { token: string }).token,
      ),
    );
  }));

test("P2-03.T05 unknown fields, float/overwidth uints, missing keys and bad scopes reject with 422 and no side effects", () =>
  withApi(async (e) => {
    const auth = await e.login(ownerA);
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", auth, {})).json(),
    ).walletId;
    const before = {
      wallets: await count(e, "wallets"),
      tokens: await count(e, "agent_tokens"),
      keys: await count(e, "idempotency_keys"),
      jobs: await count(e, "jobs"),
    };
    const valid = {
      walletId,
      taskId: null,
      scopes: ["read"],
      expiresAt: String(e.now() + 3600),
    };
    const bad: unknown[] = [
      { ...valid, extra: true },
      { ...valid, expiresAt: e.now() + 3600 },
      { ...valid, expiresAt: "1793003600.5" },
      { ...valid, expiresAt: "18446744073709551616" },
      { ...valid, expiresAt: "01793003600" },
      { ...valid, scopes: ["read", "read"] },
      { ...valid, scopes: ["admin"] },
      { ...valid, scopes: [] },
      { ...valid, walletId: "not-a-uuid" },
    ];
    for (const body of bad) {
      const r = await e.call("POST", "/v1/agent-tokens", auth, body);
      assert.equal(r.statusCode, 422, JSON.stringify(body) + r.body);
      ApiErrorSchema.parse(r.json());
      assert.ok(!/select|insert|postgres|stack/i.test(r.body));
    }
    assert.equal(
      (await e.call("POST", "/v1/wallets", auth, { unexpected: 1 })).statusCode,
      422,
    );
    assert.equal(
      (await e.call("POST", "/v1/wallets", auth, {}, null)).statusCode,
      422,
    );
    assert.equal(
      (await e.call("POST", "/v1/wallets", auth, {}, "not-a-uuid")).statusCode,
      422,
    );
    assert.equal(
      (await e.call("GET", "/v1/wallets/not-a-uuid", auth)).statusCode,
      422,
    );
    assert.deepEqual(
      {
        wallets: await count(e, "wallets"),
        tokens: await count(e, "agent_tokens"),
        keys: await count(e, "idempotency_keys"),
        jobs: await count(e, "jobs"),
      },
      before,
    );
    // Database constraints reject an invalid state transition independent of API code.
    await assert.rejects(
      e.pool.query(
        "UPDATE wallets SET provisioning_state='READY' WHERE id=$1",
        [walletId],
      ),
      (error: { code?: string }) => error.code === "23514",
    );
    await assert.rejects(
      e.pool.query("UPDATE wallets SET epoch=$2 WHERE id=$1", [
        walletId,
        "18446744073709551616",
      ]),
      (error: { code?: string }) =>
        error.code === "23514" || error.code === "22003",
    );
  }));

test("P2-03 task creation fails explicitly while the runbook preparation dependency is absent", () =>
  withApi(async (e) => {
    const auth = await e.login(ownerA);
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", auth, {})).json(),
    ).walletId;
    const r = await e.call("POST", "/v1/tasks", auth, {
      walletId,
      runbookId: "browser-check",
      goal: "check the checkout page",
      input: {},
    });
    assert.equal(r.statusCode, 503);
    assert.equal(ApiErrorSchema.parse(r.json()).retryable, true);
    assert.equal(await count(e, "tasks"), 0);
  }));
