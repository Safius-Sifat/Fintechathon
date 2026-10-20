import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { crc32 } from "node:zlib";
import {
  buildTypedData,
  canonicalJson,
  deliveryDomain,
  hashCanonical,
  ZERO_HASH,
  type EvidenceBundle,
} from "@mandate/schema";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  bundleFromZip,
  computeExitCode,
  verifyBundle,
  type ChainReader,
} from "../src/index.js";

// Public Anvil test keys only: #0 is the fixture wallet owner, #2 provider A.
const OWNER = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const PROVIDER = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
);
const permitVector = JSON.parse(
  readFileSync(resolve("../schema/fixtures/permit-v7.json"), "utf8"),
).valid[0];
const WALLET = permitVector.domain.verifyingContract as Hex;
const CHAIN_TASK = permitVector.message.taskId as Hex;
const TASK = "11111111-1111-4111-8111-111111111111";
const TX = ("0x" + "56".repeat(32)) as Hex;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const INVOICE = ("0x" + "12".repeat(32)) as Hex;
const INPUT = hashCanonical({
  targetId: "checkout-healthy",
  checks: ["pageLoad"],
});

const keys = generateKeyPairSync("ed25519");
const evidenceKey =
  `0x${keys.publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex")}` as Hex;

async function signedDelivery() {
  const result = {
    schemaVersion: 4 as const,
    targetId: "checkout-healthy" as const,
    inputHash: INPUT,
    checkedAt: "1793000100",
    checks: { pageLoad: true },
    screenshotHash: ("0x" + "31".repeat(32)) as Hex,
    logHash: ("0x" + "32".repeat(32)) as Hex,
  };
  const receipt = {
    invoiceId: INVOICE,
    requestId: REQUEST,
    inputHash: INPUT,
    resultHash: hashCanonical(result),
    paymentTxHash: TX,
    completedAt: "1793000100",
  };
  const providerSignature = await PROVIDER.signTypedData(
    buildTypedData("DeliveryReceipt", receipt, deliveryDomain(WALLET)) as never,
  );
  return { result, receipt, providerSignature, artifacts: [] };
}

async function buildBundle(): Promise<EvidenceBundle> {
  const delivery = await signedDelivery();
  const bodies = [
    { type: "TASK_CREATED", payload: { goal: "check" } },
    { type: "RESULT_DELIVERED", payload: { delivery } },
  ];
  let prev = ZERO_HASH as string;
  const events = bodies.map((b, i) => {
    const rest = {
      schemaVersion: 4 as const,
      eventId: `22222222-2222-4222-8222-22222222222${i}`,
      taskId: TASK,
      chainTaskId: CHAIN_TASK,
      wallet: WALLET,
      sequence: i,
      recordedAt: String(1793000000 + i),
      type: b.type,
      requestId: null,
      permitId: null,
      payload: b.payload,
      prevHash: prev as Hex,
    };
    const eventHash = hashCanonical(rest);
    prev = eventHash;
    return { ...rest, eventHash };
  });
  const checkpoint = {
    schemaVersion: 4 as const,
    chainId: 84532 as const,
    wallet: WALLET,
    taskId: CHAIN_TASK,
    sequence: 1,
    headHash: prev as Hex,
  };
  const checkpointSig = `0x${sign(null, Buffer.from(canonicalJson(checkpoint)), keys.privateKey).toString("hex")}`;
  return {
    manifest: {
      schemaVersion: 4,
      chainId: 84532,
      wallet: WALLET,
      taskId: TASK,
      chainTaskId: CHAIN_TASK,
      inspection: { fromBlock: "1", toBlock: "100" },
      publicKeys: { evidence: evidenceKey },
      retainedHashes: [],
      anchorTxHash: ("0x" + "77".repeat(32)) as Hex,
    },
    events,
    checkpoint,
    checkpointSig,
    authority: {
      permit: permitVector.message,
      owner_signature: permitVector.signature,
    },
    transactions: [{ txHash: TX, requestId: REQUEST, state: "INCLUDED" }],
    artifactIndex: [],
    artifacts: {},
  } as unknown as EvidenceBundle;
}

const actionAbi = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
]);

function chain(
  opts: {
    owner?: Hex;
    amount?: bigint;
    depth?: bigint;
    reverted?: boolean;
  } = {},
): ChainReader {
  const payLog = {
    address: WALLET,
    topics: encodeEventTopics({
      abi: actionAbi,
      eventName: "ActionExecuted",
      args: { permitId: ("0x" + "01".repeat(32)) as Hex, requestId: REQUEST },
    }) as Hex[],
    data: encodeAbiParameters(
      [
        { type: "uint8" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bool" },
      ],
      [
        0,
        "0x2222222222222222222222222222222222222222",
        PROVIDER.address,
        opts.amount ?? 200000n,
        0n,
        INVOICE,
        INPUT,
        ("0x" + "02".repeat(32)) as Hex,
        false,
      ],
    ),
  };
  return {
    async getBlockNumber() {
      return 100n + (opts.depth ?? 3n) - 1n;
    },
    async getTransactionReceipt({ hash }) {
      if (hash === TX)
        return {
          status: opts.reverted ? "reverted" : "success",
          blockNumber: 100n,
          to: WALLET,
          logs: [payLog],
        };
      return { status: "success", blockNumber: 90n, to: null, logs: [] };
    },
    async readContract() {
      return opts.owner ?? OWNER.address;
    },
  };
}

const states = (r: { findings: { name: string; state: string }[] }) =>
  Object.fromEntries(r.findings.map((f) => [f.name, f.state]));

test("verifier: a genuine bundle passes everything except completion", async () => {
  const report = await verifyBundle(await buildBundle(), {
    trustedEvidenceKey: evidenceKey,
    chain: chain(),
  });
  assert.deepEqual(states(report), {
    integrity: "PASS",
    authority: "PASS",
    policy: "PASS",
    settlement: "PASS",
    delivery: "PASS",
    completion: "UNVERIFIABLE",
  });
  assert.equal(computeExitCode(report), 2);
});

test("verifier: without a trusted key or RPC nothing claims PASS", async () => {
  const report = await verifyBundle(await buildBundle());
  for (const f of report.findings) {
    assert.notEqual(f.state, "PASS", f.name);
    assert.ok(!f.basis.includes("chain"), f.name);
  }
});

test("verifier: an edited event fails integrity", async () => {
  const b = await buildBundle();
  (b.events[0]!.payload as Record<string, unknown>).goal = "changed";
  const report = await verifyBundle(b, {
    trustedEvidenceKey: evidenceKey,
    chain: chain(),
  });
  assert.equal(states(report).integrity, "FAIL");
  assert.equal(computeExitCode(report), 1);
});

test("verifier: a checkpoint signed by another key fails integrity", async () => {
  const other = generateKeyPairSync("ed25519");
  const otherKey =
    `0x${other.publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex")}` as Hex;
  const report = await verifyBundle(await buildBundle(), {
    trustedEvidenceKey: otherKey,
    chain: chain(),
  });
  assert.equal(states(report).integrity, "FAIL");
});

test("verifier: a permit not signed by the on-chain owner fails authority", async () => {
  const report = await verifyBundle(await buildBundle(), {
    trustedEvidenceKey: evidenceKey,
    chain: chain({ owner: PROVIDER.address }),
  });
  assert.equal(states(report).authority, "FAIL");
});

test("verifier: chain state decides settlement and policy", async () => {
  const b = await buildBundle();
  const k = { trustedEvidenceKey: evidenceKey };
  assert.equal(
    states(await verifyBundle(b, { ...k, chain: chain({ reverted: true }) }))
      .settlement,
    "FAIL",
  );
  assert.equal(
    states(await verifyBundle(b, { ...k, chain: chain({ depth: 1n }) }))
      .settlement,
    "PENDING",
  );
  assert.equal(
    states(await verifyBundle(b, { ...k, chain: chain({ amount: 600000n }) }))
      .policy,
    "FAIL",
  );
});

test("verifier: a delivery whose result was changed fails", async () => {
  const b = await buildBundle();
  const payload = b.events[1]!.payload as {
    delivery: { result: { checks: object } };
  };
  payload.delivery.result.checks = { pageLoad: false };
  // Re-hash the events so integrity still holds and only delivery is wrong.
  let prev = ZERO_HASH as string;
  for (const e of b.events) {
    const { eventHash: _old, ...rest } = e;
    rest.prevHash = prev as Hex;
    e.prevHash = prev as Hex;
    e.eventHash = hashCanonical(rest);
    prev = e.eventHash;
  }
  const report = await verifyBundle(b, { chain: chain() });
  assert.equal(states(report).delivery, "FAIL");
});

test("verifier: reads the stored ZIP the export writes", async () => {
  const b = await buildBundle();
  const files: [string, Buffer][] = [
    ["manifest.json", Buffer.from(JSON.stringify(b.manifest))],
    [
      "events.jsonl",
      Buffer.from(b.events.map((e) => canonicalJson(e)).join("\n") + "\n"),
    ],
    ["checkpoint.json", Buffer.from(canonicalJson(b.checkpoint))],
    ["checkpoint.sig", Buffer.from(b.checkpointSig)],
    ["authority.json", Buffer.from(JSON.stringify(b.authority))],
    ["transactions.json", Buffer.from(JSON.stringify(b.transactions))],
    ["artifact-index.json", Buffer.from("[]")],
  ];
  const parts: Buffer[] = [];
  for (const [name, data] of files) {
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6);
    h.writeUInt32LE(crc32(data) >>> 0, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(Buffer.byteLength(name), 26);
    parts.push(h, Buffer.from(name), data);
  }
  const loaded = bundleFromZip(Buffer.concat(parts));
  const report = await verifyBundle(loaded, {
    trustedEvidenceKey: evidenceKey,
    chain: chain(),
  });
  assert.equal(states(report).integrity, "PASS");
  assert.throws(() =>
    bundleFromZip(
      Buffer.concat([parts[0]!, Buffer.from("../evil.json"), files[0]![1]]),
    ),
  );
});
