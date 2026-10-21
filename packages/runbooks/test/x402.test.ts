import test from "node:test";
import assert from "node:assert/strict";
import { prepareTask, advanceRunbook } from "../src/index.js";
import {
  type DeliveryEnvelope,
  type QuoteEnvelope,
  type RunbookSnapshot,
  BASE_SEPOLIA_USDC,
  INITIAL_RUNBOOK_STATE,
  X402_NETWORK,
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

// The same quote, offered with x402 terms as a USDC provider does.
async function x402Quote(
  chainTaskId: Hex,
  wallet: Hex,
  now: number,
  input: unknown,
): Promise<QuoteEnvelope> {
  const q = await signedQuote(
    chainTaskId,
    wallet,
    BASE_SEPOLIA_USDC,
    now,
    input,
  );
  return {
    ...q,
    x402: {
      scheme: "exact",
      network: X402_NETWORK,
      amount: q.invoice.amount,
      asset: q.invoice.asset,
      payTo: q.invoice.recipient,
      maxTimeoutSeconds: 60,
      extra: {
        assetTransferMethod: "eip3009",
        name: "USDC",
        version: "2",
        mandateInvoice: q.invoice,
        mandateProviderSignature: q.providerSignature,
      },
    },
  } as QuoteEnvelope;
}

function snapshotFor(): RunbookSnapshot {
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
  const dummyAsset = BASE_SEPOLIA_USDC;
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

  return snapshot;
}

const SETTLE_TX = ("0x" + "ee".repeat(32)) as Hex;

test("x402: a USDC quote is paid by an X402 Action only when x402 payment is connected", async () => {
  const snapshot = snapshotFor();
  const quote = (_id: "a" | "b", input: unknown) =>
    x402Quote(
      snapshot.chainTaskId as Hex,
      snapshot.walletAddress as Hex,
      1700000100,
      input,
    );
  const native = await advanceRunbook(snapshot, { quote });
  assert.equal(native.type, "PROPOSE");
  assert.equal(native.intent.operation, 0);
  const x402 = await advanceRunbook(snapshot, {
    quote,
    x402: { pay: async () => ({ state: "PENDING", reason: "unused" }) },
  });
  assert.equal(x402.type, "PROPOSE");
  assert.equal(x402.intent.operation, 6);
  assert.equal(x402.intent.invoice?.asset, BASE_SEPOLIA_USDC);
});

test("x402: after registration the provider settles and delivers, checked against the settlement", async () => {
  const snapshot = snapshotFor();
  const quote = await x402Quote(
    snapshot.chainTaskId as Hex,
    snapshot.walletAddress as Hex,
    1700000100,
    { targetId: "checkout-healthy", checks: ["pageLoad", "title"] },
  );
  const action = {
    permitId: snapshot.permitId,
    requestId: ("0x" + "cc".repeat(32)) as Hex,
    operation: 6 as const,
    target: quote.invoice.recipient,
    amount: quote.invoice.amount,
    minOutput: "0",
    invoiceId: quote.invoice.invoiceId,
    inputHash: quote.invoice.inputHash,
    period: 0,
    issuedAt: "1700000100",
    deadline: "1700000160",
  };
  const included: RunbookSnapshot = {
    ...snapshot,
    runbookState: {
      ...INITIAL_RUNBOOK_STATE,
      step: 1,
      selectedProvider: "a",
      quotes: [quote],
    },
    actions: [
      {
        decisionKey: `${snapshot.chainTaskId}:browser:pay:0`,
        action,
        state: "INCLUDED",
        txHash: ("0x" + "dd".repeat(32)) as Hex,
        invoice: quote.invoice,
      },
    ],
  };
  // Not connected: nothing is invented.
  assert.equal((await advanceRunbook(included, {})).type, "FAILED");

  const pending = await advanceRunbook(included, {
    x402: {
      pay: async () => ({ state: "PENDING", reason: "1 of 3 confirmations" }),
    },
  });
  assert.equal(pending.type, "WAIT");
  assert.equal(pending.nextState.attempt, 0);

  const late = await advanceRunbook(
    { ...included, now: "1700000300" },
    {
      x402: { pay: async () => ({ state: "PENDING", reason: "not settled" }) },
    },
  );
  assert.equal(late.type, "WAIT");
  assert.equal(late.nextState.attempt, 1);

  const delivery = await signedDelivery(
    snapshot.walletAddress as Hex,
    action,
    SETTLE_TX,
    1700000200,
  );
  const done = await advanceRunbook(included, {
    x402: {
      pay: async () => ({
        state: "DELIVERED",
        delivery,
        settlementTxHash: SETTLE_TX,
      }),
    },
  });
  assert.equal(done.type, "COMPLETE");

  // A receipt naming the registration transaction instead of the settlement fails.
  const wrong = await signedDelivery(
    snapshot.walletAddress as Hex,
    action,
    ("0x" + "dd".repeat(32)) as Hex,
    1700000200,
  );
  const refused = await advanceRunbook(included, {
    x402: {
      pay: async () => ({
        state: "DELIVERED",
        delivery: wrong as DeliveryEnvelope,
        settlementTxHash: SETTLE_TX,
      }),
    },
  });
  assert.notEqual(refused.type, "COMPLETE");
});
