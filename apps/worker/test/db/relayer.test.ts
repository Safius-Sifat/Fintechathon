import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { type Address, type PublicClient } from "viem";
import { transaction } from "@mandate/platform";
import {
  DEFAULT_BUDGETS,
  FeeBudgetExceeded,
  Relayer,
  type LaneName,
} from "../../src/relayer.js";
import { admin, anvilAccount, forkChain, isolatedSchema } from "./support.js";

let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain?.close();
  await admin.end();
});

const recipient = "0x000000000000000000000000000000000000dEaD" as Address;
const value = 1234567n;
const call = { to: recipient, data: "0x" as const, value };

async function setup(
  options: {
    client?: PublicClient;
    budgets?: Partial<typeof DEFAULT_BUDGETS>;
  } = {},
) {
  const db = await isolatedSchema("relay");
  let now = Math.floor(Date.now() / 1000);
  const lanes = Object.fromEntries(
    (["normal", "emergency", "anchor"] as LaneName[]).map((name, i) => [
      name,
      {
        account: anvilAccount(i + 1),
        ...DEFAULT_BUDGETS[name],
        ...options.budgets?.[name],
      },
    ]),
  );
  const relayer = new Relayer(
    db.pool,
    options.client ?? chain.client,
    84532,
    lanes,
    () => now,
  );
  await relayer.register();
  const journal = (lane: LaneName = "normal") =>
    transaction(db.pool, async (c) =>
      relayer.journal(c, lane, call, await relayer.quote(lane, call), {
        purpose: "ANCHOR",
        actionId: null,
        payload: { test: true },
      }),
    );
  return {
    ...db,
    relayer,
    journal,
    advance: (s: number) => {
      now += s;
    },
  };
}
const balance = () => chain.client.getBalance({ address: recipient });

test("P2-04.T02 crash after journal, after broadcast and after inclusion rebroadcasts identical bytes and moves value once", async () => {
  const e = await setup();
  try {
    const start = await balance();
    const tx = await e.journal();
    // Crash point 1: committed journal, nothing broadcast. Restart uses the stored bytes.
    assert.equal(tx.state, "JOURNALED");
    assert.equal(await e.relayer.broadcast(tx.id), "BROADCAST");
    // Crash point 2: broadcast happened but the process died before recording it.
    await e.pool.query(
      "UPDATE transactions SET state='JOURNALED',broadcast_at=NULL WHERE id=$1",
      [tx.id],
    );
    assert.equal(await e.relayer.broadcast(tx.id), "BROADCAST");
    await chain.mine(3);
    const included = await e.relayer.reconcile(tx.id);
    assert.equal(included.tx.state, "INCLUDED");
    assert.equal(included.receipt?.transactionHash, tx.tx_hash);
    // Crash point 3: after inclusion a restart does not resend or create a payment.
    assert.equal(await e.relayer.broadcast(tx.id), "INCLUDED");
    assert.equal((await balance()) - start, value);
    const rows = await e.pool.query(
      "SELECT tx_hash,raw,nonce FROM transactions",
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].raw, tx.raw);
    const lane = await e.pool.query(
      "SELECT next_nonce FROM sender_lanes WHERE lane='normal'",
    );
    assert.equal(BigInt(lane.rows[0].next_nonce), BigInt(tx.nonce) + 1n);
    assert.ok(BigInt(included.tx.actual_fee_wei!) > 0n);
  } finally {
    await e.drop();
  }
});

test("P2-04.T03 RPC accepts the transaction but the response is lost: UNKNOWN, then reconciled without a second payment", async () => {
  // The connection drops after the node accepted the bytes, so the follow-up
  // lookup fails too; it recovers before reconciliation.
  let connected = true;
  const lossy = new Proxy(chain.client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === "sendRawTransaction")
        return async (args: { serializedTransaction: `0x${string}` }) => {
          await target.sendRawTransaction(args);
          connected = false;
          throw new Error("socket hang up");
        };
      if (property === "getTransaction")
        return async (args: { hash: `0x${string}` }) => {
          if (!connected) throw new Error("socket hang up");
          return target.getTransaction(args);
        };
      return value;
    },
  });
  const e = await setup({ client: lossy });
  try {
    const start = await balance();
    const tx = await e.journal();
    assert.equal(await e.relayer.broadcast(tx.id), "UNKNOWN");
    assert.equal((await e.relayer.load(tx.id)).state, "UNKNOWN");
    connected = true;
    await chain.mine(3);
    assert.equal((await e.relayer.reconcile(tx.id)).tx.state, "INCLUDED");
    assert.equal((await balance()) - start, value);
    assert.equal(
      (await e.pool.query("SELECT 1 FROM transactions")).rowCount,
      1,
    );
  } finally {
    await e.drop();
  }
});

test("P2-04.T07 reorg removes a provisional receipt; reconcile reports it and rebroadcasts the same bytes", async () => {
  const e = await setup();
  try {
    const start = await balance();
    const snapshot = await chain.rpc("evm_snapshot");
    const tx = await e.journal();
    await e.relayer.broadcast(tx.id);
    await chain.mine(3);
    const first = await e.relayer.reconcile(tx.id);
    assert.equal(first.tx.state, "INCLUDED");
    await chain.rpc("evm_revert", [snapshot]);
    assert.equal(await balance(), start);
    const reorged = await e.relayer.reconcile(tx.id);
    assert.equal(reorged.reorged, true);
    assert.equal(reorged.tx.block_hash, null);
    assert.equal(reorged.tx.raw, tx.raw);
    await chain.mine(3);
    const again = await e.relayer.reconcile(tx.id);
    assert.equal(again.tx.state, "INCLUDED");
    assert.equal((await balance()) - start, value);
  } finally {
    await e.drop();
  }
});

test("P2-04.T08 exhausted normal fee budget denies new normal work while the emergency lane still journals", async () => {
  const e = await setup({
    budgets: {
      normal: {
        perTxBudgetWei: DEFAULT_BUDGETS.normal.perTxBudgetWei,
        dailyBudgetWei: 1n,
      },
    },
  });
  try {
    await assert.rejects(e.journal("normal"), FeeBudgetExceeded);
    const emergency = await e.journal("emergency");
    assert.equal(emergency.lane, "emergency");
    assert.equal(
      (await e.pool.query("SELECT 1 FROM transactions WHERE lane='normal'"))
        .rowCount,
      0,
    );
    // Nonce is untouched by the denied normal journal.
    const lane = await e.pool.query(
      "SELECT next_nonce FROM sender_lanes WHERE lane='normal'",
    );
    const chainNonce = await chain.client.getTransactionCount({
      address: anvilAccount(1).address,
      blockTag: "pending",
    });
    assert.equal(BigInt(lane.rows[0].next_nonce), BigInt(chainNonce));
    await e.relayer.broadcast(emergency.id);
    await chain.mine(3);
    const done = await e.relayer.reconcile(emergency.id);
    const row = await e.pool.query(
      "SELECT estimated_fee_wei::text,actual_fee_wei::text FROM transactions WHERE id=$1",
      [done.tx.id],
    );
    assert.ok(BigInt(row.rows[0].actual_fee_wei) > 0n);
    assert.ok(
      BigInt(row.rows[0].estimated_fee_wei) >=
        BigInt(row.rows[0].actual_fee_wei),
    );
  } finally {
    await e.drop();
  }
});

test("P2-04 fee replacement keeps the nonce and calldata, retains both hashes and marks the loser REPLACED", async () => {
  const e = await setup();
  try {
    await chain.rpc("evm_setAutomine", [false]);
    const start = await balance();
    const tx = await e.journal();
    await e.relayer.broadcast(tx.id);
    const replacement = await e.relayer.replace(tx.id, call);
    assert.equal(replacement.nonce, tx.nonce);
    assert.equal(replacement.replaces, tx.id);
    assert.notEqual(replacement.tx_hash, tx.tx_hash);
    await e.relayer.broadcast(replacement.id);
    await chain.mine(4);
    const won = await e.relayer.reconcile(replacement.id);
    assert.equal(won.tx.state, "INCLUDED");
    const lineage = await e.pool.query(
      "SELECT id,state FROM transactions ORDER BY journaled_at,id",
    );
    assert.equal(lineage.rowCount, 2);
    assert.equal((await e.relayer.load(tx.id)).state, "REPLACED");
    assert.equal((await balance()) - start, value);
  } finally {
    await chain.rpc("evm_setAutomine", [true]);
    await e.drop();
  }
});

test("P2-04 lane registration refuses a sender whose nonce moved outside the journal", async () => {
  const e = await setup();
  try {
    const account = anvilAccount(1);
    const nonce = await chain.client.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    });
    const fees = await chain.client.estimateFeesPerGas();
    const raw = await account.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to: recipient,
      value: 1n,
      nonce,
      gas: 21000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    await chain.client.sendRawTransaction({ serializedTransaction: raw });
    await assert.rejects(
      e.relayer.register(),
      /nonce advanced outside the journal/,
    );
  } finally {
    await e.drop();
  }
});
