import type {
  ACTION_STATES,
  AUTHORITY_STATES,
  OUTCOME_STATES,
  TaskView,
} from "@mandate/schema";

// Labels for Person1's shared task states (plan S5). A task's useful
// outcome, its spending authority, each payment and the delivery are
// separate facts with separate states; the Task screen never folds them
// into one badge. Type-only import: nothing from the schema package is
// bundled into the app.

export type OutcomeState = (typeof OUTCOME_STATES)[number];
export type AuthorityState = (typeof AUTHORITY_STATES)[number];
export type ActionState = (typeof ACTION_STATES)[number];
export type DeliveryState = TaskView["delivery"]["state"];

export type StateGroup =
  | "waiting"
  | "attention"
  | "active"
  | "done"
  | "ended"
  | "problem"
  | "unknown";

export interface StateInfo {
  label: string;
  group: StateGroup;
}

export const OUTCOME_INFO: Record<OutcomeState, StateInfo> = {
  DRAFT: { label: "Draft, not approved", group: "waiting" },
  AWAITING_OWNER: { label: "Waiting for your approval", group: "attention" },
  READY: { label: "Approved, not started", group: "waiting" },
  RUNNING: { label: "Running", group: "active" },
  AWAITING_AGENT: { label: "Waiting for the agent", group: "active" },
  COMPLETED: { label: "Result delivered", group: "done" },
  DELIVERY_FAILED: { label: "Delivery failed", group: "problem" },
  NEEDS_OWNER: { label: "Needs your attention", group: "attention" },
  CANCELLED: { label: "Cancelled", group: "ended" },
};

export const AUTHORITY_INFO: Record<AuthorityState, StateInfo> = {
  PENDING: { label: "Not active yet", group: "waiting" },
  ACTIVE: { label: "Active, agent can spend", group: "active" },
  FROZEN: { label: "Frozen, no spending", group: "attention" },
  // Useful output can arrive before the permission is closed on chain.
  CLOSING: { label: "Closing, not closed yet", group: "waiting" },
  CLOSED: { label: "Closed", group: "ended" },
  REVOKED: { label: "Revoked", group: "ended" },
  EXPIRED: { label: "Expired", group: "ended" },
  INVALIDATED: { label: "Ended by an owner stop", group: "ended" },
};

export const ACTION_INFO: Record<ActionState, StateInfo> = {
  PROPOSED: { label: "Proposed", group: "waiting" },
  RESERVED: { label: "Budget reserved", group: "waiting" },
  AWAITING_APPROVAL: { label: "Waiting for your approval", group: "attention" },
  SIGNING: { label: "Signing", group: "active" },
  SIGNED: { label: "Signed, not sent", group: "active" },
  SUBMITTED: { label: "Sent, waiting to be included", group: "active" },
  // Delivery may proceed at INCLUDED, but it is never called final.
  INCLUDED: { label: "Included, not final yet", group: "done" },
  FINALIZED: { label: "Finalized", group: "done" },
  DENIED: { label: "Denied before signing", group: "problem" },
  REJECTED: { label: "Rejected by you", group: "ended" },
  REVERTED: { label: "Failed on chain", group: "problem" },
  // The reservation is kept while the recorded operation is reconciled; no
  // new, duplicate payment is created automatically (plan S4, S5).
  UNKNOWN: { label: "Status unknown", group: "unknown" },
};

export const DELIVERY_INFO: Record<DeliveryState, StateInfo> = {
  NONE: { label: "No delivery yet", group: "waiting" },
  PENDING: { label: "Waiting for the result", group: "active" },
  VALID: { label: "Result received and checked", group: "done" },
  INVALID: { label: "Result failed its checks", group: "problem" },
  FAILED: { label: "Not delivered", group: "problem" },
};
