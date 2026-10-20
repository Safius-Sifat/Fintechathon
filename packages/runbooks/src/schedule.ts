import {
  type RunbookSnapshot,
  type RunbookDecision,
  type ActionIntent,
  hashCanonical,
} from "@mandate/schema";
import { type Hex } from "viem";
import { type RunbookDeps } from "./browser.js";

export async function advanceScheduledPay(
  snapshot: RunbookSnapshot,
  deps: RunbookDeps = {},
): Promise<RunbookDecision> {
  const { chainTaskId, conditions, actions, runbookState, now } = snapshot;
  const sched = conditions.schedule;
  if (!sched) {
    return {
      type: "FAILED",
      reason: "Missing schedule conditions",
      evidence: [],
      nextState: runbookState,
    };
  }

  const nowSec = Number(now);
  const startSec = Number(sched.start);

  if (nowSec < startSec) {
    return {
      type: "WAIT",
      dueAt: String(startSec),
      reason: `Schedule has not started yet (starts at ${startSec})`,
      nextState: runbookState,
    };
  }

  const elapsed = nowSec - startSec;
  const currentPeriod = Math.floor(elapsed / sched.interval);

  if (currentPeriod >= sched.periods) {
    return {
      type: "COMPLETE",
      result: {
        status: "complete",
        periodsTotal: sched.periods,
        missedPeriods: runbookState.missedPeriods,
      },
      evidence: [],
      nextState: runbookState,
    };
  }

  const offsetInPeriod = elapsed % sched.interval;
  const inWindow = offsetInPeriod <= sched.window;

  const decisionKey = `${chainTaskId}:schedule:${currentPeriod}`;
  const existingAction = actions.find((a) => a.decisionKey === decisionKey);

  if (existingAction) {
    if (existingAction.state === "INCLUDED" || existingAction.state === "FINALIZED") {
      // Current period completed; wait for next period start
      const nextPeriodStart = startSec + (currentPeriod + 1) * sched.interval;
      return {
        type: "WAIT",
        dueAt: String(nextPeriodStart),
        reason: `Period ${currentPeriod} complete; waiting for period ${currentPeriod + 1}`,
        nextState: runbookState,
      };
    }
    return {
      type: "WAIT",
      dueAt: String(nowSec + 15),
      reason: `Waiting for action for period ${currentPeriod} (${existingAction.state})`,
      nextState: runbookState,
    };
  }

  if (!inWindow) {
    // Missed window for this period; skip it!
    const nextPeriodStart = startSec + (currentPeriod + 1) * sched.interval;
    const missed = runbookState.missedPeriods.includes(currentPeriod)
      ? runbookState.missedPeriods
      : [...runbookState.missedPeriods, currentPeriod];

    return {
      type: "WAIT",
      dueAt: String(nextPeriodStart),
      reason: `Missed execution window for period ${currentPeriod}; skipping to next period`,
      nextState: {
        ...runbookState,
        missedPeriods: missed,
      },
    };
  }

  // Inside window and unexecuted: PROPOSE TRANSFER
  const intent: ActionIntent = {
    operation: 3, // TRANSFER
    target: sched.recipient,
    amount: sched.amount,
    minOutput: "0",
    invoice: null,
    providerSignature: null,
    inputHash: hashCanonical(sched) as Hex,
    period: currentPeriod,
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
