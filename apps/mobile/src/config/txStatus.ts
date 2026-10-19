import type { LOCAL_TX_STATES } from "@mandate/schema";

// Display groups for Person1's shared transaction states (plan S8.2).
// Type-only import: nothing from the schema package is bundled into the app.

export type TxState = (typeof LOCAL_TX_STATES)[number];

export type StatusGroup =
  | "pending"
  | "confirmed"
  | "failed"
  | "replaced"
  | "unknown";

const GROUPS: Record<TxState, StatusGroup> = {
  DRAFT: "pending",
  AWAITING_SIGNATURE: "pending",
  SIGNED: "pending",
  SUBMITTED: "pending",
  INCLUDED: "confirmed",
  FINALIZED: "confirmed",
  REVERTED: "failed",
  REPLACED: "replaced",
  CANCELLED: "replaced",
  // A dropped or reorged transaction is not a failure until the nonce and
  // history are reconciled (S8.2).
  UNKNOWN: "unknown",
  REORGED: "unknown",
};

export function statusGroup(state: TxState): StatusGroup {
  return GROUPS[state];
}

export const STATE_LABELS: Record<TxState, string> = {
  DRAFT: "Draft, not sent",
  AWAITING_SIGNATURE: "Waiting for your confirmation",
  SIGNED: "Signed, not sent yet",
  SUBMITTED: "Sent, waiting to be included",
  INCLUDED: "Included (3 confirmations)",
  FINALIZED: "Finalized",
  REVERTED: "Failed on chain",
  REPLACED: "Replaced by a newer version",
  CANCELLED: "Cancelled by a replacement",
  UNKNOWN: "Status unknown",
  REORGED: "Undone by a chain reorganization",
};

export const GROUP_INFO: Record<
  StatusGroup,
  { title: string; detail: string }
> = {
  pending: {
    title: "Pending",
    detail:
      "Not on chain yet: a draft, waiting for confirmation, or sent and waiting.",
  },
  confirmed: {
    title: "Confirmed",
    detail:
      "Included with 3 confirmations, or finalized. Only these count as done.",
  },
  failed: {
    title: "Failed",
    detail: "Included on chain but reverted. Fees can still be charged.",
  },
  replaced: {
    title: "Replaced or cancelled",
    detail:
      "A newer version with the same nonce went through instead, so this one did not.",
  },
  unknown: {
    title: "Unknown",
    detail:
      "Missing or undone by a reorganization. Never shown as failed until checked again.",
  },
};
