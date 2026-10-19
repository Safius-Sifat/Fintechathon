import type { Capability } from "./capabilities";

// Personal and agent-wallet histories come from different sources and are
// shown separately. Neither source exists in this build, so the only state
// is "unavailable": the app cannot know what happened. That is never shown
// as an empty history. Loaded and empty states arrive with the first real
// source (P3-W03).

export type ActivitySource = "personal" | "agent";

interface HistorySource {
  body: string;
  source: Capability;
}

export const historySources: Record<ActivitySource, HistorySource> = {
  personal: {
    body: "This is not an empty history. This build cannot read personal activity because there is no wallet on this phone.",
    source: {
      id: "personal-activity",
      title: "Personal account history",
      detail: "Transfers to and from your account, read from the chain.",
      icon: "wallet-outline",
      tone: "blue",
      state: "notBuilt",
    },
  },
  agent: {
    body: "This is not an empty history. This build cannot read agent-wallet activity because the Mandate service is not connected.",
    source: {
      id: "agent-activity",
      title: "Agent wallet history",
      detail: "Agent payments, funding and owner transfers.",
      icon: "robot-outline",
      tone: "amber",
      state: "notConnected",
    },
  },
};
