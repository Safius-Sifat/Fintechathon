import {
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";

export function checkCompletion(bundle: EvidenceBundle): Finding {
  const { events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  if (events.length === 0) {
    return {
      name: "completion",
      state: "UNVERIFIABLE",
      ruleId: "COMPLETION_NO_EVENTS",
      reason: "No evidence events in bundle to assess completion",
      evidenceIds,
      basis: ["recorder_assertion"],
    };
  }

  const completedEvent = events.find(
    (e) =>
      e.type === "TASK_COMPLETED" ||
      e.type === "RUNBOOK_COMPLETED" ||
      e.type === "DELIVERY_RECEIVED" ||
      e.type === "RESULT_DELIVERED",
  );

  if (!completedEvent) {
    return {
      name: "completion",
      state: "PENDING",
      ruleId: "COMPLETION_IN_PROGRESS",
      reason: "Task has not reached a terminal completion event",
      evidenceIds,
      basis: ["recorder_assertion"],
    };
  }

  return {
    name: "completion",
    state: "PASS",
    ruleId: "COMPLETION_ACHIEVED",
    reason: `Task reached verified completion event: ${completedEvent.type}`,
    evidenceIds,
    basis: ["recorder_assertion"],
  };
}
