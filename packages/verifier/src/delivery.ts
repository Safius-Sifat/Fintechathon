import {
  type EvidenceBundle,
  type Finding,
  BrowserResultSchema,
} from "@mandate/schema";

export function checkDelivery(bundle: EvidenceBundle): Finding {
  const { events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  // Find delivery events or result payloads
  const deliveryEvents = events.filter(
    (e) =>
      e.type === "RESULT_DELIVERED" ||
      e.type === "DELIVERY_RECEIVED" ||
      (e.payload as any)?.result,
  );

  if (deliveryEvents.length === 0) {
    return {
      name: "delivery",
      state: "UNVERIFIABLE",
      ruleId: "DELIVERY_NO_RECORDS",
      reason: "No result delivery records found in evidence events",
      evidenceIds,
      basis: ["artifact"],
    };
  }

  for (const ev of deliveryEvents) {
    const rawResult = (ev.payload as any).result ?? ev.payload;
    const parsed = BrowserResultSchema.safeParse(rawResult);
    if (!parsed.success) {
      return {
        name: "delivery",
        state: "FAIL",
        ruleId: "DELIVERY_SCHEMA_INVALID",
        reason: `Delivery result does not match BrowserResult schema: ${parsed.error.message}`,
        evidenceIds,
        basis: ["artifact"],
      };
    }
  }

  // Results match the schema, but provider signatures and result hashes
  // were not checked, so delivery is not proven.
  return {
    name: "delivery",
    state: "UNVERIFIABLE",
    ruleId: "DELIVERY_SIGNATURES_NOT_CHECKED",
    reason:
      "Delivered results match the result schema; provider signatures and result hashes were not checked",
    evidenceIds,
    basis: ["recorder_assertion"],
  };
}
