import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encodeFunctionData, getAddress, parseEther, type Address } from "viem";
import {
  buildTypedData,
  mandateWalletAbi,
  walletFactoryAbi,
  WalletViewSchema,
} from "@mandate/schema";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import { admin, apiEnvironment, ownerA, ownerB } from "./support.js";
import { anvilAccount, forkChain } from "../../../worker/test/db/support.js";
import { DEFAULT_BUDGETS, Relayer } from "../../../worker/src/relayer.js";
import { OwnerTransferRelay } from "../../../worker/src/owner-transfer.js";

const FACTORY = getAddress(deployment.contracts.factory.address);
let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain?.close();
  await admin.end();
});

async function setup() {
  const e = await apiEnvironment({
    clock: () => Math.floor(Date.now() / 1000),
    business: { chain: { client: chain.client, assets: [] } },
  });
  const a = await e.login(ownerA);
  const walletId = WalletViewSchema.parse(
    (await e.call("POST", "/v1/wallets", a, {})).json(),
  ).walletId;
  let wallet = await chain.client.readContract({
    address: FACTORY,
    abi: walletFactoryAbi,
    functionName: "walletForOwner",
    args: [ownerA.address],
  });
  if (/^0x0{40}$/i.test(wallet)) {
    const sender = anvilAccount(5);
    const fees = await chain.client.estimateFeesPerGas();
    await chain.client.sendRawTransaction({
      serializedTransaction: await sender.signTransaction({
        chainId: 84532,
        type: "eip1559",
        to: FACTORY,
        data: encodeFunctionData({
          abi: walletFactoryAbi,
          functionName: "createWallet",
          args: [ownerA.address],
        }),
        nonce: await chain.client.getTransactionCount({
          address: sender.address,
          blockTag: "pending",
        }),
        gas: 6_000_000n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      }),
    });
    await chain.mine(1);
    wallet = await chain.client.readContract({
      address: FACTORY,
      abi: walletFactoryAbi,
      functionName: "walletForOwner",
      args: [ownerA.address],
    });
  }
  // Provisioning is covered by the worker suite; here the wallet row is marked READY.
  await e.pool.query(
    "UPDATE wallets SET provisioning_state='READY',wallet_address=$2,deployment_block=1,code_hash=$3,mpc_wallet_id=gen_random_uuid(),executor_address=$4,executor_public_key=$5,key_version=1 WHERE id=$1",
    [
      walletId,
      wallet.toLowerCase(),
      "0x" + "11".repeat(32),
      "0x" + "22".repeat(20),
      "0x04" + randomBytes(64).toString("hex"),
    ],
  );
  const relayer = new Relayer(
    e.pool,
    chain.client,
    84532,
    { emergency: { account: anvilAccount(6), ...DEFAULT_BUDGETS.emergency } },
    () => Math.floor(Date.now() / 1000),
  );
  await relayer.register();
  const relay = new OwnerTransferRelay(e.pool, chain.client, relayer, () =>
    Math.floor(Date.now() / 1000),
  );
  const draft = async (
    amount: string,
    recipient: Address = "0x000000000000000000000000000000000000dEaD",
  ) => {
    const r = await e.call(
      "POST",
      `/v1/wallets/${walletId}/owner-transfers/draft`,
      a,
      {
        asset: "0x0000000000000000000000000000000000000000",
        recipient,
        amount,
      },
    );
    assert.equal(r.statusCode, 200, r.body);
    return r.json() as {
      draftId: string;
      typedData: { message: Record<string, string>; domain: unknown };
    };
  };
  const sign = (d: Awaited<ReturnType<typeof draft>>, signer = ownerA) =>
    signer.signTypedData(
      buildTypedData(
        "OwnerTransfer",
        d.typedData.message,
        d.typedData.domain,
      ) as never,
    );
  const submit = (draftId: string, ownerSignature: string, auth = a) =>
    e.call("POST", `/v1/wallets/${walletId}/owner-transfers/submit`, auth, {
      draftId,
      ownerSignature,
    });
  const runRelay = async (draftId: string) => {
    let state = "";
    for (let i = 0; i < 10 && !["INCLUDED", "REVERTED"].includes(state); i++) {
      state = await relay.advance(draftId);
      await chain.mine(1);
    }
    return state;
  };
  const epochOf = () =>
    chain.client.readContract({
      address: wallet,
      abi: mandateWalletAbi,
      functionName: "authorityEpoch",
    });
  const pausedOf = () =>
    chain.client.readContract({
      address: wallet,
      abi: mandateWalletAbi,
      functionName: "paused",
    });
  return {
    e,
    a,
    walletId,
    wallet,
    draft,
    sign,
    submit,
    runRelay,
    epochOf,
    pausedOf,
  };
}

test("P2-W03 owner transfer: duplicate submit is one operation, foreign/agent/wrong-signer denied, success pauses and advances the epoch", async () => {
  const s = await setup();
  try {
    await chain.rpc("anvil_setBalance", [
      s.wallet,
      "0x" + parseEther("1").toString(16),
    ]);
    const before = await chain.client.getBalance({
      address: "0x000000000000000000000000000000000000dEaD",
    });
    const epoch = await s.epochOf();
    const d = await s.draft("1000");
    // Preparation inhibits agent work immediately.
    assert.equal(
      (
        await s.e.pool.query("SELECT inhibited FROM wallets WHERE id=$1", [
          s.walletId,
        ])
      ).rows[0].inhibited,
      true,
    );
    // P2-W03.T02: agent token, other owner, signature by another key.
    const agent = (
      await s.e.call("POST", "/v1/agent-tokens", s.a, {
        walletId: s.walletId,
        taskId: null,
        scopes: ["read", "run"],
        expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
      })
    ).json() as { token: string };
    assert.equal(
      (await s.submit(d.draftId, await s.sign(d), "Bearer " + agent.token))
        .statusCode,
      403,
    );
    assert.equal(
      (await s.submit(d.draftId, await s.sign(d), await s.e.login(ownerB)))
        .statusCode,
      403,
    );
    assert.equal(
      (await s.submit(d.draftId, await s.sign(d, ownerB))).statusCode,
      422,
    );
    // P2-W03.T01: same signature three times is one operation; another signature conflicts.
    const sig = await s.sign(d);
    const results = await Promise.all([
      s.submit(d.draftId, sig),
      s.submit(d.draftId, sig),
      s.submit(d.draftId, sig),
    ]);
    for (const r of results) assert.equal(r.statusCode, 200, r.body);
    assert.equal(new Set(results.map((r) => r.body)).size, 1);
    assert.equal(
      (await s.submit(d.draftId, await s.sign(d, ownerB))).statusCode,
      409,
    );
    assert.equal(
      (
        await s.e.pool.query(
          "SELECT 1 FROM jobs WHERE kind='owner_transfer.relay'",
        )
      ).rowCount,
      1,
    );
    assert.equal(await s.runRelay(d.draftId), "INCLUDED");
    assert.equal(
      (await chain.client.getBalance({
        address: "0x000000000000000000000000000000000000dEaD",
      })) - before,
      1000n,
    );
    assert.equal(await s.epochOf(), epoch + 1n);
    assert.equal(await s.pausedOf(), true);
    const row = (
      await s.e.pool.query(
        "SELECT paused,epoch::text FROM wallets WHERE id=$1",
        [s.walletId],
      )
    ).rows[0];
    assert.deepEqual(row, { paused: true, epoch: (epoch + 1n).toString() });
    assert.equal(
      (
        await s.e.pool.query(
          "SELECT 1 FROM transactions WHERE purpose='OWNER_TRANSFER'",
        )
      ).rowCount,
      1,
    );
  } finally {
    await s.e.close();
  }
});

test("P2-W03.T02/T03 stale epoch is refused before relay; a reverting transfer is not reported as paused or sent", async () => {
  const s = await setup();
  try {
    await chain.rpc("anvil_setBalance", [
      s.wallet,
      "0x" + parseEther("1").toString(16),
    ]);
    const stale = await s.draft("1");
    const first = await s.draft("2");
    await s.submit(first.draftId, await s.sign(first));
    assert.equal(await s.runRelay(first.draftId), "INCLUDED");
    assert.equal(
      (await s.submit(stale.draftId, await s.sign(stale))).statusCode,
      409,
    );

    const epoch = await s.epochOf();
    await chain.rpc("anvil_setBalance", [s.wallet, "0x0"]);
    const big = await s.draft(parseEther("5").toString());
    assert.equal(
      (await s.submit(big.draftId, await s.sign(big))).statusCode,
      200,
    );
    assert.equal(await s.runRelay(big.draftId), "REVERTED");
    assert.equal(await s.epochOf(), epoch);
    assert.equal(
      (
        await s.e.pool.query(
          "SELECT epoch::text,inhibited FROM wallets WHERE id=$1",
          [s.walletId],
        )
      ).rows[0].epoch,
      epoch.toString(),
    );
    assert.equal(
      (
        await s.e.pool.query("SELECT inhibited FROM wallets WHERE id=$1", [
          s.walletId,
        ])
      ).rows[0].inhibited,
      true,
    );
  } finally {
    await s.e.close();
  }
});
