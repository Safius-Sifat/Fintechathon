import {
  type RunbookSnapshot,
  type RunbookDecision,
  type QuoteEnvelope,
  type DeliveryEnvelope,
  type RunbookState,
  type ActionIntent,
  hashCanonical,
} from "@mandate/schema";
import { type Address, type Hex } from "viem";
import { checkDelivery, checkQuote } from "./validators.js";

export type RunbookDeps = {
  quote?: (providerId: "a" | "b", input: unknown) => Promise<QuoteEnvelope>;
  retrieve?: (
    providerId: "a" | "b",
    invoiceId: Hex,
    requestId: Hex,
    paymentTxHash: Hex,
  ) => Promise<{ state: "PENDING" } | DeliveryEnvelope>;
  readVault?: () => Promise<{
    blockNumber: string;
    liquidAssets: string;
    vaultShares: string;
    vaultAssets: string;
    previewDepositShares: string;
    previewRedeemAssets: string;
    maxRedeemShares: string;
  }>;
  readRisk?: () => Promise<{
    sourceId: "demo-risk-v1";
    state: "NORMAL" | "WARNING";
    observedAt: string;
    sequence: number;
  }>;
};

export async function advanceBrowserCheck(
  snapshot: RunbookSnapshot,
  deps: RunbookDeps = {},
): Promise<RunbookDecision> {
  const {
    chainTaskId,
    conditions,
    permit,
    walletAddress,
    actions,
    runbookState,
  } = snapshot;
  const browserCond = conditions.browser;
  if (!browserCond) {
    return {
      type: "FAILED",
      reason: "Missing browser conditions in snapshot",
      evidence: [],
      nextState: runbookState,
    };
  }

  const attemptIndex = runbookState.attempt;
  const decisionKey = `${chainTaskId}:browser:pay:${attemptIndex}`;

  // Find if an action exists with this decisionKey
  const currentAction = actions.find((a) => a.decisionKey === decisionKey);

  // 1. If no action exists yet for this attempt: PROPOSE PAY
  if (!currentAction) {
    // Check if maxPaidAttempts exceeded
    if (attemptIndex >= browserCond.maxPaidAttempts) {
      return {
        type: "FAILED",
        reason: `Exceeded maxPaidAttempts (${browserCond.maxPaidAttempts})`,
        evidence: [],
        nextState: runbookState,
      };
    }

    // Determine eligible providers
    const needsForm = browserCond.checks.includes("formSubmit");
    const allowedProviders = browserCond.providerIds.filter((id) =>
      needsForm ? id === "b" : true,
    );

    // If attempt > 0, fallback: try 'b' if 'a' failed
    const selectedProviderId = attemptIndex === 0 ? allowedProviders[0]! : "b";

    if (!selectedProviderId || !allowedProviders.includes(selectedProviderId)) {
      return {
        type: "FAILED",
        reason: "No eligible provider available within approved conditions",
        evidence: [],
        nextState: runbookState,
      };
    }

    // A real, signed quote is required. There is no built-in fallback.
    if (!deps.quote) {
      return {
        type: "FAILED",
        reason:
          "The provider quote service is not connected; no quote was invented",
        evidence: [],
        nextState: runbookState,
      };
    }
    const quote = await deps.quote(selectedProviderId as "a" | "b", {
      targetId: browserCond.targetId,
      checks: browserCond.checks,
    });
    const quoteProblem = await checkQuote(quote, {
      chainTaskId: chainTaskId as Hex,
      wallet: walletAddress as Address,
      nowSeconds: BigInt(snapshot.now),
      maxPayment: BigInt(permit.maxPayment),
    });
    if (quoteProblem) {
      return {
        type: "FAILED",
        reason: `Quote rejected: ${quoteProblem}`,
        evidence: [],
        nextState: runbookState,
      };
    }

    // Check remaining cap
    const totalSpentSoFar = actions
      .filter((a) => a.state === "INCLUDED" || a.state === "FINALIZED")
      .reduce((acc, a) => acc + BigInt(a.action.amount), 0n);

    const proposedAmount = BigInt(quote.invoice.amount);
    const maxPermitAmount = BigInt(permit.spendCap);

    if (totalSpentSoFar + proposedAmount > maxPermitAmount) {
      return {
        type: "NEEDS_OWNER",
        reason: `Proposed payment ${proposedAmount} exceeds remaining permit cap (${maxPermitAmount - totalSpentSoFar})`,
        evidence: [],
        nextState: runbookState,
      };
    }

    const intent: ActionIntent = {
      operation: 0, // PAY
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

    const nextState: RunbookState = {
      ...runbookState,
      step: runbookState.step + 1,
      selectedProvider: selectedProviderId as "a" | "b",
      quotes: [...runbookState.quotes, quote],
    };

    return {
      type: "PROPOSE",
      decisionKey,
      intent,
      evidence: [],
      nextState,
    };
  }

  // 2. Action exists: inspect its state
  if (
    currentAction.state === "SUBMITTED" ||
    currentAction.state === "SIGNING"
  ) {
    // Payment in flight; wait
    return {
      type: "WAIT",
      dueAt: String(Number(snapshot.now) + 15),
      reason: `Waiting for payment transaction ${currentAction.txHash ?? "submission"} to confirm`,
      nextState: runbookState,
    };
  }

  if (
    currentAction.state === "REVERTED" ||
    currentAction.state === "REJECTED"
  ) {
    // Action failed on-chain
    return {
      type: "FAILED",
      reason: `Payment transaction reverted: ${currentAction.txHash}`,
      evidence: [],
      nextState: {
        ...runbookState,
        attempt: attemptIndex + 1,
      },
    };
  }

  // 3. Action is INCLUDED or FINALIZED: retrieve and check the delivery.
  if (
    currentAction.state === "INCLUDED" ||
    currentAction.state === "FINALIZED"
  ) {
    if (runbookState.delivery) {
      return {
        type: "COMPLETE",
        result: runbookState.delivery.result as any,
        evidence: [runbookState.delivery as any],
        nextState: runbookState,
      };
    }
    if (!deps.retrieve) {
      return {
        type: "FAILED",
        reason:
          "The provider result service is not connected; no result was invented",
        evidence: [],
        nextState: runbookState,
      };
    }
    if (!currentAction.txHash) {
      return {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 10),
        reason: "The included payment has no recorded transaction hash yet",
        nextState: runbookState,
      };
    }
    const providerId = (runbookState.selectedProvider ?? "a") as "a" | "b";
    const retrieval = await deps.retrieve(
      providerId,
      currentAction.action.invoiceId as Hex,
      currentAction.action.requestId as Hex,
      currentAction.txHash as Hex,
    );
    const nextAttempt = {
      ...runbookState,
      attempt: attemptIndex + 1,
      retrievals: 0,
      selectedProvider: null,
    };
    if ("state" in retrieval && retrieval.state === "PENDING") {
      const retrievals = runbookState.retrievals + 1;
      if (retrievals <= 3) {
        return {
          type: "WAIT",
          dueAt: String(Number(snapshot.now) + 10),
          reason: `Waiting for provider result delivery (attempt ${retrievals}/3)`,
          nextState: { ...runbookState, retrievals },
        };
      }
      // The paid provider did not deliver. The next advance proposes the
      // fallback provider under the next attempt's decision key.
      return {
        type: "WAIT",
        dueAt: snapshot.now,
        reason:
          "Paid provider did not deliver after 3 retrievals; trying the next provider",
        nextState: nextAttempt,
      };
    }
    const delivery = retrieval as DeliveryEnvelope;
    const deliveryProblem = await checkDelivery(delivery, {
      wallet: walletAddress as Address,
      invoiceId: currentAction.action.invoiceId as Hex,
      requestId: currentAction.action.requestId as Hex,
      inputHash: currentAction.action.inputHash as Hex,
      paymentTxHash: currentAction.txHash as Hex,
      provider: currentAction.action.target as Address,
    });
    if (deliveryProblem) {
      return {
        type: "WAIT",
        dueAt: snapshot.now,
        reason: `Delivery rejected: ${deliveryProblem}`,
        nextState: nextAttempt,
      };
    }
    return {
      type: "COMPLETE",
      result: delivery.result as any,
      evidence: [delivery as any],
      nextState: { ...runbookState, delivery },
    };
  }

  return {
    type: "WAIT",
    dueAt: String(Number(snapshot.now) + 10),
    reason: `Pending action state: ${currentAction.state}`,
    nextState: runbookState,
  };
}
