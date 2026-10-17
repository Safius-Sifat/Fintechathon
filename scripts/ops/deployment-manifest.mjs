import { readFile, writeFile, rename } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export const CONTRACT_NAMES = {
  factory: "WalletFactory",
  token: "DemoUSD",
  vault: "DemoVault",
  anchor: "EvidenceAnchor",
};
const hashPattern = /^0x[a-fA-F0-9]{64}$/;
export async function verifyManifest(
  manifest,
  transactions,
  { rpc, hash, validate },
) {
  validate(manifest);
  if (
    manifest.schemaVersion !== 4 ||
    manifest.chainId !== 84532 ||
    manifest.contracts.walletImplementation !== null
  )
    throw Error("MANIFEST_NETWORK_OR_VERSION");
  if ((await rpc("eth_chainId", [])) !== "0x14a34")
    throw Error("RPC_WRONG_CHAIN");
  const finalized = await rpc("eth_getBlockByNumber", ["finalized", false]);
  if (!finalized?.number) throw Error("FINALITY_UNAVAILABLE");
  for (const name of Object.keys(CONTRACT_NAMES)) {
    const entry = manifest.contracts[name];
    if (
      !entry ||
      !/^0x[a-fA-F0-9]{40}$/.test(entry.address) ||
      /^0x0{40}$/i.test(entry.address) ||
      !hashPattern.test(entry.codeHash) ||
      !/^\d+$/.test(entry.deploymentBlock) ||
      !hashPattern.test(transactions[name] ?? "")
    )
      throw Error("DEPLOYMENT_FIELDS_INVALID:" + name);
    const receipt = await rpc("eth_getTransactionReceipt", [
      transactions[name],
    ]);
    if (
      !receipt ||
      receipt.status !== "0x1" ||
      receipt.contractAddress?.toLowerCase() !== entry.address.toLowerCase() ||
      BigInt(receipt.blockNumber) !== BigInt(entry.deploymentBlock)
    )
      throw Error("DEPLOYMENT_RECEIPT_INVALID:" + name);
    if (BigInt(receipt.blockNumber) > BigInt(finalized.number))
      throw Error("DEPLOYMENT_NOT_FINALIZED:" + name);
    const block = await rpc("eth_getBlockByNumber", [
      receipt.blockNumber,
      false,
    ]);
    if (block?.hash !== receipt.blockHash)
      throw Error("DEPLOYMENT_REORG:" + name);
    for (const height of [receipt.blockNumber, "latest"]) {
      const code = await rpc("eth_getCode", [entry.address, height]);
      if (
        !code ||
        code === "0x" ||
        hash(code).toLowerCase() !== entry.codeHash.toLowerCase()
      )
        throw Error("DEPLOYMENT_CODE_MISMATCH:" + name);
    }
  }
  return manifest;
}
export async function fromBroadcast(config, broadcast, { rpc, hash }) {
  const contracts = { walletImplementation: null };
  const transactions = {};
  for (const [role, name] of Object.entries(CONTRACT_NAMES)) {
    const matches = (broadcast.transactions ?? []).filter(
      (t) => t.transactionType === "CREATE" && t.contractName === name,
    );
    if (matches.length !== 1)
      throw Error("DEPLOYMENT_MUST_CREATE_EXACTLY_ONE:" + name);
    const tx = matches[0];
    const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
    if (
      !receipt ||
      receipt.status !== "0x1" ||
      receipt.contractAddress?.toLowerCase() !==
        tx.contractAddress?.toLowerCase()
    )
      throw Error("BROADCAST_RECEIPT_INVALID:" + name);
    const code = await rpc("eth_getCode", [
      receipt.contractAddress,
      receipt.blockNumber,
    ]);
    contracts[role] = {
      address: receipt.contractAddress,
      deploymentBlock: BigInt(receipt.blockNumber).toString(),
      codeHash: hash(code),
    };
    transactions[role] = tx.hash;
  }
  return { manifest: { ...config, contracts }, transactions };
}
async function main() {
  const [mode, recordPath, outputPath] = process.argv.slice(2);
  if (!["create", "verify"].includes(mode) || !recordPath || !outputPath)
    throw Error("MANIFEST_ARGUMENTS");
  if (!process.env.BASE_SEPOLIA_RPC_URL)
    throw Error("RPC_CONFIGURATION_REQUIRED");
  // Import the actual shared schema. Missing W0 implementation is a deployment blocker.
  const schema = await import("../../packages/schema/src/index.ts");
  if (!schema.DeploymentManifestSchema)
    throw Error(
      "DeploymentManifestSchema is not implemented; complete Person1 W0",
    );
  const require = createRequire(resolve("packages/schema/package.json"));
  const { keccak256 } = require("viem");
  const rpc = async (method, params) => {
    let response;
    try {
      response = await fetch(process.env.BASE_SEPOLIA_RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.error) throw Error();
      return data.result;
    } catch {
      throw Error("RPC_REQUEST_FAILED:" + method);
    }
  };
  const dependencies = {
    rpc,
    hash: keccak256,
    validate: (m) => schema.DeploymentManifestSchema.parse(m),
  };
  let record = JSON.parse(await readFile(recordPath, "utf8"));
  if (mode === "create") {
    const broadcast = JSON.parse(
      await readFile(
        "packages/contracts/broadcast/Deploy.s.sol/84532/run-latest.json",
        "utf8",
      ),
    );
    record = await fromBroadcast(record, broadcast, dependencies);
    // Wait for finalized receipts, not an arbitrary number of seconds treated as finality.
    for (let attempt = 0; ; attempt++) {
      try {
        await verifyManifest(
          record.manifest,
          record.transactions,
          dependencies,
        );
        break;
      } catch (error) {
        if (
          !error.message.startsWith("DEPLOYMENT_NOT_FINALIZED:") ||
          attempt >= 120
        )
          throw error;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    await writeFile(
      recordPath + ".record.tmp",
      JSON.stringify(record, null, 2) + "\n",
    );
    await rename(recordPath + ".record.tmp", recordPath + ".record");
  } else
    await verifyManifest(record.manifest, record.transactions, dependencies);
  await writeFile(
    outputPath + ".tmp",
    JSON.stringify(record.manifest, null, 2) + "\n",
  );
  await rename(outputPath + ".tmp", outputPath);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(
      error.message.startsWith("RPC_")
        ? error.message
        : "Manifest verification failed: " + error.message.slice(0, 180),
    );
    process.exitCode = 1;
  });
