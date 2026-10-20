import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { parseEther, type Hex } from "viem";
import {
  ActivityPageSchema,
  ApiErrorSchema,
  WalletViewSchema,
} from "@mandate/schema";
import { admin, apiEnvironment, ownerA, ownerB } from "./support.js";
import { anvilAccount, forkChain } from "../../../worker/test/db/support.js";

let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain.close();
  await admin.end();
});

async function sendEth(
  from: ReturnType<typeof anvilAccount> | typeof ownerA,
  to: `0x${string}`,
): Promise<Hex> {
  const fees = await chain.client.estimateFeesPerGas();
  const hash = await chain.client.sendRawTransaction({
    serializedTransaction: await from.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to,
      value: 1n,
      nonce: await chain.client.getTransactionCount({
        address: from.address,
        blockTag: "pending",
      }),
      gas: 21000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    }),
  });
  await chain.mine(1);
  return hash;
}

async function withApi(
  run: (e: Awaited<ReturnType<typeof apiEnvironment>>) => Promise<void>,
) {
  const e = await apiEnvironment({
    business: { chain: { client: chain.client, assets: [] } },
  });
  try {
    await run(e);
  } finally {
    await e.close();
  }
}

test("P2-W02.T06 activity is owner-path only; unrelated hashes are refused and registration is idempotent", () =>
  withApi(async (e) => {
    const a = await e.login(ownerA);
    const b = await e.login(ownerB);
    const path = `/v1/accounts/${ownerA.address}/activity`;
    const page = ActivityPageSchema.parse(
      (await e.call("GET", path, a)).json(),
    );
    // No backfill yet: coverage says NOT_STARTED, never a verified empty history.
    assert.deepEqual(page.coverage.backfillState, "NOT_STARTED");
    assert.equal(page.items.length, 0);
    const foreign = await e.call("GET", path, b);
    assert.equal(foreign.statusCode, 403);
    assert.equal(ApiErrorSchema.parse(foreign.json()).code, "AUTH_SCOPE");
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", a, {})).json(),
    ).walletId;
    const agent = (
      await e.call("POST", "/v1/agent-tokens", a, {
        walletId,
        taskId: null,
        scopes: ["read", "evidence"],
        expiresAt: String(e.now() + 3600),
      })
    ).json() as { token: string };
    assert.equal(
      (await e.call("GET", path, "Bearer " + agent.token)).statusCode,
      403,
    );

    await chain.rpc("anvil_setBalance", [
      ownerA.address,
      "0x" + parseEther("1").toString(16),
    ]);
    const unrelated = await sendEth(
      anvilAccount(5),
      "0x000000000000000000000000000000000000dEaD",
    );
    const own = await sendEth(
      ownerA,
      "0x000000000000000000000000000000000000dEaD",
    );
    const register = (txHash: string, clientRequestId: string, auth = a) =>
      e.call("POST", `/v1/accounts/${ownerA.address}/transactions`, auth, {
        txHash,
        clientRequestId,
      });
    const refused = await register(unrelated, randomUUID());
    assert.equal(refused.statusCode, 422);
    assert.equal(
      (await register("0x" + randomBytes(32).toString("hex"), randomUUID()))
        .statusCode,
      422,
    );
    assert.equal((await register(own, randomUUID(), b)).statusCode, 403);
    const id = randomUUID();
    const first = await register(own, id);
    assert.equal(first.statusCode, 200, first.body);
    assert.deepEqual(first.json(), {
      activityId: `personal:${own}:tx`,
      state: "SUBMITTED",
    });
    assert.deepEqual((await register(own, id)).json(), first.json());
    assert.equal((await register(unrelated, id)).statusCode, 422);
    const other = await sendEth(
      ownerA,
      "0x000000000000000000000000000000000000bEEF",
    );
    assert.equal((await register(other, id)).statusCode, 409);
    assert.equal(
      (await e.pool.query("SELECT 1 FROM registered_transactions")).rowCount,
      1,
    );
    assert.equal(
      (await e.pool.query("SELECT 1 FROM jobs WHERE kind='history.register'"))
        .rowCount,
      1,
    );
    // A registration is a tracking reference; it creates no verified activity by itself.
    assert.equal(
      (await e.pool.query("SELECT 1 FROM activity_events")).rowCount,
      0,
    );
  }));

test("P2-W02 activity pages are stable and coverage reports failure with its gaps", () =>
  withApi(async (e) => {
    const a = await e.login(ownerA);
    const owner = ownerA.address.toLowerCase();
    for (let i = 0; i < 60; i++)
      await e.pool.query(
        "INSERT INTO activity_events(activity_id,owner_address,source,category,tx_hash,log_index,block_number,asset,from_address,to_address,amount,state,provenance,observed_at) VALUES($1,$2,'PERSONAL','INCOMING',$3,0,$4,$5,$5,$2,1,'INCLUDED','RPC_VERIFIED',1)",
        [
          "personal:" + i,
          owner,
          "0x" + randomBytes(32).toString("hex"),
          100 + (i % 7),
          "0x" + "00".repeat(20),
        ],
      );
    await e.pool.query(
      "INSERT INTO history_coverage(owner_address,source,account,from_block,to_block,indexed_through,backfill_state,gaps,updated_at) VALUES($1,'PERSONAL',$1,10,200,200,'COMPLETE','[]',1),($1,'MANAGED',$1,50,200,NULL,'FAILED','[{\"fromBlock\":\"50\",\"toBlock\":\"200\"}]',1)",
      [owner],
    );
    const path = `/v1/accounts/${ownerA.address}/activity`;
    const first = ActivityPageSchema.parse(
      (await e.call("GET", path, a)).json(),
    );
    assert.equal(first.items.length, 50);
    assert.ok(first.nextCursor);
    const second = ActivityPageSchema.parse(
      (await e.call("GET", `${path}?cursor=${first.nextCursor}`, a)).json(),
    );
    assert.equal(second.items.length, 10);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.activityId)).size,
      60,
    );
    assert.deepEqual(first.coverage, {
      fromBlock: "10",
      toBlock: "200",
      indexedThrough: null,
      backfillState: "FAILED",
      gaps: [{ fromBlock: "50", toBlock: "200" }],
    });
    assert.equal(
      (await e.call("GET", `${path}?cursor=not-json`, a)).statusCode,
      422,
    );
  }));
