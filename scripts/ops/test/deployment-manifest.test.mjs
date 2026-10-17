import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_NAMES,
  fromBroadcast,
  verifyManifest,
} from "../deployment-manifest.mjs";
function fixture() {
  const txHash = "0x" + "a".repeat(64),
    blockHash = "0x" + "b".repeat(64),
    codeHash = "0x" + "c".repeat(64);
  const contracts = { walletImplementation: null },
    transactions = {};
  for (const [i, role] of Object.keys(CONTRACT_NAMES).entries()) {
    contracts[role] = {
      address: "0x" + String(i + 1).padStart(40, "0"),
      deploymentBlock: "10",
      codeHash,
    };
    transactions[role] = txHash;
  }
  const manifest = { schemaVersion: 4, chainId: 84532, contracts };
  const dependencies = {
    hash: () => codeHash,
    validate: () => {},
    rpc: async (method, params) => {
      if (method === "eth_chainId") return "0x14a34";
      if (method === "eth_getBlockByNumber")
        return { number: "0x10", hash: blockHash };
      if (method === "eth_getCode") return "0x1234";
      if (method === "eth_getTransactionReceipt")
        return {
          status: "0x1",
          contractAddress: contracts.factory.address,
          blockNumber: "0xa",
          blockHash,
        };
      throw Error("Unexpected RPC");
    },
  };
  // Each receipt is selected by its distinct transaction hash.
  const receipts = {};
  for (const [i, role] of Object.keys(CONTRACT_NAMES).entries()) {
    const h = "0x" + String(i + 1).repeat(64);
    transactions[role] = h;
    receipts[h] = {
      status: "0x1",
      contractAddress: contracts[role].address,
      blockNumber: "0xa",
      blockHash,
    };
  }
  const original = dependencies.rpc;
  dependencies.rpc = async (m, p) =>
    m === "eth_getTransactionReceipt" ? receipts[p[0]] : original(m, p);
  return { manifest, transactions, dependencies, receipts };
}
test("OPS-CHAIN-01 observes receipts, finality and historical/current bytecode", async () => {
  const f = fixture();
  assert.equal(
    await verifyManifest(f.manifest, f.transactions, f.dependencies),
    f.manifest,
  );
});
test("OPS-CHAIN-02 wrong chain or substituted bytecode rejected", async () => {
  const f = fixture();
  const rpc = f.dependencies.rpc;
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, {
      ...f.dependencies,
      rpc: async (m, p) => (m === "eth_chainId" ? "0x1" : rpc(m, p)),
    }),
    /WRONG_CHAIN/,
  );
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, {
      ...f.dependencies,
      hash: () => "0x" + "d".repeat(64),
    }),
    /CODE_MISMATCH/,
  );
});
test("OPS-CHAIN-03 failed or unfinalized deployment cannot become an address manifest", async () => {
  const f = fixture();
  f.receipts[f.transactions.factory].status = "0x0";
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, f.dependencies),
    /RECEIPT_INVALID/,
  );
  f.receipts[f.transactions.factory].status = "0x1";
  const rpc = f.dependencies.rpc;
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, {
      ...f.dependencies,
      rpc: async (m, p) =>
        m === "eth_getBlockByNumber" && p[0] === "finalized"
          ? { number: "0x9" }
          : rpc(m, p),
    }),
    /NOT_FINALIZED/,
  );
});
test("OPS-CHAIN-04 broadcast must uniquely bind each named deployment", async () => {
  const f = fixture();
  const transactions = Object.entries(CONTRACT_NAMES).map(
    ([role, contractName]) => ({
      transactionType: "CREATE",
      contractName,
      hash: f.transactions[role],
      contractAddress: f.manifest.contracts[role].address,
    }),
  );
  const result = await fromBroadcast(
    { schemaVersion: 4, chainId: 84532 },
    { transactions },
    f.dependencies,
  );
  assert.deepEqual(result.manifest, f.manifest);
  assert.deepEqual(result.transactions, f.transactions);
  await assert.rejects(
    fromBroadcast(
      {},
      { transactions: [...transactions, transactions[0]] },
      f.dependencies,
    ),
    /EXACTLY_ONE/,
  );
});
test("OPS-CHAIN-05 shared schema failures and reorgs block release", async () => {
  const f = fixture();
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, {
      ...f.dependencies,
      validate: () => {
        throw Error("schema invalid");
      },
    }),
    /schema invalid/,
  );
  const rpc = f.dependencies.rpc;
  await assert.rejects(
    verifyManifest(f.manifest, f.transactions, {
      ...f.dependencies,
      rpc: async (m, p) =>
        m === "eth_getBlockByNumber" && p[0] !== "finalized"
          ? { hash: "changed" }
          : rpc(m, p),
    }),
    /REORG/,
  );
});
