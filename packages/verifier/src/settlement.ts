import {
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";

export function checkSettlement(bundle: EvidenceBundle): Finding {
  const { transactions, events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  if (transactions.length === 0) {
    return {
      name: "settlement",
      state: "PASS",
      ruleId: "SETTLEMENT_NO_TRANSACTIONS",
      reason: "No on-chain settlements required or performed for this task",
      evidenceIds,
      basis: ["chain"],
    };
  }

  for (const tx of transactions as any[]) {
    if (tx.status === "REVERTED") {
      return {
        name: "settlement",
        state: "FAIL",
        ruleId: "SETTLEMENT_TRANSACTION_REVERTED",
        reason: `On-chain transaction ${tx.txHash ?? "unknown"} reverted on chain`,
        evidenceIds,
        basis: ["chain"],
      };
    }

    if (tx.status === "PENDING" || (typeof tx.confirmations === "number" && tx.confirmations < 3)) {
      return {
        name: "settlement",
        state: "PENDING",
        ruleId: "SETTLEMENT_CONFIRMATIONS_PENDING",
        reason: `Transaction ${tx.txHash} has fewer than 3 canonical confirmations (${tx.confirmations ?? 0})`,
        evidenceIds,
        basis: ["chain"],
      };
    }
  }

  return {
    name: "settlement",
    state: "PASS",
    ruleId: "SETTLEMENT_VERIFIED",
    reason: `All ${transactions.length} transactions settled with required confirmations on Base Sepolia`,
    evidenceIds,
    basis: ["chain"],
  };
}
