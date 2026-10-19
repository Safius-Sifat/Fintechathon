import type { ApprovalState, OperationName } from "./approvals";

// DEVELOPMENT SAMPLES. Placeholder approval requests and one alert that let
// the Approvals, Approval detail and Alerts layouts be reviewed before the
// Mandate service exists. Screens show them only when __DEV__ is true, and
// always with a "Development sample" label. There is no approved sample:
// nothing here may look like a decision the owner made. Addresses are
// words, not hex.

export interface SampleApproval {
  id: string;
  state: ApprovalState;
  operation: OperationName;
  task: string;
  provider: string;
  recipient: string;
  asset: "DemoUSD";
  amount: string;
  baseUnits: string;
  reviewThreshold: string;
  // Unix seconds, relative to when the app loaded so the countdown reads
  // sensibly during review.
  expiresAt: string;
  rationale: string;
}

const loadedAt = Math.floor(Date.now() / 1000);

export const SAMPLE_APPROVALS: readonly SampleApproval[] = [
  {
    id: "sample-approval-1",
    state: "PENDING",
    operation: "PAY",
    task: "Checkout check with fallback (sample)",
    provider: "Provider B",
    recipient: "Sample provider B address",
    asset: "DemoUSD",
    amount: "0.35",
    baseUnits: "350000",
    reviewThreshold: "0.30 DemoUSD",
    expiresAt: String(loadedAt + 12 * 60),
    rationale:
      "Provider A was paid but did not deliver in time. Provider B offers the same checks. Its price is above your review threshold, so I am asking for approval.",
  },
  {
    id: "sample-approval-2",
    state: "EXPIRED",
    operation: "PAY",
    task: "Form check (sample)",
    provider: "Provider A",
    recipient: "Sample provider A address",
    asset: "DemoUSD",
    amount: "0.20",
    baseUnits: "200000",
    reviewThreshold: "0.10 DemoUSD",
    expiresAt: String(loadedAt - 5 * 60),
    rationale: "Provider A is the cheapest provider that offers this check.",
  },
];

export function findSampleApproval(id: string): SampleApproval | undefined {
  return SAMPLE_APPROVALS.find((sample) => sample.id === id);
}

export const SAMPLE_ALERT = {
  title: "Unusual spending speed",
  detail:
    "Sample: five payment attempts in two minutes, faster than the service's risk rules allow.",
  rule: "Sample velocity rule",
  detected: "Sample time",
  hold: "On (sample)",
};
