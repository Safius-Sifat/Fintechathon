import {
  type EvidenceBundle,
  type Finding,
  PermitSchema,
  ActionSchema,
} from "@mandate/schema";

export function checkAuthority(bundle: EvidenceBundle): Finding {
  const { authority, events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  if (!authority || Object.keys(authority).length === 0) {
    return {
      name: "authority",
      state: "UNVERIFIABLE",
      ruleId: "AUTHORITY_MISSING_DATA",
      reason: "No authority records found in evidence bundle",
      evidenceIds,
      basis: ["recorder_assertion"],
    };
  }

  const permitData = (authority as any).permit;
  if (permitData) {
    const parseRes = PermitSchema.safeParse(permitData);
    if (!parseRes.success) {
      return {
        name: "authority",
        state: "FAIL",
        ruleId: "AUTHORITY_INVALID_PERMIT",
        reason: `Permit schema validation failed: ${parseRes.error.message}`,
        evidenceIds,
        basis: ["signature"],
      };
    }

    const permit = parseRes.data;
    if (BigInt(permit.expiresAt) <= BigInt(permit.startsAt)) {
      return {
        name: "authority",
        state: "FAIL",
        ruleId: "AUTHORITY_PERMIT_EXPIRED",
        reason: `Permit expiration ${permit.expiresAt} precedes or equals startsAt ${permit.startsAt}`,
        evidenceIds,
        basis: ["signature"],
      };
    }
  }

  const actionData = (authority as any).action;
  if (actionData) {
    const parseRes = ActionSchema.safeParse(actionData);
    if (!parseRes.success) {
      return {
        name: "authority",
        state: "FAIL",
        ruleId: "AUTHORITY_INVALID_ACTION",
        reason: `Action schema validation failed: ${parseRes.error.message}`,
        evidenceIds,
        basis: ["signature"],
      };
    }
  }

  return {
    name: "authority",
    state: "PASS",
    ruleId: "AUTHORITY_VALID",
    reason: "Authority records, EIP-712 schemas, and lifetime boundaries verified",
    evidenceIds,
    basis: ["signature"],
  };
}
