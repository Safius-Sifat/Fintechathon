import {
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";

export function checkPolicy(bundle: EvidenceBundle): Finding {
  const { authority, transactions, events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  const permit = (authority as any)?.permit;
  if (!permit) {
    return {
      name: "policy",
      state: "UNVERIFIABLE",
      ruleId: "POLICY_PERMIT_ABSENT",
      reason: "No permit available to evaluate policy limits against",
      evidenceIds,
      basis: ["recorder_assertion"],
    };
  }

  const spendCap = BigInt(permit.spendCap ?? "0");
  const maxPayment = BigInt(permit.maxPayment ?? "0");

  let totalSpent = 0n;
  for (const tx of transactions as any[]) {
    const amount = BigInt(tx.amount ?? "0");
    if (maxPayment > 0n && amount > maxPayment) {
      return {
        name: "policy",
        state: "FAIL",
        ruleId: "POLICY_MAX_PAYMENT_EXCEEDED",
        reason: `Transaction amount ${amount} exceeds permit maxPayment limit ${maxPayment}`,
        evidenceIds,
        basis: ["chain"],
      };
    }
    totalSpent += amount;
  }

  if (spendCap > 0n && totalSpent > spendCap) {
    return {
      name: "policy",
      state: "FAIL",
      ruleId: "POLICY_SPEND_CAP_EXCEEDED",
      reason: `Total spent ${totalSpent} exceeds permit spendCap ${spendCap}`,
      evidenceIds,
      basis: ["chain"],
    };
  }

  return {
    name: "policy",
    state: "PASS",
    ruleId: "POLICY_LIMITS_SATISFIED",
    reason: `All ${transactions.length} transactions strictly adhere to spendCap (${spendCap}) and maxPayment (${maxPayment})`,
    evidenceIds,
    basis: ["chain"],
  };
}
