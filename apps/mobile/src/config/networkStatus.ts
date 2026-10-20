import type { CapabilityState } from "./capabilities";
import { network } from "./network";

// Network status (plan S8, P3-W04 Network/Help). The chain comes from the
// app config. Nothing else is configured or checked yet, so nothing claims a
// working RPC, a loaded manifest or a live connection.

export interface NetworkStatusItem {
  id: "chain" | "rpc" | "connection" | "block" | "manifest" | "explorer";
  label: string;
  value: string;
  state: CapabilityState;
  detail: string;
}

export const NETWORK_STATUS: readonly NetworkStatusItem[] = [
  {
    id: "chain",
    label: "Network",
    value: `${network.name} · Chain ${network.chainId}`,
    state: "configured",
    detail: "Other chains are not supported.",
  },
  {
    id: "rpc",
    label: "Trusted RPC",
    value: "Not configured",
    state: "notBuilt",
    detail: "The node this phone reads balances and the chain from.",
  },
  {
    id: "connection",
    label: "Connection",
    value: "Not checked",
    state: "notConnected",
    detail: "This build has never contacted the network.",
  },
  {
    id: "block",
    label: "Latest block",
    value: "Unavailable",
    state: "unavailable",
    detail: "Shows how fresh the data is once the phone reads the chain.",
  },
  {
    id: "manifest",
    label: "Deployment manifest",
    value: "Not loaded",
    state: "notBuilt",
    detail:
      "The trusted list of Mandate contract addresses and code to check them against.",
  },
  {
    id: "explorer",
    label: "Block explorer",
    value: "Not configured",
    state: "notBuilt",
    detail: "Where transaction links will open.",
  },
];

// Old or missing data is labelled, never shown as zero or empty.
export const STALE_RULES: readonly string[] = [
  "Offline: balances and history read Unavailable, not zero.",
  "Old data: shown with the block it came from and marked Stale.",
  "Unknown: a sent transaction with no answer stays Unknown until the chain shows what happened.",
];

// Getting test assets. Nothing here has real value.
export const FUNDING_STEPS: readonly string[] = [
  "Copy your personal account address from Receive.",
  "Get Base Sepolia test ETH from a faucet you trust. It pays the network fee for your own sends.",
  "DemoUSD and test USDC for agents come with the Mandate demo, not from you.",
];
