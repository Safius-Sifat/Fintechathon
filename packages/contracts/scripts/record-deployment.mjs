// P1-06: independently reads a Deploy.s.sol run back over RPC and writes the deployment record.
// Usage: RPC_URL=... node scripts/record-deployment.mjs <broadcast run json> <config json> <out json>
// Aborts unless the chain is 84532, every receipt succeeded, each runtime equals the compiled
// artifact (immutables and library self-addresses masked), the factory's stored wallet code equals
// the linked MandateWallet creation code and the constructor wiring equals the approved config.
// The RPC URL is never written to the record (it may contain an API key).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createPublicClient, http, keccak256, getAddress } from "viem";

const CHAIN_ID = 84532;
const CONTRACTS = {
  DemoUSD: "token",
  DemoVault: "vault",
  EvidenceAnchor: "anchor",
  WalletFactory: "factory",
};
const LIBRARIES = [
  "PermitTermsLib",
  "WalletPolicyLib",
  "VaultLib",
  "AssetsLib",
  "ActivationLib",
  "CallTemplateLib",
  "X402Lib",
];

const [runPath, configPath, outPath] = process.argv.slice(2);
const rpcUrl = process.env.RPC_URL;
if (!runPath || !configPath || !outPath || !rpcUrl)
  throw new Error(
    "usage: RPC_URL=... record-deployment.mjs <run.json> <config.json> <out.json>",
  );

const run = JSON.parse(readFileSync(runPath, "utf8"));
const config = JSON.parse(readFileSync(configPath, "utf8"));
const client = createPublicClient({ transport: http(rpcUrl) });
const artifact = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../out/${name}.sol/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const abi = (name) =>
  JSON.parse(
    readFileSync(new URL(`../abi/${name}.json`, import.meta.url), "utf8"),
  );
const fail = (message) => {
  throw new Error(`record-deployment: ${message}`);
};

const chainId = await client.getChainId();
if (chainId !== CHAIN_ID || config.chainId !== CHAIN_ID)
  fail(`chain ${chainId}, expected ${CHAIN_ID}`);

const hex = (s) => s.slice(2);
const mask = (code, ranges) => {
  const bytes = Buffer.from(hex(code), "hex");
  for (const { start, length } of ranges) bytes.fill(0, start, start + length);
  return bytes.toString("hex");
};
// Fills library placeholders (__$..$__) with the addresses deployed in this run.
const link = ({ object, linkReferences }) => {
  let code = hex(object);
  for (const libs of Object.values(linkReferences ?? {}))
    for (const [lib, places] of Object.entries(libs))
      for (const { start, length } of places)
        code =
          code.slice(0, start * 2) +
          hex(deployed[lib].address).toLowerCase() +
          code.slice((start + length) * 2);
  return `0x${code}`;
};

// Forge deploys linked libraries through the CREATE2 deployer, so both kinds are deployments.
const creates = run.transactions.filter(
  (t) => t.transactionType === "CREATE" || t.transactionType === "CREATE2",
);
const deployed = {};
for (const tx of creates) {
  const name = tx.contractName;
  if (!CONTRACTS[name] && !LIBRARIES.includes(name))
    fail(`unexpected deployment ${name}`);
  if (deployed[name]) fail(`${name} deployed twice in one run`);
  const receipt = await client.getTransactionReceipt({ hash: tx.hash });
  if (receipt.status !== "success")
    fail(`${name} transaction ${tx.hash} failed`);
  const address = getAddress(tx.contractAddress);
  if (
    tx.transactionType === "CREATE" &&
    getAddress(receipt.contractAddress) !== address
  )
    fail(`${name} address differs from broadcast record`);
  const code = await client.getCode({ address });
  if (!code || code === "0x") fail(`${name} has no code at ${address}`);
  deployed[name] = {
    address,
    deploymentBlock: receipt.blockNumber.toString(),
    transactionHash: tx.hash,
    codeHash: keccak256(code),
    code,
  };
}
for (const name of [...Object.keys(CONTRACTS), ...LIBRARIES])
  if (!deployed[name]) fail(`${name} missing from run`);
for (const [name, d] of Object.entries(deployed)) {
  const { deployedBytecode } = artifact(name);
  const ranges = Object.values(
    deployedBytecode.immutableReferences ?? {},
  ).flat();
  if (mask(d.code, ranges) !== mask(link(deployedBytecode), ranges))
    fail(`${name} runtime differs from compiled artifact`);
}

// The factory keeps the wallet creation code in two data contracts (runtime 0x00 || data); their
// addresses are its last two immutables. Rebuild the linked creation code and compare.
const factoryArtifact = artifact("WalletFactory");
const refs = Object.entries(
  factoryArtifact.deployedBytecode.immutableReferences,
).sort(([x], [y]) => Number(x) - Number(y));
const immutableAddress = ([, [r]]) =>
  getAddress(
    `0x${hex(deployed.WalletFactory.code).slice(r.start * 2 + 24, (r.start + r.length) * 2)}`,
  );
const [codeA, codeB] = refs.slice(-2).map(immutableAddress);
const stored = (
  await Promise.all(
    [codeA, codeB].map((address) => client.getCode({ address })),
  )
)
  .map((c) => hex(c).slice(2))
  .join("");
const wallet = hex(link(artifact("MandateWallet").bytecode)).toLowerCase();
if (stored.toLowerCase() !== wallet)
  fail("factory wallet code differs from linked MandateWallet creation code");

const read = (name, functionName) =>
  client.readContract({
    address: deployed[name].address,
    abi: abi(name),
    functionName,
  });
const expect = async (label, actual, expected) => {
  if (getAddress(await actual) !== getAddress(expected))
    fail(`${label} is not ${expected}`);
};
await expect(
  "vault.asset",
  read("DemoVault", "asset"),
  deployed.DemoUSD.address,
);
await expect(
  "anchor.publisher",
  read("EvidenceAnchor", "publisher"),
  config.anchorPublisher,
);
await expect(
  "factory.token",
  read("WalletFactory", "token"),
  deployed.DemoUSD.address,
);
await expect("factory.usdc", read("WalletFactory", "usdc"), config.usdc);
await expect(
  "factory.vault",
  read("WalletFactory", "vault"),
  deployed.DemoVault.address,
);

const settings = factoryArtifact.metadata.settings;
const ref = ({ address, deploymentBlock, codeHash }) => ({
  address,
  deploymentBlock,
  codeHash,
});
const record = {
  chainId,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceClean:
    execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim() === "",
  deployer: getAddress(
    creates.find((t) => t.contractName === "DemoUSD").transaction.from,
  ),
  compiler: {
    solc: factoryArtifact.metadata.compiler.version,
    viaIR: settings.viaIR,
    optimizer: settings.optimizer,
    evmVersion: settings.evmVersion,
  },
  config: {
    usdc: getAddress(config.usdc),
    anchorPublisher: getAddress(config.anchorPublisher),
  },
  contracts: Object.fromEntries(
    Object.entries(CONTRACTS).map(([name, key]) => [key, ref(deployed[name])]),
  ),
  libraries: Object.fromEntries(
    LIBRARIES.map((name) => [name, ref(deployed[name])]),
  ),
  walletCode: {
    storage: [codeA, codeB],
    creationCodeHash: keccak256(`0x${wallet}`),
  },
  transactions: Object.fromEntries(
    Object.entries(deployed).map(([name, d]) => [name, d.transactionHash]),
  ),
};
writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(
  `deployment verified: ${Object.keys(deployed).length} contracts; record written to ${outPath}`,
);
