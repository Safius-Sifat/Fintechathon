import type { EvidenceBundle, Finding } from "@mandate/schema";
import type { VerifyContext } from "./context.js";

// Completion rests on the recorder's own event, which is not independent
// support, so it is never PASS (plan P4-05).
export function checkCompletion(
  bundle: EvidenceBundle,
  _ctx: VerifyContext,
): Finding {
  const { events } = bundle;
  const ids = events.map((e) => e.eventId);
  const done = events.find((e) =>
    [
      "TASK_COMPLETED",
      "RUNBOOK_COMPLETED",
      "DELIVERY_RECEIVED",
      "RESULT_DELIVERED",
    ].includes(e.type),
  );
  if (!done)
    return {
      name: "completion",
      state: "PENDING",
      ruleId: "COMPLETION_IN_PROGRESS",
      reason: "The task has no completion event yet",
      evidenceIds: ids,
      basis: ["recorder_assertion"],
    };
  return {
    name: "completion",
    state: "UNVERIFIABLE",
    ruleId: "COMPLETION_RECORDER_ONLY",
    reason: `Only the recorder's ${done.type} event says the task finished`,
    evidenceIds: ids,
    basis: ["recorder_assertion"],
  };
}
