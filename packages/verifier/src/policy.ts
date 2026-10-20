import { type EvidenceBundle, type Finding } from "@mandate/schema";

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
        basis: ["recorder_assertion"],
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
      basis: ["recorder_assertion"],
    };
  }

  // Recorded amounts fit the permit, but nothing was replayed against the
  // chain, so the policy is not proven.
  return {
    name: "policy",
    state: "UNVERIFIABLE",
    ruleId: "POLICY_NOT_REPLAYED",
    reason: `Recorded amounts of ${transactions.length} transactions fit spendCap ${spendCap} and maxPayment ${maxPayment}; limits were not replayed against the chain`,
    evidenceIds,
    basis: ["recorder_assertion"],
  };
}
