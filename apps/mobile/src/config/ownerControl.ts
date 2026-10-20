import type { ControlId } from "./agentControls";
import type { StateInfo } from "./taskStatus";

// Owner control and recovery (plan P3-05, S8.3, S8.5; WQ07, WQ10, WQ12).
// The owner can stop agents and recover agent wallet funds without the
// Mandate service or the agent signer (MPC), but never without a network
// connection and someone paying gas. A control counts only once it is
// confirmed on chain, and then only with its own effect. Restoring the local
// wallet is a separate thing from recovering agent wallet funds.

// Owner operations on the Control screen, in display order.
export const OWNER_CONTROL_IDS = [
  "pause",
  "unpause",
  "revoke",
  "recover",
  "recoverLiquid",
  "ownerSweep",
] as const satisfies readonly ControlId[];

export type OwnerControlId = (typeof OWNER_CONTROL_IDS)[number];
export type SignedCommandKind = "admin" | "ownerTransfer";

export interface SignedCommand {
  title: string;
  // EIP-712 fields in Person1's order (tested against authorityTypes).
  typedFields: readonly string[];
  maxLifetimeMinutes: number;
  // The wallet counter the command must match.
  nonce: string;
  // Export envelope for an independent sender, or null when the shared
  // interface does not define one yet.
  exportFields: readonly string[] | null;
  exportNote: string;
}

// The two owner command types (plan S3, S8.3, P3-05). They have separate
// nonces and lifetimes; one never stands in for the other.
export const SIGNED_COMMANDS: Record<SignedCommandKind, SignedCommand> = {
  admin: {
    title: "Admin command",
    typedFields: ["command", "permitId", "nonce", "issuedAt", "deadline"],
    maxLifetimeMinutes: 30,
    nonce: "adminNonce",
    exportFields: [
      "schemaVersion",
      "chainId",
      "wallet",
      "admin",
      "ownerSignature",
      "digest",
    ],
    exportNote:
      "Defined in the plan for pause, unpause, revoke and both recover commands.",
  },
  ownerTransfer: {
    title: "Owner transfer",
    typedFields: [
      "transferId",
      "asset",
      "recipient",
      "amount",
      "epoch",
      "nonce",
      "issuedAt",
      "deadline",
    ],
    maxLifetimeMinutes: 10,
    nonce: "ownerTransferNonce",
    exportFields: null,
    exportNote:
      "The export format for an owner transfer is not yet defined in the shared interface.",
  },
};

export const COMMAND_FOR: Record<OwnerControlId, SignedCommandKind> = {
  pause: "admin",
  unpause: "admin",
  revoke: "admin",
  recover: "admin",
  recoverLiquid: "admin",
  ownerSweep: "ownerTransfer",
};

// An expired command proves nothing about an earlier copy that was sent or
// handed to another sender. Check these on chain before a replacement.
export const RECONCILE_BEFORE_REPLACEMENT = [
  "Whether the earlier command was included on chain",
  "The wallet's current nonce for that command type",
  "The current authority epoch",
] as const;

export type ControlStep =
  | "prepared"
  | "signed"
  | "submitted"
  | "confirmed"
  | "reverted"
  | "expired";

export const STEP_ORDER = [
  "prepared",
  "signed",
  "submitted",
  "confirmed",
  "reverted",
  "expired",
] as const satisfies readonly ControlStep[];

export const STEP_INFO: Record<ControlStep, StateInfo & { detail: string }> = {
  prepared: {
    label: "Prepared",
    group: "waiting",
    detail:
      "Built on this phone from fresh chain reads. Nothing is signed or sent.",
  },
  signed: {
    label: "Signed, not sent",
    group: "waiting",
    detail:
      "You signed on the protected screen. Nothing has changed on chain yet.",
  },
  submitted: {
    label: "Sent, waiting for confirmation",
    group: "active",
    detail:
      "The transaction is on its way. Nothing changes on chain until it is confirmed, and payments sent before it may still settle.",
  },
  confirmed: {
    label: "Confirmed on chain",
    group: "done",
    detail:
      "Included on chain. From this point the operation's own effect applies. For example, a pause ends every permission, a revoke ends one task's permission and an unpause stops nothing.",
  },
  reverted: {
    label: "Failed on chain",
    group: "problem",
    detail:
      "Nothing changed. Nonces, permissions and funds are as the chain shows them.",
  },
  expired: {
    label: "Expired",
    group: "ended",
    detail:
      "Its deadline has passed, so it can no longer be included. That does not prove an earlier sent or relayed copy never ran. Check its status and the current nonce and epoch on chain before preparing a replacement.",
  },
};

export function countsAsDone(step: ControlStep): boolean {
  return step === "confirmed";
}

export interface FeeRoute {
  id: "sponsor" | "personal" | "independent";
  title: string;
  payer: string;
  needs: readonly string[];
  // Whether this build can use the route. None can yet.
  available: boolean;
  unavailableReason: string;
}

export const FEE_ROUTES: readonly FeeRoute[] = [
  {
    id: "sponsor",
    title: "Mandate relay",
    payer: "The Mandate service pays the fee",
    needs: ["The Mandate service", "A network connection"],
    available: false,
    unavailableReason: "This build does not connect to the Mandate service.",
  },
  {
    id: "personal",
    title: "Your personal account",
    payer: "Your personal account pays the fee in ETH",
    needs: [
      "Enough ETH on your personal account for gas",
      "A network connection to a trusted RPC",
    ],
    available: false,
    unavailableReason:
      "Needs a wallet on this phone and the native relay, which is not built.",
  },
  {
    id: "independent",
    title: "Someone else sends it",
    payer: "An independent funded sender pays the fee",
    needs: [
      "The signed command, exported from this phone",
      "A sender with ETH for gas and its own network connection (RPC)",
    ],
    available: false,
    unavailableReason: "Exporting a signed command is not built.",
  },
];

export interface RecoveryNeed {
  id: "words" | "passphrase" | "index";
  title: string;
  detail: string;
  optional: boolean;
}

// What restoring the local wallet needs (plan S8.1).
export const RECOVERY_NEEDS: readonly RecoveryNeed[] = [
  {
    id: "words",
    title: "Recovery words",
    detail:
      "The 12 words you wrote down, in order. Other standard lengths can be restored too.",
    optional: false,
  },
  {
    id: "passphrase",
    title: "Passphrase, if you added one",
    detail:
      "An extra phrase on top of the words. A different passphrase opens a different wallet, with no error.",
    optional: true,
  },
  {
    id: "index",
    title: "Account number",
    detail:
      "Which account you used (0 to 19). The words alone may restore a different address.",
    optional: false,
  },
];

export interface LocalAction {
  id: "logout" | "removeWallet";
  title: string;
  effect: string;
  stopsAgents: boolean;
  onChain: boolean;
}

// Local actions that never stop agents (plan S8.5, WQ10).
export const LOCAL_ACTIONS: readonly LocalAction[] = [
  {
    id: "logout",
    title: "Log out",
    effect:
      "Ends this phone's session with the Mandate service. Agents keep working under the permissions you approved.",
    stopsAgents: false,
    onChain: false,
  },
  {
    id: "removeWallet",
    title: "Remove wallet from this phone",
    effect:
      "Deletes this phone's copy of your owner key. Agent permissions and funds stay on chain. Pause agents first if you want them stopped.",
    stopsAgents: false,
    onChain: false,
  },
];
