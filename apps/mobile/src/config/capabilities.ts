import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";

// What this build can actually do. Every value here must describe the real
// state of the app: a capability only becomes "configured" when the code
// behind it exists and works. Nothing is simulated.

export type CapabilityState =
  | "configured"
  | "notBuilt"
  | "notConnected"
  | "unavailable";

export interface Capability {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  tone: Tone;
  state: CapabilityState;
  // Overrides the state's default tag text.
  stateLabel?: string;
}

// Literal `false` types: turning any of these on is a deliberate, reviewed
// code change, not a runtime flag.
export const preview = {
  hasOwnerWallet: false,
  canSign: false,
  canMoveFunds: false,
  hasMandateService: false,
} as const;

export const securityCapabilities: readonly Capability[] = [
  {
    id: "owner-key",
    title: "Owner key",
    detail: "The signing key for your personal wallet on this phone.",
    icon: "key-outline",
    tone: "violet",
    state: "notBuilt",
  },
  {
    id: "app-unlock",
    title: "App unlock",
    detail: "Unlock with your device screen lock or biometrics.",
    icon: "fingerprint",
    tone: "green",
    state: "notBuilt",
  },
  {
    id: "recovery-backup",
    title: "Recovery phrase backup",
    detail: "Will only ever appear on a dedicated secure screen.",
    icon: "shield-key-outline",
    tone: "amber",
    state: "notBuilt",
  },
  {
    id: "signing",
    title: "Transaction signing",
    detail: "Needs the owner key on this phone.",
    icon: "draw-pen",
    tone: "blue",
    state: "notBuilt",
  },
];

export const connectionCapabilities: readonly Capability[] = [
  {
    id: "mandate-service",
    title: "Mandate service",
    detail: "Sign-in, agent mandates and activity history.",
    icon: "cloud-outline",
    tone: "slate",
    state: "notConnected",
  },
  {
    id: "agent-wallets",
    title: "Agent wallets",
    detail: "Separate wallets your agents spend from.",
    icon: "robot-outline",
    tone: "amber",
    state: "notConnected",
  },
];

export const agentCapabilities: readonly Capability[] = [
  {
    id: "agent-wallet-create",
    title: "Create an agent wallet",
    detail: "A separate wallet an agent spends from, funded by you.",
    icon: "robot-outline",
    tone: "amber",
    state: "notBuilt",
  },
  {
    id: "agent-tasks",
    title: "Tasks and approvals",
    detail: "Describe a task, check its exact terms, then approve it.",
    icon: "clipboard-check-outline",
    tone: "blue",
    state: "notBuilt",
  },
  {
    id: "agent-stop",
    title: "Pause, end and freeze",
    detail: "Stop agents from this phone, even when the service is offline.",
    icon: "hand-back-left-outline",
    tone: "green",
    state: "notBuilt",
  },
  {
    id: "agent-proof",
    title: "Proof",
    detail: "Six findings and a file you can check without Mandate.",
    icon: "shield-check-outline",
    tone: "violet",
    state: "notBuilt",
  },
];
