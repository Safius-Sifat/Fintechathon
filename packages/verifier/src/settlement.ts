import { type EvidenceBundle, type Finding } from "@mandate/schema";

export function checkSettlement(bundle: EvidenceBundle): Finding {
  const { transactions, events } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  if (transactions.length === 0) {
    return {
      name: "settlement",
      state: "UNVERIFIABLE",
      ruleId: "SETTLEMENT_NO_TRANSACTIONS",
      reason:
        "The bundle records no transactions, and the wallet history was not scanned on the chain",
      evidenceIds,
      basis: ["recorder_assertion"],
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
        basis: ["recorder_assertion"],
      };
    }

    if (
      tx.status === "PENDING" ||
      (typeof tx.confirmations === "number" && tx.confirmations < 3)
    ) {
      return {
        name: "settlement",
        state: "PENDING",
        ruleId: "SETTLEMENT_CONFIRMATIONS_PENDING",
        reason: `Transaction ${tx.txHash} has fewer than 3 canonical confirmations (${tx.confirmations ?? 0})`,
        evidenceIds,
        basis: ["recorder_assertion"],
      };
    }
  }

  // Recorded statuses look settled, but receipts were not read from the
  // chain, so settlement is not proven.
  return {
    name: "settlement",
    state: "UNVERIFIABLE",
    ruleId: "SETTLEMENT_NOT_READ_FROM_CHAIN",
    reason: `${transactions.length} transactions are recorded as settled; receipts and transfers were not read from the chain`,
    evidenceIds,
    basis: ["recorder_assertion"],
  };
}
