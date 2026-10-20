import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { walletFactoryAbi } from "@mandate/schema";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import { DEFAULT_BUDGETS, Relayer } from "../../src/relayer.js";
import { Provisioner, type Keygen } from "../../src/provision.js";
import { admin, anvilAccount, forkChain, isolatedSchema } from "./support.js";

let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain?.close();
  await admin.end();
});

const factory = {
  address: getAddress(deployment.contracts.factory.address),
  deploymentBlock: deployment.contracts.factory.deploymentBlock,
  codeHash: deployment.contracts.factory.codeHash as Hex,
};

// Local stand-in for the adapter's DKG ceremony; returns a fixture public key.
function fixtureKeygen(
  script: ("PENDING" | "DONE" | "FAILED" | "MALFORMED")[],
) {
  const key = privateKeyToAccount(generatePrivateKey());
  const calls: string[] = [];
  const keygen: Keygen = {
    async generate(id) {
      calls.push(id);
      const next = script.shift() ?? "DONE";
      if (next === "PENDING") return { state: "PENDING" };
      if (next === "FAILED")
        return { state: "FAILED", reason: "quorum unavailable" };
      if (next === "MALFORMED") return { state: "DONE", publicKey: "0x1234" };
      return { state: "DONE", publicKey: key.publicKey };
    },
  };
  return { keygen, calls, executor: key.address.toLowerCase() };
}

async function setup(keygen: Keygen | null, factoryRef = factory) {
  const db = await isolatedSchema("prov");
  let now = Math.floor(Date.now() / 1000);
  const relayer = new Relayer(
    db.pool,
    chain.client,
    84532,
    { normal: { account: anvilAccount(6), ...DEFAULT_BUDGETS.normal } },
    () => now,
  );
  await relayer.register();
  const owner = privateKeyToAccount(generatePrivateKey()).address;
  const walletId = randomUUID();
  await db.pool.query(
    "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
    [owner.toLowerCase(), now],
  );
  await db.pool.query(
    "INSERT INTO wallets(id,owner_address,provisioning_state,created_at,updated_at) VALUES($1,$2,'DEPLOYING',$3,$3)",
    [walletId, owner.toLowerCase(), now],
  );
  const provisioner = new Provisioner(
    db.pool,
    chain.client,
    relayer,
    factoryRef,
    keygen,
    () => now,
  );
  const wallet = async () =>
    (await db.pool.query("SELECT * FROM wallets WHERE id=$1", [walletId]))
      .rows[0];
  return {
    ...db,
    provisioner,
    owner,
    walletId,
    wallet,
    advance: (s: number) => (now += s),
  };
}

const predicted = (owner: Address) =>
  chain.client.readContract({
    address: factory.address,
    abi: walletFactoryAbi,
    functionName: "predictWallet",
    args: [owner],
  });

test("P2-03.T03 provisioning journals one factory deployment, survives restarts and resumes keygen without a new address", async () => {
  const k = fixtureKeygen(["PENDING", "DONE"]);
  const e = await setup(k.keygen);
  try {
    assert.deepEqual(await e.provisioner.step(e.walletId), {
      state: "DEPLOYING",
      waiting: "factory deployment confirmation",
    });
    // A restart before confirmation re-reads the journal; it never journals a second deployment.
    assert.equal((await e.provisioner.step(e.walletId)).state, "DEPLOYING");
    assert.equal(
      (
        await e.pool.query(
          "SELECT 1 FROM transactions WHERE purpose='CREATE_WALLET'",
        )
      ).rowCount,
      1,
    );
    assert.equal((await e.wallet()).wallet_address, null);
    await chain.mine(3);
    assert.deepEqual(await e.provisioner.step(e.walletId), {
      state: "KEYGEN",
      waiting: "MPC keygen in progress",
    });
    const keygenWallet = await e.wallet();
    assert.equal(
      keygenWallet.wallet_address,
      (await predicted(e.owner)).toLowerCase(),
    );
    assert.equal(keygenWallet.executor_address, null);
    // The keygen retry uses the same planned MPC wallet ID.
    assert.equal((await e.provisioner.step(e.walletId)).state, "READY");
    assert.deepEqual(k.calls, [
      keygenWallet.mpc_wallet_id,
      keygenWallet.mpc_wallet_id,
    ]);
    const ready = await e.wallet();
    assert.equal(ready.wallet_address, keygenWallet.wallet_address);
    assert.equal(ready.executor_address, k.executor);
    assert.ok(BigInt(ready.deployment_block) > BigInt(factory.deploymentBlock));
    assert.match(ready.code_hash, /^0x[0-9a-f]{64}$/);
    assert.equal((await e.provisioner.step(e.walletId)).state, "READY");
  } finally {
    await e.drop();
  }
});

test("P2-03.T03 a wallet deployed outside the journal (lost response) is discovered, not deployed twice", async () => {
  const k = fixtureKeygen(["DONE"]);
  const e = await setup(k.keygen);
  try {
    const sender = anvilAccount(7);
    const fees = await chain.client.estimateFeesPerGas();
    const raw = await sender.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to: factory.address,
      data: encodeFunctionData({
        abi: walletFactoryAbi,
        functionName: "createWallet",
        args: [e.owner],
      }),
      nonce: await chain.client.getTransactionCount({
        address: sender.address,
        blockTag: "pending",
      }),
      gas: 6_000_000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    await chain.client.sendRawTransaction({ serializedTransaction: raw });
    await chain.mine(3);
    assert.equal((await e.provisioner.step(e.walletId)).state, "READY");
    assert.equal(
      (await e.pool.query("SELECT 1 FROM transactions")).rowCount,
      0,
    );
    assert.equal(
      (await e.wallet()).wallet_address,
      (await predicted(e.owner)).toLowerCase(),
    );
  } finally {
    await e.drop();
  }
});

test("P2-03.T04 wrong factory code, keygen failure, malformed key and missing keygen never reach READY", async () => {
  const wrong = await setup(fixtureKeygen(["DONE"]).keygen, {
    ...factory,
    codeHash: ("0x" + "00".repeat(32)) as Hex,
  });
  try {
    assert.equal(
      (await wrong.provisioner.step(wrong.walletId)).state,
      "FAILED",
    );
    const row = await wrong.wallet();
    assert.equal(row.wallet_address, null);
    assert.match(row.failure_reason, /deployment manifest/);
    assert.equal(
      (await wrong.pool.query("SELECT 1 FROM transactions")).rowCount,
      0,
    );
  } finally {
    await wrong.drop();
  }
  for (const [script, reason] of [
    [["FAILED"], /keygen failed/],
    [["MALFORMED"], /malformed public key/],
  ] as const) {
    const e = await setup(fixtureKeygen([...script]).keygen);
    try {
      await e.provisioner.step(e.walletId);
      await chain.mine(3);
      assert.equal((await e.provisioner.step(e.walletId)).state, "FAILED");
      const row = await e.wallet();
      assert.match(row.failure_reason, reason);
      assert.equal(row.executor_address, null);
    } finally {
      await e.drop();
    }
  }
  const none = await setup(null);
  try {
    await none.provisioner.step(none.walletId);
    await chain.mine(3);
    assert.deepEqual(await none.provisioner.step(none.walletId), {
      state: "KEYGEN",
      waiting: "MPC keygen ceremony is not configured",
    });
  } finally {
    await none.drop();
  }
  const k = fixtureKeygen(["DONE"]);
  const mismatch = await setup(k.keygen);
  try {
    await mismatch.provisioner.step(mismatch.walletId);
    await chain.mine(3);
    await mismatch.provisioner.step(mismatch.walletId);
    // A resumed ceremony that yields a different executor than the recorded one fails.
    await mismatch.pool.query(
      "UPDATE wallets SET provisioning_state='KEYGEN',executor_address=$2 WHERE id=$1",
      [mismatch.walletId, "0x" + "ab".repeat(20)],
    );
    assert.equal(
      (await mismatch.provisioner.step(mismatch.walletId)).state,
      "FAILED",
    );
    assert.match(
      (await mismatch.wallet()).failure_reason,
      /does not match the recorded executor/,
    );
  } finally {
    await mismatch.drop();
  }
});
