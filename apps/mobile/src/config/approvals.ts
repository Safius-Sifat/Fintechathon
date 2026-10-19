import type { ApprovalRequest, Operation } from "@mandate/schema";
import type { StateInfo } from "./taskStatus";

// Owner co-signature requests (plan S9.5, P3-A01). A payment above the
// effective review threshold waits for the owner's signature for at most 15
// minutes. Only a pending request that has not expired can be decided, and
// approving needs the native confirmation screen. Type-only imports.

export type ApprovalState = ApprovalRequest["state"];
export type OperationName = keyof typeof Operation;

export const APPROVAL_STATE_INFO: Record<ApprovalState, StateInfo> = {
  PENDING: { label: "Waiting for your decision", group: "attention" },
  APPROVED: { label: "Approved by you", group: "done" },
  // Rejection or expiry releases the reservation; no signature exists.
  REJECTED: { label: "Rejected by you", group: "ended" },
  EXPIRED: { label: "Expired, not approved", group: "ended" },
};

export const APPROVAL_STATE_DETAIL: Record<ApprovalState, string> = {
  PENDING:
    "The payment is on hold. Nothing is paid unless you approve on the protected screen.",
  APPROVED:
    "You signed this exact payment. It can now be sent within its time limit.",
  REJECTED: "No signature was made. The reserved budget is released.",
  EXPIRED:
    "Time ran out before a decision. No signature was made and the reserved budget is released.",
};

export const OPERATION_LABELS: Record<OperationName, string> = {
  PAY: "Pay a provider",
  TRANSFER: "Scheduled transfer",
  DEPOSIT: "Deposit to the vault",
  WITHDRAW: "Withdraw from the vault",
  CLOSE: "Close the permission",
  CALL: "Approved contract call",
  X402: "x402 payment",
};

// Times are Unix seconds as decimal strings (plan S2).
export function canDecide(
  state: ApprovalState,
  expiresAt: string,
  nowSeconds: number,
): boolean {
  return state === "PENDING" && Number(expiresAt) > nowSeconds;
}

export function expiryLabel(expiresAt: string, nowSeconds: number): string {
  const left = Number(expiresAt) - nowSeconds;
  if (left <= 0) return "Expired";
  if (left < 60) return "Expires in under a minute";
  return `Expires in ${Math.ceil(left / 60)} min`;
}
