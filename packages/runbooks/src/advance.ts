import {
  type RunbookSnapshot,
  type RunbookDecision,
  RunbookDecisionSchema,
} from "@mandate/schema";
import { advanceBrowserCheck, type RunbookDeps } from "./browser.js";
import { advanceLiquidityKeeper } from "./liquidity.js";
import { advanceScheduledPay } from "./schedule.js";

export { type RunbookDeps } from "./browser.js";

export async function advanceRunbook(
  snapshot: RunbookSnapshot,
  deps: RunbookDeps = {},
): Promise<RunbookDecision> {
  const { runbookId } = snapshot.conditions;

  let decision: RunbookDecision;
  switch (runbookId) {
    case "browser-check":
      decision = await advanceBrowserCheck(snapshot, deps);
      break;
    case "liquidity-keeper":
      decision = await advanceLiquidityKeeper(snapshot, deps);
      break;
    case "scheduled-pay":
      decision = await advanceScheduledPay(snapshot, deps);
      break;
    case "service-allowance":
      decision = {
        type: "WAIT",
        dueAt: String(Number(snapshot.now) + 60),
        reason: "Standing service allowance active",
        nextState: snapshot.runbookState,
      };
      break;
    default:
      decision = {
        type: "FAILED",
        reason: `Unsupported runbook: ${runbookId}`,
        evidence: [],
        nextState: snapshot.runbookState,
      };
  }

  return RunbookDecisionSchema.parse(decision);
}
