import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyBundleSync,
  computeExitCode,
} from "../src/index.js";
import {
  type EvidenceBundle,
  ZERO_HASH,
} from "@mandate/schema";
import { type Hex } from "viem";

function buildSampleBundle(): EvidenceBundle {
  const dummyWallet = "0x7777777777777777777777777777777777777777";
  const dummyTaskId = "11111111-1111-4111-8111-111111111111";
  const dummyChainTaskId = ("0x" + "aa".repeat(32)) as Hex;
  const dummyEventHash0 = ("0x" + "01".repeat(32)) as Hex;
  const dummyEventHash1 = ("0x" + "02".repeat(32)) as Hex;

  return {
    manifest: {
      schemaVersion: 4,
      chainId: 84532,
      wallet: dummyWallet,
      taskId: dummyTaskId,
      chainTaskId: dummyChainTaskId,
      inspection: {
        fromBlock: "100",
        toBlock: "120",
      },
      publicKeys: {
        evidence: ("0x" + "ee".repeat(32)) as Hex,
      },
      retainedHashes: [],
      anchorTxHash: null,
    },
    events: [
      {
        schemaVersion: 4,
        eventId: "22222222-2222-4222-8222-222222222221",
        taskId: dummyTaskId,
        chainTaskId: dummyChainTaskId,
        wallet: dummyWallet,
        sequence: 0,
        recordedAt: "1700000000",
        type: "TASK_CREATED",
        requestId: null,
        permitId: null,
        payload: { status: "initialized" },
        prevHash: ZERO_HASH as Hex,
        eventHash: dummyEventHash0,
      },
      {
        schemaVersion: 4,
        eventId: "22222222-2222-4222-8222-222222222222",
        taskId: dummyTaskId,
        chainTaskId: dummyChainTaskId,
        wallet: dummyWallet,
        sequence: 1,
        recordedAt: "1700000010",
        type: "DELIVERY_RECEIVED",
        requestId: null,
        permitId: null,
        payload: {
          result: {
            schemaVersion: 4,
            targetId: "checkout-healthy",
            inputHash: ("0x" + "11".repeat(32)) as Hex,
            checkedAt: "1700000010",
            checks: {
              pageLoad: true,
              title: { actual: "Checkout", expected: "Checkout", pass: true },
              formSubmit: true,
            },
            screenshotHash: ("0x" + "22".repeat(32)) as Hex,
            logHash: ("0x" + "33".repeat(32)) as Hex,
          },
        },
        prevHash: dummyEventHash0,
        eventHash: dummyEventHash1,
      },
    ],
    checkpoint: {
      schemaVersion: 4,
      chainId: 84532,
      wallet: dummyWallet,
      taskId: dummyChainTaskId,
      sequence: 1,
      headHash: dummyEventHash1,
    },
    checkpointSig: ("0x" + "ff".repeat(64)) as any,
    authority: {
      permit: {
        taskId: dummyChainTaskId,
        executor: "0x3333333333333333333333333333333333333333",
        kind: 0,
        asset: "0x2222222222222222222222222222222222222222",
        runbookHash: ZERO_HASH as Hex,
        conditionsHash: ZERO_HASH as Hex,
        recipientsHash: ZERO_HASH as Hex,
        scheduleHash: ZERO_HASH as Hex,
        templatesHash: ZERO_HASH as Hex,
        issuedAt: "1700000000",
        startsAt: "1700000000",
        expiresAt: "1700086400",
        epoch: "1",
        nonce: "1",
        maxActions: 5,
        maxPayments: 3,
        maxPayment: "500000",
        spendCap: "1000000",
        liquidFloor: "0",
        depositCap: "0",
        withdrawCap: "0",
        reviewThreshold: "500000",
        periodCap: "0",
        periodSeconds: 0,
      },
    },
    transactions: [
      {
        txHash: ("0x" + "99".repeat(32)) as Hex,
        status: "CONFIRMED",
        confirmations: 5,
        amount: "200000",
      },
    ],
    artifactIndex: [],
    artifacts: {},
  };
}

test("verifier: verifies authentic bundle and returns all PASS", () => {
  const bundle = buildSampleBundle();
  const report = verifyBundleSync(bundle);

  assert.equal(report.schemaVersion, 4);
  assert.equal(report.findings.length, 6);
  for (const finding of report.findings) {
    assert.equal(finding.state, "PASS", `Expected ${finding.name} to PASS`);
  }
  assert.equal(computeExitCode(report), 0);
});

test("verifier: detects tampered event hash and fails integrity with exit code 1", () => {
  const bundle = buildSampleBundle();
  // Tamper second event's prevHash
  bundle.events[1]!.prevHash = ("0x" + "bad0".repeat(16)) as Hex;

  const report = verifyBundleSync(bundle);
  const integrityFinding = report.findings.find((f) => f.name === "integrity");
  assert.equal(integrityFinding?.state, "FAIL");
  assert.equal(computeExitCode(report), 1);
});

test("verifier: reports PENDING for unconfirmed transactions with exit code 2", () => {
  const bundle = buildSampleBundle();
  bundle.transactions[0]!.confirmations = 1; // fewer than 3 confirmations

  const report = verifyBundleSync(bundle);
  const settlementFinding = report.findings.find((f) => f.name === "settlement");
  assert.equal(settlementFinding?.state, "PENDING");
  assert.equal(computeExitCode(report), 2);
});

test("verifier: catches spendCap violation and fails policy with exit code 1", () => {
  const bundle = buildSampleBundle();
  bundle.transactions[0]!.amount = "2000000"; // exceeds spendCap 1000000

  const report = verifyBundleSync(bundle);
  const policyFinding = report.findings.find((f) => f.name === "policy");
  assert.equal(policyFinding?.state, "FAIL");
  assert.equal(computeExitCode(report), 1);
});
