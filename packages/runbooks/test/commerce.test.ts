import test from "node:test";
import assert from "node:assert/strict";
import { prepareTask, advanceRunbook } from "../src/index.js";
import {
  type OrderDelivery,
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

// Public Anvil test key #3 (address 0x90F7...b906), the fixture shop.
const SHOP = privateKeyToAccount(
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
);
const OTHER = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
);
const DELIVERY = ("0x" + "ab".repeat(32)) as Hex;
const SETTLE_TX = ("0x" + "ee".repeat(32)) as Hex;
const NOW = 1700000100;

function snapshotFor(): RunbookSnapshot {
  const prep = prepareTask({
    runbookId: "commerce-buy",
    input: {
      productId: "aero-runner",
      size: "42",
      maxAmount: "450000",
      deliveryHash: DELIVERY,
      taskDeadline: "1800000000",
    },
  });
  assert.ok(prep.conditions && prep.scope);
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

  return {
    ...snapshot,
    scope: {
      ...snapshot.scope,
      providerBindings: [{ providerId: "shop", recipient: SHOP.address }],
    },
  };
}

async function shopQuote(
  s: RunbookSnapshot,
  over: { amount?: string; signer?: typeof SHOP; productId?: string } = {},
): Promise<QuoteEnvelope> {
  const signer = over.signer ?? SHOP;
  const invoice = {
    invoiceId: ("0x" + "12".repeat(32)) as Hex,
    taskId: s.chainTaskId as Hex,
    wallet: s.walletAddress as Hex,
    asset: BASE_SEPOLIA_USDC,
    recipient: signer.address,
    amount: over.amount ?? "450000",
    inputHash: hashCanonical({
      productId: over.productId ?? "aero-runner",
      size: "42",
      deliveryHash: DELIVERY,
    }),
    issuedAt: String(NOW),
    expiresAt: String(NOW + 60),
  };
  const providerSignature = await signer.signTypedData(
    buildTypedData(
      "Invoice",
      invoice,
      invoiceDomain(s.walletAddress as Hex),
    ) as never,
  );
  return {
    providerId: "shop",
    invoice,
    providerSignature,
    x402: {
      scheme: "exact",
      network: X402_NETWORK,
      amount: invoice.amount,
      asset: invoice.asset,
      payTo: invoice.recipient,
      maxTimeoutSeconds: 60,
      extra: {
        assetTransferMethod: "eip3009",
        name: "USDC",
        version: "2",
        mandateInvoice: invoice,
        mandateProviderSignature: providerSignature,
      },
    },
  } as QuoteEnvelope;
}

async function signedOrder(
  s: RunbookSnapshot,
  q: QuoteEnvelope,
  requestId: Hex,
  over: { size?: string; paymentTxHash?: Hex } = {},
): Promise<OrderDelivery> {
  const order = {
    schemaVersion: 4 as const,
    orderId: q.invoice.invoiceId,
    inputHash: q.invoice.inputHash,
    productId: "aero-runner",
    name: "Aero Runner",
    size: over.size ?? "42",
    amount: q.invoice.amount,
    deliveryHash: DELIVERY,
    testShop: true as const,
    placedAt: String(NOW + 10),
  };
  const receipt = {
    invoiceId: q.invoice.invoiceId,
    requestId,
    inputHash: q.invoice.inputHash,
    resultHash: hashCanonical(order),
    paymentTxHash: over.paymentTxHash ?? SETTLE_TX,
    completedAt: String(NOW + 10),
  };
  const providerSignature = await SHOP.signTypedData(
    buildTypedData(
      "DeliveryReceipt",
      receipt,
      deliveryDomain(s.walletAddress as Hex),
    ) as never,
  );
  return { order, receipt, providerSignature };
}

const unusedRetrieve = async () => ({
  state: "PENDING" as const,
  reason: "unused",
});

test("commerce: without the shop connected nothing is ordered", async () => {
  assert.equal((await advanceRunbook(snapshotFor())).type, "FAILED");
});

test("commerce: a matching shop quote becomes an X402 Action, or a PAY without x402", async () => {
  const s = snapshotFor();
  const quote = () => shopQuote(s);
  const x402 = await advanceRunbook(s, {
    shop: {
      quote,
      retrieve: unusedRetrieve,
      payX402: async () => ({ state: "PENDING", reason: "" }),
    },
  });
  assert.equal(x402.type, "PROPOSE");
  assert.equal(x402.intent.operation, 6);
  assert.equal(x402.intent.amount, "450000");
  const pay = await advanceRunbook(s, {
    shop: { quote, retrieve: unusedRetrieve },
  });
  assert.equal(pay.type, "PROPOSE");
  assert.equal(pay.intent.operation, 0);
});

test("commerce: quotes above the approved price, from another payee or for another product are refused", async () => {
  const s = snapshotFor();
  for (const over of [
    { amount: "460000" },
    { signer: OTHER },
    { productId: "tempo-glide" },
  ]) {
    const d = await advanceRunbook(s, {
      shop: { quote: () => shopQuote(s, over), retrieve: unusedRetrieve },
    });
    assert.equal(d.type, "FAILED", JSON.stringify(Object.keys(over)));
  }
});

test("commerce: after registration the order completes only when it is exactly what was approved", async () => {
  const s = snapshotFor();
  const quote = await shopQuote(s);
  const action = {
    permitId: s.permitId,
    requestId: ("0x" + "cc".repeat(32)) as Hex,
    operation: 6 as const,
    target: quote.invoice.recipient,
    amount: quote.invoice.amount,
    minOutput: "0",
    invoiceId: quote.invoice.invoiceId,
    inputHash: quote.invoice.inputHash,
    period: 0,
    issuedAt: String(NOW),
    deadline: String(NOW + 50),
  };
  const included: RunbookSnapshot = {
    ...s,
    runbookState: {
      ...INITIAL_RUNBOOK_STATE,
      step: 1,
      selectedProvider: "shop",
      quotes: [quote],
    },
    actions: [
      {
        decisionKey: `${s.chainTaskId}:commerce:order:0`,
        action,
        state: "INCLUDED",
        txHash: ("0x" + "dd".repeat(32)) as Hex,
        invoice: quote.invoice,
      },
    ],
  };
  const good = await signedOrder(s, quote, action.requestId);
  const done = await advanceRunbook(included, {
    shop: {
      quote: () => shopQuote(s),
      retrieve: unusedRetrieve,
      payX402: async () => ({
        state: "DELIVERED",
        delivery: good,
        settlementTxHash: SETTLE_TX,
      }),
    },
  });
  assert.equal(done.type, "COMPLETE");
  assert.equal(
    (done.result as { paymentTxHash: string }).paymentTxHash,
    SETTLE_TX,
  );

  const wrongSize = await signedOrder(s, quote, action.requestId, {
    size: "43",
  });
  const refused = await advanceRunbook(included, {
    shop: {
      quote: () => shopQuote(s),
      retrieve: unusedRetrieve,
      payX402: async () => ({
        state: "DELIVERED",
        delivery: wrongSize,
        settlementTxHash: SETTLE_TX,
      }),
    },
  });
  assert.equal(refused.type, "FAILED");

  const pending = await advanceRunbook(included, {
    shop: {
      quote: () => shopQuote(s),
      retrieve: unusedRetrieve,
      payX402: async () => ({
        state: "PENDING",
        reason: "1 of 3 confirmations",
      }),
    },
  });
  assert.equal(pending.type, "WAIT");
});
