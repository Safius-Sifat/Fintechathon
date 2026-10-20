import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { PolicyService, type ChainReader } from "../../src/authorize.js";
import { createPolicyServer } from "../../src/server.js";
import {
  admin,
  isolatedSchema,
} from "../../../../apps/worker/test/db/support.js";
import { seedSignedAction, type SignedFixture } from "./fixture.js";

after(() => admin.end());

const now = 1793000000;
// Local stand-in for the policy service's own RPC snapshot.
const freshChain =
  (overrides: Partial<Awaited<ReturnType<ChainReader>>> = {}): ChainReader =>
  async () => ({
    blockNumber: 100n,
    timestamp: BigInt(now - 2),
    paused: false,
    frozen: false,
    epoch: 0n,
    requestUsed: false,
    ...overrides,
  });

async function withFixture(
  run: (pool: Pool, f: SignedFixture) => Promise<void>,
  options: Parameters<typeof seedSignedAction>[2] = {},
) {
  const db = await isolatedSchema("pol");
  try {
    await run(db.pool, await seedSignedAction(db.pool, now, options));
  } finally {
    await db.drop();
  }
}
const check = (
  pool: Pool,
  f: SignedFixture,
  chain: ChainReader | null = freshChain(),
  manifest: SignedFixture["manifest"] | null = f.manifest,
  message: Parameters<PolicyService["check"]>[0]["message"] = f.message,
) =>
  new PolicyService(pool, manifest, chain, () => now).check({
    actionId: f.actionId,
    attemptId: f.attemptId,
    message,
  });

test("P2-02 a fully bound owner-signed PAY is allowed with every expected field from storage", () =>
  withFixture(async (pool, f) => {
    const decision = await check(pool, f);
    assert.deepEqual(decision.ruleIds, []);
    assert.equal(decision.allowed, true);
    assert.equal(decision.expectedDigest, f.digest);
    assert.equal(decision.expectedMpcWalletId, f.mpcWalletId);
    assert.equal(decision.expectedTxId, f.attemptId);
    assert.equal(decision.expectedNetwork, "eip155:84532");
    assert.equal(decision.expectedDerivationPath, null);
    assert.equal(decision.expectedExecutor, f.executor);
    assert.equal(decision.chainBlock, "100");
  }));

test("P2-02.T02 caller message claims never override reloaded storage", () =>
  withFixture(async (pool, f) => {
    const other = Buffer.alloc(32, 7).toString("base64");
    for (const message of [
      { ...f.message, tx: other },
      { ...f.message, wallet_id: crypto.randomUUID() },
      { ...f.message, tx_id: crypto.randomUUID() },
      { ...f.message, network_internal_code: "eip155:8453" },
      { ...f.message, derivation_path: [0] },
      { ...f.message, key_type: "ed25519" },
    ]) {
      const decision = await check(pool, f, freshChain(), f.manifest, message);
      assert.equal(decision.allowed, false);
      assert.ok(decision.ruleIds.includes("MESSAGE_MISMATCH"));
      assert.equal(decision.expectedDigest, null);
    }
    // Stored Action edited after its digest was committed: the recomputed digest wins.
    await pool.query(
      "UPDATE actions SET action=jsonb_set(action,'{amount}','\"300000\"') WHERE id=$1",
      [f.actionId],
    );
    const tampered = await check(pool, f);
    assert.ok(tampered.ruleIds.includes("DIGEST_MISMATCH"));
  }));

test("P2-02.T03 stale snapshot, revoked epoch, wrong recipient/runbook/quote and missing reservation each deny with a rule ID", async () => {
  const cases: [
    string,
    (pool: Pool, f: SignedFixture) => Promise<ChainReader | null | void>,
  ][] = [
    [
      "CHAIN_SNAPSHOT_STALE",
      async () => freshChain({ timestamp: BigInt(now - 16) }),
    ],
    ["CHAIN_SNAPSHOT_STALE", async () => null],
    ["PERMIT_EPOCH", async () => freshChain({ epoch: 1n })],
    ["WALLET_PAUSED", async () => freshChain({ paused: true })],
    ["DUPLICATE_REQUEST", async () => freshChain({ requestUsed: true })],
    [
      "RECIPIENT_DENIED",
      async (pool, f) => {
        await pool.query(
          "UPDATE permit_drafts SET scope=jsonb_set(scope,'{providerBindings}','[]') WHERE id=$1",
          [f.draftId],
        );
      },
    ],
    [
      "RUNBOOK_VERSION",
      async (pool, f) => {
        await pool.query(
          "UPDATE tasks SET runbook_id='scheduled-pay' WHERE id=$1",
          [f.taskId],
        );
      },
    ],
    [
      "QUOTE_EXPIRED",
      async (pool, f) => {
        await pool.query(
          "UPDATE actions SET invoice=jsonb_set(invoice,'{expiresAt}',to_jsonb($2::text)) WHERE id=$1",
          [f.actionId, String(now - 1)],
        );
      },
    ],
    [
      "RESERVATION_MISSING",
      async (pool, f) => {
        await pool.query(
          "UPDATE reservations SET state='UNKNOWN' WHERE action_id=$1",
          [f.actionId],
        );
      },
    ],
    [
      "PERMIT_INACTIVE",
      async (pool, f) => {
        await pool.query(
          "UPDATE permits SET authority_state='REVOKED' WHERE permit_id=$1",
          [f.permitId],
        );
      },
    ],
    [
      "WALLET_FROZEN",
      async (pool, f) => {
        await pool.query("UPDATE wallets SET frozen=true WHERE id=$1", [
          f.walletId,
        ]);
      },
    ],
    [
      "ATTEMPT_MISMATCH",
      async (pool, f) => {
        await pool.query(
          "UPDATE signing_attempts SET state='UNKNOWN' WHERE id=$1",
          [f.attemptId],
        );
      },
    ],
  ];
  for (const [rule, mutate] of cases)
    await withFixture(async (pool, f) => {
      const chain = await mutate(pool, f);
      const decision = await check(
        pool,
        f,
        chain === undefined ? freshChain() : chain,
      );
      assert.equal(decision.allowed, false, rule);
      assert.ok(
        decision.ruleIds.includes(rule),
        `${rule} not in ${decision.ruleIds}`,
      );
    });
});

test("P2-02.T04 deposits without a fresh NORMAL signal and a sixth proposal per minute deny", async () => {
  await withFixture(
    async (pool, f) => {
      assert.ok((await check(pool, f)).ruleIds.includes("STALE_SIGNAL"));
    },
    { operation: 2 },
  );
  await withFixture(async (pool, f) => {
    for (let i = 0; i < 5; i++)
      await pool.query(
        "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,state,created_at,updated_at) SELECT gen_random_uuid(),task_id,wallet_id,permit_id,'extra'||$2,'0x'||md5($2)||md5($2||'r'),'0x'||md5($2||'i')||md5($2||'j'),0,asset,1,0,action,'0x'||md5($2||'d')||md5($2||'e'),'DENIED',$3,$3 FROM actions WHERE id=$1",
        [f.actionId, String(i), now - 10],
      );
    assert.ok((await check(pool, f)).ruleIds.includes("PROPOSAL_RATE"));
  });
});

test("P2-02.T05 forged owner or provider signatures, missing manifest and unauthenticated callers deny", async () => {
  await withFixture(async (pool, f) => {
    await pool.query(
      "UPDATE permits SET owner_signature=$2 WHERE permit_id=$1",
      [f.permitId, "0x" + "22".repeat(64) + "1b"],
    );
    assert.ok((await check(pool, f)).ruleIds.includes("PERMIT_SIGNATURE"));
  });
  await withFixture(async (pool, f) => {
    const forged = await f.owner.signTypedData({
      domain: {
        name: "MandateInvoice",
        version: "2",
        chainId: 84532,
        verifyingContract: f.wallet,
      },
      types: { X: [{ name: "x", type: "uint256" }] },
      primaryType: "X",
      message: { x: 1n },
    });
    await pool.query("UPDATE actions SET provider_signature=$2 WHERE id=$1", [
      f.actionId,
      forged,
    ]);
    assert.ok((await check(pool, f)).ruleIds.includes("PROVIDER_SIGNATURE"));
  });
  await withFixture(async (pool, f) => {
    assert.ok(
      (await check(pool, f, freshChain(), null)).ruleIds.includes(
        "MANIFEST_UNAVAILABLE",
      ),
    );
    const app = createPolicyServer(
      new PolicyService(pool, f.manifest, freshChain(), () => now),
      "t".repeat(32),
    );
    const body = {
      actionId: f.actionId,
      attemptId: f.attemptId,
      message: f.message,
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/internal/policy/check",
          payload: body,
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/internal/policy/check",
          payload: body,
          headers: { authorization: "Bearer " + "x".repeat(32) },
        })
      ).statusCode,
      401,
    );
    const ok = await app.inject({
      method: "POST",
      url: "/internal/policy/check",
      payload: body,
      headers: { authorization: "Bearer " + "t".repeat(32) },
    });
    assert.equal(ok.json().allowed, true);
    await app.close();
  });
});
