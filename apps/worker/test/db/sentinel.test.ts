import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashCanonical } from "@mandate/schema";
import { RiskRulesSchema, runSentinel } from "../../src/sentinel.js";
import { admin, isolatedSchema } from "./support.js";
import { seedAction, seedTaskWithPermit, seedWallet } from "./fixtures.js";

after(() => admin.end());

test("P2-A03.T03 three denials within ten minutes inhibit the wallet, record RISK_ALERT and push once", async () => {
  const db = await isolatedSchema("sentinel");
  try {
    const raw = JSON.parse(
      await readFile(
        new URL(
          "../../../../services/policy/rules/risk-rules-v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const rules = RiskRulesSchema.parse(raw);
    const rulesHash = hashCanonical(raw);
    const now = 1793000000;
    const { walletId, owner } = await seedWallet(db.pool, now);
    await db.pool.query("UPDATE wallets SET wallet_address=$2 WHERE id=$1", [
      walletId,
      "0x" + "44".repeat(20),
    ]);
    const ids = await seedTaskWithPermit(db.pool, walletId, now, {
      spendCap: 1_000_000n,
      maxPayment: 400_000n,
    });
    const deny = async (at: number) => {
      const id = await seedAction(db.pool, { walletId, ...ids }, 1n, at);
      await db.pool.query(
        "UPDATE actions SET state='DENIED',denial_code='POLICY_VIOLATION',updated_at=$2 WHERE id=$1",
        [id, at],
      );
    };
    await deny(now - 700);
    await deny(now - 100);
    assert.deepEqual(
      await runSentinel(db.pool, rules, rulesHash, null, now),
      [],
    );
    await deny(now - 50);
    // Two denials inside the window: below the threshold of three.
    assert.deepEqual(
      await runSentinel(db.pool, rules, rulesHash, null, now),
      [],
    );
    await deny(now - 20);
    const alerts = await runSentinel(db.pool, rules, rulesHash, null, now);
    assert.equal(alerts.length, 1);
    assert.deepEqual(
      await runSentinel(db.pool, rules, rulesHash, null, now + 1),
      [],
    );
    assert.equal(
      (
        await db.pool.query("SELECT inhibited FROM wallets WHERE id=$1", [
          walletId,
        ])
      ).rows[0].inhibited,
      true,
    );
    const alert = (
      await db.pool.query("SELECT kind,details FROM financial_alerts")
    ).rows[0];
    assert.equal(alert.kind, "RISK");
    assert.equal(alert.details.rulesHash, rulesHash);
    assert.equal(alert.details.recommendation, "FREEZE");
    assert.deepEqual(
      (await db.pool.query("SELECT type FROM evidence_events")).rows.map(
        (r) => r.type,
      ),
      ["RISK_ALERT"],
    );
    assert.deepEqual(
      (await db.pool.query("SELECT kind,state FROM push_deliveries")).rows,
      [{ kind: "ALERT", state: "NO_DEVICE" }],
    );
  } finally {
    await db.drop();
  }
});
