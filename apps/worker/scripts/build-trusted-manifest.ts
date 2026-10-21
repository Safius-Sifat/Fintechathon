// Builds the trusted S1 deployment manifest for one environment from real inputs:
// Person1's deployment record, the signer's public identities, the evidence key,
// provider addresses and content hashes of the committed runbook, rule and tool
// sources. Prints no secret; refuses to write an invalid manifest.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getAddress } from "viem";
import {
  DeploymentManifestSchema,
  hashCanonical,
  RUNBOOK_IDS,
} from "@mandate/schema";
import { evidenceKey } from "@mandate/platform";
import { MCP_TOOLS } from "../../mcp/src/tools.js";

const root = resolve(import.meta.dirname, "../../..");
const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
};
const sha256 = (...parts: Buffer[]) =>
  "0x" +
  parts.reduce((h, p) => h.update(p), createHash("sha256")).digest("hex");
const file = (path: string) => readFile(join(root, path));
const json = async (path: string) =>
  JSON.parse((await readFile(path, "utf8")).toString());

const origin = env("MANIFEST_ORIGIN");
const deployment = await json(join(root, "evidence/person1/deployment.json"));
const mpcDir = env("MPC_PRIVATE_DIR");
const initiator = (
  await json(join(mpcDir, "initiator/mandate-adapter-a.identity.json"))
).public_key;
const authorizer = (
  await json(
    join(mpcDir, "authorizer/mandate-policy-v1.authorizer.identity.json"),
  )
).public_key;
const runtime = (await readFile(env("RUNTIME_ENV_FILE"), "utf8")).split("\n");
const evidenceSeed = runtime
  .find((l) => l.startsWith("EVIDENCE_KEY="))
  ?.slice("EVIDENCE_KEY=".length)
  .trim();
if (!evidenceSeed)
  throw new Error("EVIDENCE_KEY missing from the runtime env file");
const usdc = {
  address: getAddress(env("USDC_ADDRESS")),
  codeHash: env("USDC_CODE_HASH"),
};

const lock = await file("pnpm-lock.yaml");
const validators = await file("packages/runbooks/src/validators.ts");
const output = await file("packages/schema/src/provider.ts");
const entries: Record<
  (typeof RUNBOOK_IDS)[number],
  { path: string; kind: number }
> = {
  "browser-check": { path: "packages/runbooks/src/browser.ts", kind: 0 },
  "liquidity-keeper": { path: "packages/runbooks/src/liquidity.ts", kind: 1 },
  "scheduled-pay": { path: "packages/runbooks/src/schedule.ts", kind: 2 },
  "service-allowance": { path: "packages/runbooks/src/advance.ts", kind: 3 },
  "commerce-buy": { path: "packages/runbooks/src/commerce.ts", kind: 0 },
};
const runbooks = await Promise.all(
  RUNBOOK_IDS.map(async (runbookId) => ({
    schemaVersion: 4,
    runbookId,
    kind: entries[runbookId].kind,
    version: "1.0.0",
    entryArtifactHash: sha256(await file(entries[runbookId].path)),
    inputSchemaHash: sha256(validators),
    outputSchemaHash: sha256(output),
    validatorArtifactHash: sha256(
      validators,
      await file("packages/runbooks/src/advance.ts"),
    ),
    dependencyLockHash: sha256(lock),
  })),
);
const token = deployment.contracts.token;
const dusd = {
  address: getAddress(token.address),
  codeHash: token.codeHash,
  decimals: 6,
  symbol: "DUSD",
};
const ref = (c: {
  address: string;
  deploymentBlock: string;
  codeHash: string;
}) => ({
  address: getAddress(c.address),
  deploymentBlock: c.deploymentBlock,
  codeHash: c.codeHash,
});

const manifest = DeploymentManifestSchema.parse({
  schemaVersion: 4,
  walletDomainVersion: "5",
  loginDomainVersion: "2",
  invoiceDomainVersion: "2",
  chainId: 84532,
  sourceTag: env("SOURCE_TAG"),
  contracts: {
    factory: ref(deployment.contracts.factory),
    token: ref(token),
    vault: ref(deployment.contracts.vault),
    anchor: ref(deployment.contracts.anchor),
    walletImplementation: null,
  },
  providers: [
    {
      providerId: "a",
      recipient: getAddress(env("PROVIDER_A_ADDRESS")),
      capabilities: ["pageLoad", "title"],
    },
    {
      providerId: "b",
      recipient: getAddress(env("PROVIDER_B_ADDRESS")),
      capabilities: ["pageLoad", "title", "formSubmit"],
    },
    {
      providerId: "shop",
      recipient: getAddress(env("SHOP_ADDRESS")),
      capabilities: ["order"],
    },
  ],
  targets: ["checkout-healthy", "checkout-broken"].map((targetId) => ({
    targetId,
    url: `${origin}/targets/${targetId}/`,
    expectedTitle: "Checkout",
  })),
  origins: { api: origin, provider: origin },
  mpc: {
    engine: "mpcium",
    commit: "90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2",
    thresholdConfig: 1,
    nodeCount: 3,
    requiredParticipants: 2,
    deploymentMode: "competition-poc-single-vm-three-containers",
    initiatorPublicKey: "0x" + initiator,
    authorizerPublicKey: "0x" + authorizer,
  },
  evidence: {
    ed25519PublicKey: evidenceKey(Buffer.from(evidenceSeed, "hex"))
      .publicKeyHex,
    publisher: getAddress(deployment.config.anchorPublisher),
  },
  runbooks,
  supportedTokens: [
    { chainId: 84532, ...dusd, transferMode: "STANDARD_ERC20" },
    {
      chainId: 84532,
      ...usdc,
      decimals: 6,
      symbol: "USDC",
      transferMode: "STANDARD_ERC20",
    },
  ],
  agentAssets: [dusd, { ...usdc, decimals: 6, symbol: "USDC" }],
  screening: {
    listId: "demo-screening-v1",
    listHash: hashCanonical(
      await json(join(root, "services/policy/rules/demo-screening-v1.json")),
    ),
  },
  riskRules: {
    version: "risk-rules-v1",
    hash: hashCanonical(
      await json(join(root, "services/policy/rules/risk-rules-v1.json")),
    ),
  },
  x402: { mode: "MANDATE_NATIVE", facilitator: null, gatePassed: false },
  agent: {
    runtime: "openai-agents-sdk",
    sdkVersion: (await json(join(root, "apps/agent/package.json")))
      .dependencies["@openai/agents"],
    model: "gpt-5.6-luna",
    mcpToolsetHash: hashCanonical(MCP_TOOLS),
  },
  dependencyPins: {
    mpcium: "90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2",
    node: "22.23.3",
    pnpm: "10.20.0",
  },
});
await writeFile(env("MANIFEST_OUT"), JSON.stringify(manifest, null, 2) + "\n", {
  mode: 0o644,
});
console.log("Trusted manifest written:", env("MANIFEST_OUT"));
