import type { SegmentOption } from "../components/Segmented";
import type {
  AgentAsset,
  Check,
  ProviderId,
  ScheduleInterval,
  TargetId,
} from "../state/taskDraft";

// Display text shared by the task forms and the review screen.

export const CHECK_LABELS: Record<Check, { label: string; detail: string }> = {
  pageLoad: { label: "Page loads", detail: "The page opens without errors." },
  title: {
    label: "Page title matches",
    detail: "The title equals the one in the trusted manifest.",
  },
  formSubmit: {
    label: "Form submits",
    detail: "A test form can be sent. A failure is a valid result.",
  },
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  a: "Provider A",
  b: "Provider B",
};

export const TARGET_LABELS: Record<TargetId, string> = {
  "checkout-healthy": "Healthy checkout",
  "checkout-broken": "Broken checkout",
};

export const ASSET_LABELS: Record<AgentAsset, string> = {
  DemoUSD: "DemoUSD",
  USDC: "Test USDC",
};

export const AGENT_ASSET_OPTIONS: readonly SegmentOption<AgentAsset>[] = [
  { key: "DemoUSD", label: ASSET_LABELS.DemoUSD },
  {
    key: "USDC",
    label: ASSET_LABELS.USDC,
    detail: "Needs a wallet policy cap",
  },
];

export const INTERVAL_LABELS: Record<ScheduleInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  demo: "Demo (fast)",
};
