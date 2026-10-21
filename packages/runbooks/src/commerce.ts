import {
  type Action,
  type ActionIntent,
  type OrderDelivery,
  type QuoteEnvelope,
  type RunbookDecision,
  type RunbookSnapshot,
  hashCanonical,
} from "@mandate/schema";
import type { Address, Hex } from "viem";
import { checkOrderDelivery, checkQuote } from "./validators.js";

// The demo shop as the commerce runbook sees it. Each call reaches the real
// shop; there is no built-in fallback.
export type CommerceDeps = {
  shop?: {
    quote: (input: {
      productId: string;
      size: string | null;
      deliveryHash: Hex;
    }) => Promise<QuoteEnvelope>;
    // Retrieval after a normal PAY.
    retrieve: (
      invoiceId: Hex,
      requestId: Hex,
      paymentTxHash: Hex,
    ) => Promise<{ state: "PENDING"; reason: string } | OrderDelivery>;
    // Payment by x402 (S9.10); present only when the deployment pays with x402.
    payX402?: (
      quote: QuoteEnvelope,
      action: Action,
    ) => Promise<
      | { state: "PENDING"; reason: string }
      | { state: "DELIVERED"; delivery: OrderDelivery; settlementTxHash: Hex }
    >;
  };
};

// Two attempts: an expired quote or a payment that never settled gets one
// fresh quote; nothing else is retried.
const MAX_ATTEMPTS = 2;

export async function advanceCommerce(
  snapshot: RunbookSnapshot,
  deps: CommerceDeps = {},
): Promise<RunbookDecision> {
  const {
    chainTaskId,
    conditions,
    permit,
    scope,
    walletAddress,
    actions,
    runbookState,
  } = snapshot;
  const cond = conditions.commerce;
  const fail = (reason: string): RunbookDecision => ({
    type: "FAILED",
    reason,
    evidence: [],
    nextState: runbookState,
  });
  if (!cond) return fail("Missing commerce conditions in snapshot");
  if (!deps.shop)
    return fail("The shop is not connected; no order was invented");
  const shopRecipient = scope.providerBindings.find(
    (b) => b.providerId === "shop",
  )?.recipient;
  if (!shopRecipient) return fail("The shop is not bound to this task");

  const attempt = runbookState.attempt;
  const decisionKey = `${chainTaskId}:commerce:order:${attempt}`;
  const current = actions.find((a) => a.decisionKey === decisionKey);
  const inputHash = hashCanonical({
    productId: cond.productId,
    size: cond.size,
    deliveryHash: cond.deliveryHash,
  });
  const nextAttempt = { ...runbookState, attempt: attempt + 1, retrievals: 0 };

  if (!current) {
    if (attempt >= MAX_ATTEMPTS)
      return fail(`The order could not be placed in ${MAX_ATTEMPTS} attempts`);
    const quote = await deps.shop.quote({
      productId: cond.productId,
      size: cond.size,
      deliveryHash: cond.deliveryHash as Hex,
    });
    const maxPayment =
      BigInt(permit.maxPayment) < BigInt(cond.maxAmount)
        ? BigInt(permit.maxPayment)
        : BigInt(cond.maxAmount);
    const problem =
      quote.providerId !== "shop"
        ? "The quote is not from the shop."
        : quote.invoice.recipient.toLowerCase() !== shopRecipient.toLowerCase()
          ? "The quote pays an address other than the bound shop."
          : quote.invoice.inputHash.toLowerCase() !== inputHash.toLowerCase()
            ? "The quote is for another product, size or delivery."
            : await checkQuote(quote, {
                chainTaskId: chainTaskId as Hex,
                wallet: walletAddress as Address,
                nowSeconds: BigInt(snapshot.now),
                maxPayment,
              });
    if (problem) return fail(`Quote rejected: ${problem}`);
    const useX402 = quote.x402 !== null && !!deps.shop.payX402;
    const intent: ActionIntent = {
      operation: useX402 ? 6 : 0,
      target: quote.invoice.recipient,
      amount: quote.invoice.amount,
      minOutput: "0",
      invoice: quote.invoice,
      providerSignature: quote.providerSignature,
      inputHash: quote.invoice.inputHash,
      period: 0,
      templateId: null,
      callData: null,
    };
    return {
      type: "PROPOSE",
      decisionKey,
      intent,
      evidence: [],
      nextState: {
        ...runbookState,
        step: runbookState.step + 1,
        selectedProvider: "shop",
        quotes: [...runbookState.quotes, quote],
      },
    };
  }

  if (
    [
      "PROPOSED",
      "RESERVED",
      "AWAITING_APPROVAL",
      "SIGNING",
      "SIGNED",
      "SUBMITTED",
      "UNKNOWN",
    ].includes(current.state)
  )
    return {
      type: "WAIT",
      dueAt: String(Number(snapshot.now) + 5),
      reason: `Payment ${current.state.toLowerCase()}`,
      nextState: runbookState,
    };
  if (["DENIED", "REJECTED"].includes(current.state))
    return fail(`The payment was not allowed (${current.state.toLowerCase()})`);
  if (current.state === "REVERTED")
    return {
      type: "WAIT",
      dueAt: snapshot.now,
      reason: "The payment reverted; trying a fresh quote",
      nextState: nextAttempt,
    };

  // INCLUDED or FINALIZED: collect the order.
  const quote = runbookState.quotes.find(
    (q) =>
      q.invoice.invoiceId.toLowerCase() ===
      current.action.invoiceId.toLowerCase(),
  );
  if (!quote) return fail("The quote for this payment is missing");
  let delivery: OrderDelivery;
  let paymentTxHash: Hex;
  if (current.action.operation === 6) {
    if (!deps.shop.payX402)
      return fail(
        "The x402 payment service is not connected; nothing was paid",
      );
    const paid = await deps.shop.payX402(quote, current.action);
    if (paid.state === "PENDING") {
      if (BigInt(snapshot.now) > BigInt(current.action.deadline) + 30n)
        return {
          type: "WAIT",
          dueAt: snapshot.now,
          reason: `The payment did not settle before its deadline: ${paid.reason}`,
          nextState: nextAttempt,
        };
      return {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 5),
        reason: `Waiting for settlement: ${paid.reason}`,
        nextState: { ...runbookState, retrievals: runbookState.retrievals + 1 },
      };
    }
    delivery = paid.delivery;
    paymentTxHash = paid.settlementTxHash;
  } else {
    if (!current.txHash)
      return {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 5),
        reason: "The included payment has no recorded transaction hash yet",
        nextState: runbookState,
      };
    const got = await deps.shop.retrieve(
      current.action.invoiceId as Hex,
      current.action.requestId as Hex,
      current.txHash as Hex,
    );
    if ("state" in got)
      return {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 5),
        reason: `Waiting for the order: ${got.reason}`,
        nextState: { ...runbookState, retrievals: runbookState.retrievals + 1 },
      };
    delivery = got;
    paymentTxHash = current.txHash as Hex;
  }
  const problem = await checkOrderDelivery(delivery, {
    wallet: walletAddress as Address,
    invoiceId: current.action.invoiceId as Hex,
    requestId: current.action.requestId as Hex,
    inputHash: inputHash,
    paymentTxHash,
    shop: shopRecipient as Address,
    productId: cond.productId,
    size: cond.size,
    deliveryHash: cond.deliveryHash as Hex,
    amount: current.action.amount,
  });
  if (problem) return fail(`Order rejected: ${problem}`);
  return {
    type: "COMPLETE",
    result: { order: delivery.order, paymentTxHash } as never,
    evidence: [delivery as never],
    nextState: runbookState,
  };
}
