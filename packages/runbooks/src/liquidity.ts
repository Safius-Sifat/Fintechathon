import {
  type RunbookSnapshot,
  type RunbookDecision,
  type ActionIntent,
  hashCanonical,
} from "@mandate/schema";
import { type Hex } from "viem";
import { type RunbookDeps } from "./browser.js";

export async function advanceLiquidityKeeper(
  snapshot: RunbookSnapshot,
  deps: RunbookDeps = {},
): Promise<RunbookDecision> {
  const { chainTaskId, conditions, actions, runbookState } = snapshot;
  const liqCond = conditions.liquidity;
  if (!liqCond) {
    return {
      type: "FAILED",
      reason: "Missing liquidity conditions",
      evidence: [],
      nextState: runbookState,
    };
  }

  const decisionKey = `${chainTaskId}:liquidity:${liqCond.command}`;
  const existingAction = actions.find((a) => a.decisionKey === decisionKey);

  if (existingAction) {
    if (existingAction.state === "INCLUDED" || existingAction.state === "FINALIZED") {
      return {
        type: "COMPLETE",
        result: {
          status: "success",
          command: liqCond.command,
          amount: liqCond.amountUnits,
          txHash: existingAction.txHash,
        },
        evidence: [],
        nextState: runbookState,
      };
    }
    return {
      type: "WAIT",
      dueAt: String(Number(snapshot.now) + 15),
      reason: `Waiting on liquidity action ${existingAction.state}`,
      nextState: runbookState,
    };
  }

  // Check risk signal if depositing
  if (liqCond.command === "deposit" && deps.readRisk) {
    const risk = await deps.readRisk();
    if (risk.state === "WARNING") {
      return {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 60),
        reason: "Risk source reports WARNING; halting deposit",
        nextState: runbookState,
      };
    }
  }

  const operation = liqCond.command === "deposit" ? 1 : 2;
  const intent: ActionIntent = {
    operation,
    target: liqCond.vault,
    amount: liqCond.amountUnits,
    minOutput: "0",
    invoice: null,
    providerSignature: null,
    inputHash: hashCanonical(liqCond) as Hex,
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
    },
  };
}
