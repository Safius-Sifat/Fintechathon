import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { getAddress, keccak256, type Address, type Hex } from "viem";
import {
  appendEvent,
  checkpoint,
  evidenceKey,
  transaction,
} from "@mandate/platform";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import { DEFAULT_BUDGETS, Relayer } from "../../src/relayer.js";
import { Anchorer, AnchorUnavailable } from "../../src/anchor.js";
import { admin, anvilAccount, forkChain, isolatedSchema } from "./support.js";
import { seedWallet } from "./fixtures.js";

let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain?.close();
  await admin.end();
});

const deployed = {
  address: getAddress(deployment.contracts.anchor.address),
  deploymentBlock: deployment.contracts.anchor.deploymentBlock,
  codeHash: deployment.contracts.anchor.codeHash as Hex,
};
const PUBLISHER = deployment.config.anchorPublisher.toLowerCase().slice(2);

async function setup() {
  const db = await isolatedSchema("anchor");
  const now = Math.floor(Date.now() / 1000);
  const signer = anvilAccount(4);
  const relayer = new Relayer(
    db.pool,
    chain.client,
    84532,
    { anchor: { account: signer, ...DEFAULT_BUDGETS.anchor } },
    () => now,
  );
  await relayer.register();
  const { walletId } = await seedWallet(db.pool, now);
  const taskId = randomUUID();
  await db.pool.query(
    "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,runbook_state,created_at,updated_at) VALUES($1,$2,$3,'browser-check','fixture','{}','RUNNING','ACTIVE','{\"schemaVersion\":4}',$4,$4)",
    [taskId, "0x" + randomBytes(32).toString("hex"), walletId, now],
  );
  await transaction(db.pool, async (c) => {
    await appendEvent(
      c,
      { taskId, type: "ACTION_INCLUDED", dedupeKey: "a", payload: {} },
      now,
    );
    await checkpoint(c, evidenceKey(randomBytes(32)), taskId, now);
  });
  return { ...db, relayer, signer, taskId, now };
}

test("P2-05.T04 the deployed anchor refuses a non-publisher lane before anything is journaled", async () => {
  const e = await setup();
  try {
    const anchorer = new Anchorer(
      e.pool,
      chain.client,
      e.relayer,
      deployed,
      () => e.now,
    );
    await assert.rejects(anchorer.submit(e.taskId, 0), AnchorUnavailable);
    assert.equal(
      (await e.pool.query("SELECT 1 FROM transactions")).rowCount,
      0,
    );
    assert.equal(
      (await e.pool.query("SELECT anchor_state FROM checkpoints")).rows[0]
        .anchor_state,
      "UNANCHORED",
    );
  } finally {
    await e.drop();
  }
});

test("P2-05.T04 anchoring through a local copy of the anchor code reaches INCLUDED only with the matching Anchored event", async () => {
  const e = await setup();
  try {
    // Local fixture: the deployed runtime code with only its immutable publisher replaced.
    const code = (await chain.client.getCode({ address: deployed.address }))!;
    assert.ok(code.includes(PUBLISHER));
    const patched = code.replaceAll(
      PUBLISHER,
      e.signer.address.toLowerCase().slice(2),
    ) as Hex;
    const local = getAddress("0x" + randomBytes(20).toString("hex")) as Address;
    await chain.rpc("anvil_setCode", [local, patched]);
    const anchorer = new Anchorer(
      e.pool,
      chain.client,
      e.relayer,
      { address: local, deploymentBlock: "0", codeHash: keccak256(patched) },
      () => e.now,
    );
    const txId = await anchorer.submit(e.taskId, 0);
    assert.equal(await anchorer.submit(e.taskId, 0), txId);
    assert.equal(await anchorer.reconcile(e.taskId, 0), "SUBMITTED");
    await chain.mine(3);
    assert.equal(await anchorer.reconcile(e.taskId, 0), "INCLUDED");
    const cp = (await e.pool.query("SELECT digest,checkpoint FROM checkpoints"))
      .rows[0];
    const stored = await chain.client.readContract({
      address: local,
      abi: (await import("@mandate/schema")).evidenceAnchorAbi,
      functionName: "checkpointOf",
      args: [cp.checkpoint.taskId, 0n],
    });
    assert.equal(stored, cp.digest);
    // The anchor transaction is not an event in the checkpoint it anchors.
    assert.equal(
      (await e.pool.query("SELECT 1 FROM evidence_events")).rowCount,
      1,
    );
  } finally {
    await e.drop();
  }
});
