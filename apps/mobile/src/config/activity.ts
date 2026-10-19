import type { Capability } from "./capabilities";

// "unavailable" means the app cannot know what happened (no working source);
// "empty" means a working source reported no activity. The two must never be
// shown the same way. A loaded-list state arrives with the first real source.
export type HistoryState =
  | { kind: "unavailable"; sources: readonly Capability[] }
  | { kind: "empty" };

// Sources that would feed the history. Neither exists in this build.
const sources: readonly Capability[] = [
  {
    id: "personal-activity",
    title: "Personal wallet",
    detail: "Transfers from the wallet on this phone.",
    icon: "wallet-outline",
    tone: "blue",
    state: "notBuilt",
  },
  {
    id: "agent-activity",
    title: "Agent spending",
    detail: "Payments agents make from their own wallets.",
    icon: "robot-outline",
    tone: "amber",
    state: "notConnected",
  },
];

// The only state this build can report.
export const historyState: HistoryState = { kind: "unavailable", sources };
