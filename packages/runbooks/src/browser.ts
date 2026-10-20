import {
  type RunbookSnapshot,
  type RunbookDecision,
  type QuoteEnvelope,
  type DeliveryEnvelope,
  type RunbookState,
  type ActionIntent,
  hashCanonical,
} from "@mandate/schema";
import { type Hex } from "viem";

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
  const { chainTaskId, conditions, permit, walletAddress, actions, runbookState } = snapshot;
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

    // Get quote (either from deps or construct valid default quote)
    let quote: QuoteEnvelope;
    if (deps.quote) {
      quote = await deps.quote(selectedProviderId as "a" | "b", {
        targetId: browserCond.targetId,
        checks: browserCond.checks,
      });
    } else {
      // Mock quote fallback
      const price = selectedProviderId === "a" ? "200000" : "350000";
      const recipient =
        selectedProviderId === "a"
          ? "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
          : "0x6666666666666666666666666666666666666666";
      const nowNum = Number(snapshot.now);
      quote = {
        providerId: selectedProviderId as "a" | "b",
        invoice: {
          invoiceId: ("0x" + "1".padStart(64, "0")) as Hex,
          taskId: chainTaskId as Hex,
          wallet: walletAddress as any,
          recipient: recipient as any,
          asset: permit.asset as any,
          amount: price,
          inputHash: hashCanonical(browserCond) as Hex,
          issuedAt: String(nowNum),
          expiresAt: String(nowNum + 600),
        },
        providerSignature: ("0x" + "aa".repeat(65)) as any,
        x402: null,
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
  if (currentAction.state === "SUBMITTED" || currentAction.state === "SIGNING") {
    // Payment in flight; wait
    return {
      type: "WAIT",
      dueAt: String(Number(snapshot.now) + 15),
      reason: `Waiting for payment transaction ${currentAction.txHash ?? "submission"} to confirm`,
      nextState: runbookState,
    };
  }

  if (currentAction.state === "REVERTED" || currentAction.state === "REJECTED") {
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

  // 3. Action is INCLUDED or FINALIZED: retrieve delivery
  if (currentAction.state === "INCLUDED" || currentAction.state === "FINALIZED") {
    if (runbookState.delivery) {
      // Already delivered!
      return {
        type: "COMPLETE",
        result: runbookState.delivery.result as any,
        evidence: [runbookState.delivery as any],
        nextState: runbookState,
      };
    }

    // Try retrieving delivery
    if (deps.retrieve) {
      const retrieval = await deps.retrieve(
        (runbookState.selectedProvider ?? "a") as "a" | "b",
        currentAction.action.invoiceId as Hex,
        currentAction.action.requestId as Hex,
        (currentAction.txHash ?? ("0x" + "00".repeat(32))) as Hex,
      );

      if ("state" in retrieval && retrieval.state === "PENDING") {
        const retrievalsCount = runbookState.retrievals + 1;
        if (retrievalsCount <= 3) {
          return {
            type: "WAIT",
            dueAt: String(Number(snapshot.now) + 10),
            reason: `Waiting for provider result delivery (attempt ${retrievalsCount}/3)`,
            nextState: { ...runbookState, retrievals: retrievalsCount },
          };
        } else {
          // Provider failed to deliver after 3 attempts. Fallback!
          return {
            type: "PROPOSE",
            decisionKey: `${chainTaskId}:browser:pay:${attemptIndex + 1}`,
            intent: null as any, // next advance call will propose fallback
            evidence: [],
            nextState: {
              ...runbookState,
              attempt: attemptIndex + 1,
              retrievals: 0,
              selectedProvider: null,
            },
          };
        }
      } else {
        // Delivery received!
        const delivery = retrieval as DeliveryEnvelope;
        return {
          type: "COMPLETE",
          result: delivery.result as any,
          evidence: [delivery as any],
          nextState: {
            ...runbookState,
            delivery,
          },
        };
      }
    }

    // Default mock delivery completion if no retrieval dep supplied
    const mockResult = {
      schemaVersion: 4,
      targetId: browserCond.targetId,
      inputHash: currentAction.action.inputHash,
      checkedAt: snapshot.now,
      checks: {
        pageLoad: true,
        title: { actual: "Checkout", expected: "Checkout", pass: true },
        ...(browserCond.checks.includes("formSubmit") ? { formSubmit: browserCond.targetId === "checkout-healthy" } : {}),
      },
      screenshotHash: ("0x" + "11".repeat(32)) as Hex,
      logHash: ("0x" + "22".repeat(32)) as Hex,
    };

    return {
      type: "COMPLETE",
      result: mockResult,
      evidence: [],
      nextState: runbookState,
    };
  }

  return {
    type: "WAIT",
    dueAt: String(Number(snapshot.now) + 10),
    reason: `Pending action state: ${currentAction.state}`,
    nextState: runbookState,
  };
}
