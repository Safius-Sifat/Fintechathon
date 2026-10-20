import type { EvidenceBundle, Finding } from "@mandate/schema";
import {
  REQUIRED_CONFIRMATIONS,
  executedActions,
  type VerifyContext,
} from "./context.js";

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({
  name: "settlement",
  state,
  ruleId,
  reason,
  evidenceIds,
  basis,
});

// Reads every recorded transaction from the chain: it must succeed, have three
// confirmations and execute the recorded action in this wallet.
export function checkSettlement(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Finding {
  const ids = bundle.events.map((e) => e.eventId);
  const txs = bundle.transactions as {
    txHash?: string;
    requestId?: string;
    state?: string;
  }[];
  if (!ctx.chain)
    return finding(
      "UNVERIFIABLE",
      "SETTLEMENT_NOT_READ_FROM_CHAIN",
      `${txs.length} recorded transactions were not read from the chain (no RPC given)`,
      ids,
      ["recorder_assertion"],
    );
  if (txs.length === 0)
    return finding(
      "UNVERIFIABLE",
      "SETTLEMENT_NO_TRANSACTIONS",
      "The bundle records no transactions",
      ids,
      ["recorder_assertion"],
    );
  for (const tx of txs) {
    if (!tx.txHash)
      return finding(
        "FAIL",
        "SETTLEMENT_MISSING_HASH",
        "A recorded transaction has no hash",
        ids,
        ["artifact"],
      );
    const receipt = ctx.chain.receipts.get(tx.txHash.toLowerCase());
    if (!receipt)
      return finding(
        "PENDING",
        "SETTLEMENT_NOT_FOUND",
        `Transaction ${tx.txHash} is not in a block`,
        ids,
        ["chain"],
      );
    if (receipt.status !== "success")
      return finding(
        "FAIL",
        "SETTLEMENT_REVERTED",
        `Transaction ${tx.txHash} reverted`,
        ids,
        ["chain"],
      );
    if (
      ctx.chain.latestBlock - receipt.blockNumber + 1n <
      REQUIRED_CONFIRMATIONS
    )
      return finding(
        "PENDING",
        "SETTLEMENT_CONFIRMATIONS_PENDING",
        `Transaction ${tx.txHash} has fewer than 3 confirmations`,
        ids,
        ["chain"],
      );
    const acted = executedActions(receipt, bundle.manifest.wallet).some(
      (a) =>
        !tx.requestId ||
        a.requestId.toLowerCase() === tx.requestId.toLowerCase(),
    );
    if (!acted)
      return finding(
        "FAIL",
        "SETTLEMENT_NOT_THIS_ACTION",
        `Transaction ${tx.txHash} does not execute the recorded action in this wallet`,
        ids,
        ["chain"],
      );
  }
  return finding(
    "PASS",
    "SETTLEMENT_RECORDED_CONFIRMED",
    `All ${txs.length} recorded transactions executed in this wallet with 3 confirmations`,
    ids,
    ["chain"],
  );
}
