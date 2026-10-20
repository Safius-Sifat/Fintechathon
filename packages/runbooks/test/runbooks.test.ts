import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareTask,
  advanceRunbook,
  validateBrowserResult,
  hashInput,
} from "../src/index.js";
import {
  type RunbookSnapshot,
  INITIAL_RUNBOOK_STATE,
  ZERO_HASH,
} from "@mandate/schema";
import { type Hex } from "viem";

test("prepareTask: prepares valid browser-check task and filters providers", () => {
  // Test with pageLoad + title -> both a and b allowed
  const res1 = prepareTask({
    runbookId: "browser-check",
    input: {
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title"],
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: "1800000000",
    },
  });

  assert.equal(res1.needsOwnerReason, null);
  assert.equal(res1.conditions.runbookId, "browser-check");
  assert.deepEqual(res1.conditions.browser?.providerIds, ["a", "b"]);

  // Test with formSubmit -> only provider b allowed
  const res2 = prepareTask({
    runbookId: "browser-check",
    input: {
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title", "formSubmit"],
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: "1800000000",
    },
  });

  assert.equal(res2.needsOwnerReason, null);
  assert.deepEqual(res2.conditions.browser?.providerIds, ["b"]);

  // Test invalid check ordering or unsupported target
  const res3 = prepareTask({
    runbookId: "browser-check",
    input: {
      targetId: "invalid-target" as any,
      checks: ["title", "pageLoad"] as any, // wrong order
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: "1800000000",
    },
  });
  assert.ok(res3.needsOwnerReason?.includes("Invalid browser-check input"));
});

test("advanceRunbook: browser-check generates deterministic decisionKey and proposals", async () => {
  const prep = prepareTask({
    runbookId: "browser-check",
    input: {
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title"],
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: "1800000000",
    },
  });

  const dummyChainTaskId = ("0x" + "aa".repeat(32)) as Hex;
  const dummyWallet = "0x7777777777777777777777777777777777777777";
  const dummyAsset = "0x2222222222222222222222222222222222222222";

  const snapshot: RunbookSnapshot = {
    taskId: "11111111-1111-4111-8111-111111111111",
    chainTaskId: dummyChainTaskId,
    walletId: "22222222-2222-4222-8222-222222222222",
    walletAddress: dummyWallet,
    permitId: ("0x" + "bb".repeat(32)) as Hex,
    conditions: prep.conditions,
    scope: prep.scope,
    permit: {
      taskId: dummyChainTaskId,
      executor: "0x3333333333333333333333333333333333333333",
      kind: 0,
      asset: dummyAsset,
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
    walletPolicy: {
      policy: {
        epoch: "1",
        nonce: "1",
        reviewThreshold: "500000",
        dailyCap: "1000000",
        weeklyCap: "5000000",
        allowancePeriodCap: "0",
        allowancePeriodSeconds: 0,
        flags: 0,
        issuedAt: "1700000000",
        expiresAt: "1700086400",
        listsHash: ZERO_HASH as Hex,
      },
      lists: {
        recipientsList: [],
        blockedRecipients: [],
        assetCaps: [],
        callTemplates: [],
      },
    },
    now: "1700000100",
    chainBlock: "100",
    wallet: {
      walletAddress: dummyWallet,
      epoch: "1",
      nonce: "1",
      activePermitId: ("0x" + "bb".repeat(32)) as Hex,
      status: "ACTIVE",
    },
    actions: [],
    observations: [],
    agentAnswers: [],
    approvals: [],
    runbookState: INITIAL_RUNBOOK_STATE,
  };

  // Step 1: Initial proposal
  const decision1 = await advanceRunbook(snapshot);
  assert.equal(decision1.type, "PROPOSE");
  assert.equal(decision1.decisionKey, `${dummyChainTaskId}:browser:pay:0`);
  assert.equal(decision1.intent.operation, 0); // PAY
  assert.equal(decision1.intent.amount, "200000"); // Provider A price

  // Calling again with the same snapshot produces the exact same decisionKey and proposal
  const decision2 = await advanceRunbook(snapshot);
  assert.equal(decision2.type, "PROPOSE");
  assert.equal(decision2.decisionKey, decision1.decisionKey);

  // Step 2: Once action is stored and SUBMITTED, advance returns WAIT
  const snapshotWithSubmitted: RunbookSnapshot = {
    ...snapshot,
    actions: [
      {
        decisionKey: decision1.decisionKey,
        action: {
          permitId: snapshot.permitId,
          requestId: ("0x" + "cc".repeat(32)) as Hex,
          operation: 0,
          target: decision1.intent.target,
          amount: decision1.intent.amount,
          minOutput: "0",
          invoiceId: decision1.intent.invoice!.invoiceId,
          inputHash: decision1.intent.inputHash,
          period: 0,
          issuedAt: "1700000100",
          deadline: "1700000700",
        },
        state: "SUBMITTED",
        txHash: ("0x" + "dd".repeat(32)) as Hex,
        invoice: decision1.intent.invoice,
      },
    ],
  };

  const decision3 = await advanceRunbook(snapshotWithSubmitted);
  assert.equal(decision3.type, "WAIT");

  // Step 3: When action is INCLUDED, advance completes and returns result
  const snapshotWithIncluded: RunbookSnapshot = {
    ...snapshotWithSubmitted,
    actions: [
      {
        ...snapshotWithSubmitted.actions[0]!,
        state: "INCLUDED",
      },
    ],
  };

  const decision4 = await advanceRunbook(snapshotWithIncluded);
  assert.equal(decision4.type, "COMPLETE");
  assert.ok(decision4.result);
});

test("advanceRunbook: liquidity-keeper generates deposit proposal", async () => {
  const prep = prepareTask({
    runbookId: "liquidity-keeper",
    input: {
      vault: "0x4444444444444444444444444444444444444444",
      command: "deposit",
      amountUnits: "500000",
      maxSlippageBps: 50,
    },
  });

  const dummyChainTaskId = ("0x" + "ee".repeat(32)) as Hex;
  const snapshot: RunbookSnapshot = {
    taskId: "11111111-1111-4111-8111-111111111111",
    chainTaskId: dummyChainTaskId,
    walletId: "22222222-2222-4222-8222-222222222222",
    walletAddress: "0x7777777777777777777777777777777777777777",
    permitId: ("0x" + "bb".repeat(32)) as Hex,
    conditions: prep.conditions,
    scope: prep.scope,
    permit: {} as any,
    walletPolicy: {} as any,
    now: "1700000100",
    chainBlock: "100",
    wallet: {} as any,
    actions: [],
    observations: [],
    agentAnswers: [],
    approvals: [],
    runbookState: INITIAL_RUNBOOK_STATE,
  };

  const decision = await advanceRunbook(snapshot);
  assert.equal(decision.type, "PROPOSE");
  assert.equal(decision.decisionKey, `${dummyChainTaskId}:liquidity:deposit`);
  assert.equal(decision.intent.operation, 1); // DEPOSIT
  assert.equal(decision.intent.amount, "500000");
});
