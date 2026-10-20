import type { AGENT_SCOPES } from "@mandate/schema";
import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";
import type { CapabilityState } from "./capabilities";

// Security and agent access (plan P3-W01, P3-W03, S8.5; WQ09, WQ10). Three
// separate things live here and none stands in for another:
// - this phone: app lock, backup and removing the local wallet;
// - the Mandate service: this phone's session, other devices' sessions and
//   agent tokens;
// - the chain: the permissions agents spend under.
// Nothing on this phone or the service ends those permissions; only
// confirmed on-chain owner operations do (pause, revoke, both recovers and
// owner transfers).

export const SECURITY_INTRO =
  "This phone, your service sessions and your agents' access are separate. None of them stops agents: only owner controls confirmed on chain do.";

export const TOKEN_REVOKE_NOTE =
  "It stops that tool from calling the service. Permissions you approved stay in force on chain until an owner control there, such as a pause or revoke, is confirmed.";

// The comparison below covers only the actions on the Security screen.
export const ACTIONS_SCOPE_NOTE =
  "This list covers the actions on this screen. Elsewhere, a confirmed Recover, Recover liquid or owner transfer from the agent wallet also pauses agents and ends every permission.";

export type ActsOn = "phone" | "service" | "chain";

export const ACTS_ON_LABEL: Record<ActsOn, string> = {
  phone: "This phone",
  service: "Mandate service",
  chain: "On chain",
};

export interface SecurityAction {
  id:
    | "lock"
    | "logout"
    | "revokeSessions"
    | "revokeAgentToken"
    | "removeWallet"
    | "pause"
    | "revoke";
  title: string;
  actsOn: ActsOn;
  effect: string;
  endsOnChainPermissions: boolean;
  // Whether this build can do it. None can yet.
  available: boolean;
}

// In the order shown on the Security screen's comparison.
export const SECURITY_ACTIONS: readonly SecurityAction[] = [
  {
    id: "lock",
    title: "Lock the app",
    actsOn: "phone",
    effect:
      "Hides the wallet until you unlock it on this phone. Agents keep working under the permissions you approved.",
    endsOnChainPermissions: false,
    available: false,
  },
  {
    id: "logout",
    title: "Log out",
    actsOn: "service",
    effect:
      "Ends this phone's session with the Mandate service. Your owner key stays on the phone, and agents keep working.",
    endsOnChainPermissions: false,
    available: false,
  },
  {
    id: "revokeSessions",
    title: "Sign out other devices",
    actsOn: "service",
    effect:
      "Ends the service sessions of your other devices. Agents keep working under the permissions you approved.",
    endsOnChainPermissions: false,
    available: false,
  },
  {
    id: "revokeAgentToken",
    title: "Revoke an agent token",
    actsOn: "service",
    effect:
      "Stops that agent tool from calling the Mandate service. Permissions you approved on chain stay in force.",
    endsOnChainPermissions: false,
    available: false,
  },
  {
    id: "removeWallet",
    title: "Remove wallet from this phone",
    actsOn: "phone",
    effect:
      "Deletes this phone's copy of your owner key. Funds and permissions stay on chain, and agents keep working.",
    endsOnChainPermissions: false,
    available: false,
  },
  {
    id: "pause",
    title: "Pause agents",
    actsOn: "chain",
    effect:
      "Once confirmed on chain, ends every permission. Unpausing does not bring them back.",
    endsOnChainPermissions: true,
    available: false,
  },
  {
    id: "revoke",
    title: "Revoke a permission",
    actsOn: "chain",
    effect:
      "Once confirmed on chain, ends one task's permission. Other tasks keep running.",
    endsOnChainPermissions: true,
    available: false,
  },
];

export type AgentScope = (typeof AGENT_SCOPES)[number];

export interface ScopeInfo {
  id: AgentScope;
  title: string;
  detail: string;
}

// The service's agent-token scopes (shared schema AGENT_SCOPES, tested).
export const AGENT_SCOPE_INFO: readonly ScopeInfo[] = [
  {
    id: "read",
    title: "Read",
    detail: "See the wallet's tasks, status and activity.",
  },
  {
    id: "prepare",
    title: "Prepare",
    detail: "Draft tasks for you to review. You still approve each one.",
  },
  {
    id: "run",
    title: "Run",
    detail: "Start and follow tasks you already approved.",
  },
  {
    id: "evidence",
    title: "Evidence",
    detail:
      "Read task evidence, which can be private. Kept separate from Read for that reason.",
  },
];

// What no agent token can do, whatever its scopes (plan S4, S8.6).
export const AGENT_TOKEN_CANNOT: readonly string[] = [
  "Sign anything with your owner key",
  "Approve, pause, revoke or recover",
  "Make an owner transfer",
  "Change your sessions or devices",
];

export interface LocalSecurityItem {
  id: "appLock" | "backup" | "removeWallet";
  title: string;
  detail: string;
  icon: IconName;
  tone: Tone;
  state: CapabilityState;
}

// Protections on this phone. None is built, so none is shown as on.
export const LOCAL_SECURITY: readonly LocalSecurityItem[] = [
  {
    id: "appLock",
    title: "App lock",
    detail:
      "Unlock with your screen lock or biometrics, and lock again after a set time. Locking does not stop agents.",
    icon: "fingerprint",
    tone: "green",
    state: "notBuilt",
  },
  {
    id: "backup",
    title: "Recovery words backup",
    detail:
      "There is no wallet on this phone yet, so there is nothing to back up. Words are only ever shown on a protected screen.",
    icon: "shield-key-outline",
    tone: "amber",
    state: "notBuilt",
  },
  {
    id: "removeWallet",
    title: "Remove wallet from this phone",
    detail:
      "Needs your screen lock and a confirmed backup first. Funds and permissions stay on chain.",
    icon: "delete-outline",
    tone: "red",
    state: "notBuilt",
  },
];
