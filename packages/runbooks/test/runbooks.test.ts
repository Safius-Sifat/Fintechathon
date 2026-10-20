import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareTask,
  advanceRunbook,
  validateBrowserResult,
  hashInput,
} from "../src/index.js";
import {
  type DeliveryEnvelope,
  type QuoteEnvelope,
  type RunbookSnapshot,
  INITIAL_RUNBOOK_STATE,
  ZERO_HASH,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  invoiceDomain,
} from "@mandate/schema";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Public Anvil test key #2 (address 0x3C44...93BC), the fixture provider A.
const PROVIDER_A = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
);

async function signedQuote(
  chainTaskId: Hex,
  wallet: Hex,
  asset: Hex,
  now: number,
  input: unknown,
): Promise<QuoteEnvelope> {
  const invoice = {
    invoiceId: ("0x" + "12".repeat(32)) as Hex,
    taskId: chainTaskId,
    wallet,
    asset,
    recipient: PROVIDER_A.address,
    amount: "200000",
    inputHash: hashCanonical(input),
    issuedAt: String(now),
    expiresAt: String(now + 60),
  };
  const providerSignature = await PROVIDER_A.signTypedData(
    buildTypedData("Invoice", invoice, invoiceDomain(wallet)) as never,
  );
  return {
    providerId: "a",
    invoice,
    providerSignature,
    x402: null,
  } as QuoteEnvelope;
}

async function signedDelivery(
  wallet: Hex,
  action: { invoiceId: Hex; requestId: Hex; inputHash: Hex },
  paymentTxHash: Hex,
  now: number,
): Promise<DeliveryEnvelope> {
  const result = {
    schemaVersion: 4 as const,
    targetId: "checkout-healthy" as const,
    inputHash: action.inputHash,
    checkedAt: String(now),
    checks: {
      pageLoad: true,
      title: { actual: "Checkout", expected: "Checkout", pass: true },
    },
    screenshotHash: ("0x" + "31".repeat(32)) as Hex,
    logHash: ("0x" + "32".repeat(32)) as Hex,
  };
  const receipt = {
    invoiceId: action.invoiceId,
    requestId: action.requestId,
    inputHash: action.inputHash,
    resultHash: hashCanonical(result),
    paymentTxHash,
    completedAt: String(now),
  };
  const providerSignature = await PROVIDER_A.signTypedData(
    buildTypedData("DeliveryReceipt", receipt, deliveryDomain(wallet)) as never,
  );
  return {
    result,
    receipt,
    providerSignature,
    artifacts: [],
  } as DeliveryEnvelope;
}

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

  // Valid input, but the runbook code is not hashed yet, so it is not approvable.
  assert.ok(res1.needsOwnerReason?.includes("not built"));
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

  assert.ok(res2.needsOwnerReason?.includes("not built"));
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

  // Without a connected quote service nothing is proposed.
  const noQuote = await advanceRunbook(snapshot);
  assert.equal(noQuote.type, "FAILED");

  const deps = {
    quote: (_id: "a" | "b", input: unknown) =>
      signedQuote(
        dummyChainTaskId,
        dummyWallet as Hex,
        dummyAsset as Hex,
        1700000100,
        input,
      ),
  };

  // Step 1: Initial proposal
  const decision1 = await advanceRunbook(snapshot, deps);
  assert.equal(decision1.type, "PROPOSE");
  assert.equal(decision1.decisionKey, `${dummyChainTaskId}:browser:pay:0`);
  assert.equal(decision1.intent.operation, 0); // PAY
  assert.equal(decision1.intent.amount, "200000"); // Provider A price

  // Calling again with the same snapshot produces the exact same decisionKey and proposal
  const decision2 = await advanceRunbook(snapshot, deps);
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

  const decision3 = await advanceRunbook(snapshotWithSubmitted, deps);
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

  // No result service: the runbook fails instead of inventing a result.
  const noResult = await advanceRunbook(snapshotWithIncluded, deps);
  assert.equal(noResult.type, "FAILED");

  const action = snapshotWithIncluded.actions[0]!.action;
  const txHash = snapshotWithIncluded.actions[0]!.txHash as Hex;
  const good = await signedDelivery(
    dummyWallet as Hex,
    action as never,
    txHash,
    1700000200,
  );
  const decision4 = await advanceRunbook(snapshotWithIncluded, {
    ...deps,
    retrieve: async () => good,
  });
  assert.equal(decision4.type, "COMPLETE");
  assert.ok(decision4.result);

  // A result whose bytes differ from its signed hash is not accepted.
  const tampered = {
    ...good,
    result: { ...good.result, checks: { pageLoad: false } },
  } as DeliveryEnvelope;
  const decision5 = await advanceRunbook(snapshotWithIncluded, {
    ...deps,
    retrieve: async () => tampered,
  });
  assert.notEqual(decision5.type, "COMPLETE");
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

  // No risk source, a WARNING or a stale signal all hold the deposit.
  assert.equal((await advanceRunbook(snapshot)).type, "WAIT");
  const risk = (state: "NORMAL" | "WARNING", observedAt: string) => ({
    readRisk: async () => ({
      sourceId: "demo-risk-v1" as const,
      state,
      observedAt,
      sequence: 1,
    }),
  });
  assert.equal(
    (await advanceRunbook(snapshot, risk("WARNING", "1700000090"))).type,
    "WAIT",
  );
  assert.equal(
    (await advanceRunbook(snapshot, risk("NORMAL", "1700000000"))).type,
    "WAIT",
  );

  const decision = await advanceRunbook(snapshot, risk("NORMAL", "1700000090"));
  assert.equal(decision.type, "PROPOSE");
  assert.equal(decision.decisionKey, `${dummyChainTaskId}:liquidity:deposit`);
  assert.equal(decision.intent.operation, 1); // DEPOSIT
  assert.equal(decision.intent.amount, "500000");
});
