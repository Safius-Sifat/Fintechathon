import type { Finding } from "@mandate/schema";
import type {
  ActionState,
  AuthorityState,
  DeliveryState,
  OutcomeState,
  StateGroup,
} from "./taskStatus";

// DEVELOPMENT SAMPLES. Placeholder agent tasks that let the Task, Inspector
// and Schedule layouts be reviewed before the Mandate service exists.
// Screens show them only when __DEV__ is true, and always with a
// "Development sample" label. They are not tasks, payments, permissions or
// inspection results. Hashes and evidence IDs are words, not hex or UUIDs,
// so they cannot pass for real values.

export interface SamplePayment {
  provider: string;
  amount: string;
  state: ActionState;
  delivery: DeliveryState;
  hash: string;
  // What happened to this payment's delivery.
  deliveryNote: string;
}

export interface SampleCheck {
  label: string;
  result: string;
  passed: boolean;
}

export interface SampleTask {
  id: string;
  title: string;
  goal: string;
  target: string;
  outcome: OutcomeState;
  currentStep: string;
  authority: AuthorityState;
  asset: "DemoUSD";
  spendCap: string;
  grossSpent: string;
  // Shown under the gross amount, e.g. when a payment's outcome is unknown.
  grossNote?: string;
  remaining: string;
  paidAttempts: string;
  payments: readonly SamplePayment[];
  delivery: DeliveryState;
  deliveredBy: string;
  checks: readonly SampleCheck[];
  findings: readonly Finding[];
}

const finding = (
  name: Finding["name"],
  state: Finding["state"],
  reason: string,
  basis: Finding["basis"],
): Finding => ({
  name,
  state,
  ruleId: `sample-${name}-rule`,
  reason,
  evidenceIds: [`Sample ${name} evidence`],
  basis,
});

export const SAMPLE_TASKS: readonly SampleTask[] = [
  {
    id: "sample-task-1",
    title: "Checkout check with fallback",
    goal: "Check that the staging checkout loads and shows the right title.",
    target: "Healthy checkout",
    outcome: "COMPLETED",
    currentStep: "Closing the permission",
    authority: "CLOSING",
    asset: "DemoUSD",
    spendCap: "1.00",
    grossSpent: "0.55",
    remaining: "0.45 DemoUSD",
    paidAttempts: "2 of 3 used",
    payments: [
      {
        provider: "Provider A",
        amount: "0.20",
        state: "FINALIZED",
        delivery: "FAILED",
        hash: "Sample payment hash A",
        deliveryNote: "Paid, but no result arrived in time. Kept as a cost.",
      },
      {
        provider: "Provider B",
        amount: "0.35",
        state: "INCLUDED",
        delivery: "VALID",
        hash: "Sample payment hash B",
        deliveryNote: "Paid, and the result was delivered.",
      },
    ],
    delivery: "VALID",
    deliveredBy: "Provider B",
    checks: [
      { label: "Page loads", result: "Loaded", passed: true },
      {
        label: "Page title matches",
        result: "Sample title matches the expected sample title",
        passed: true,
      },
    ],
    findings: [
      finding("integrity", "PASS", "Sample: the evidence log is complete.", [
        "signature",
        "artifact",
      ]),
      finding(
        "authority",
        "PASS",
        "Sample: both payments were inside the signed permission.",
        ["chain", "signature"],
      ),
      finding("policy", "PASS", "Sample: spending stayed inside the policy.", [
        "chain",
      ]),
      finding(
        "settlement",
        "PENDING",
        "Sample: payment B is included but not finalized yet.",
        ["chain"],
      ),
      finding(
        "delivery",
        "PASS",
        "Sample: provider B's signed result matches the paid request.",
        ["signature", "artifact"],
      ),
      finding(
        "completion",
        "UNVERIFIABLE",
        "Sample: only the service's own record supports this.",
        ["recorder_assertion"],
      ),
    ],
  },
  {
    id: "sample-task-2",
    title: "Form check, negative result",
    goal: "Check whether the staging checkout form can be submitted.",
    target: "Broken checkout",
    outcome: "COMPLETED",
    currentStep: "Done",
    authority: "CLOSED",
    asset: "DemoUSD",
    spendCap: "0.50",
    grossSpent: "0.35",
    remaining: "None, the permission is closed",
    paidAttempts: "1 of 1 used",
    payments: [
      {
        provider: "Provider B",
        amount: "0.35",
        state: "FINALIZED",
        delivery: "VALID",
        hash: "Sample payment hash C",
        deliveryNote: "Paid, and the result was delivered.",
      },
    ],
    delivery: "VALID",
    deliveredBy: "Provider B",
    checks: [
      { label: "Page loads", result: "Loaded", passed: true },
      {
        label: "Form submits",
        result:
          "Did not submit. This is a valid result about the page, not a missing delivery.",
        passed: false,
      },
    ],
    findings: [
      finding("integrity", "PASS", "Sample: the evidence log is complete.", [
        "signature",
        "artifact",
      ]),
      finding("authority", "PASS", "Sample: the payment was permitted.", [
        "chain",
        "signature",
      ]),
      finding("policy", "PASS", "Sample: spending stayed inside the policy.", [
        "chain",
      ]),
      finding("settlement", "PASS", "Sample: the payment is finalized.", [
        "chain",
      ]),
      finding(
        "delivery",
        "PASS",
        "Sample: the negative form result is a valid delivery.",
        ["signature", "artifact"],
      ),
      finding(
        "completion",
        "PASS",
        "Sample: the outcome matches the recorded steps.",
        ["chain", "artifact"],
      ),
    ],
  },
  {
    id: "sample-task-3",
    title: "Payment status unknown",
    goal: "Check that the staging checkout loads.",
    target: "Healthy checkout",
    outcome: "RUNNING",
    currentStep: "Checking the payment status",
    authority: "ACTIVE",
    asset: "DemoUSD",
    spendCap: "0.60",
    grossSpent: "0.20",
    grossNote: "Reserved. Whether it was paid on chain is not known yet.",
    remaining: "0.40 DemoUSD",
    paidAttempts: "1 of 2 used",
    payments: [
      {
        provider: "Provider A",
        amount: "0.20",
        state: "UNKNOWN",
        delivery: "NONE",
        hash: "Not known yet",
        deliveryNote:
          "Delivery waits until this recorded payment is reconciled.",
      },
    ],
    delivery: "PENDING",
    deliveredBy: "Not delivered yet",
    checks: [],
    findings: [
      finding(
        "integrity",
        "FAIL",
        "Sample: the evidence log has a gap in its sequence.",
        ["signature"],
      ),
      finding("authority", "PASS", "Sample: the payment was permitted.", [
        "chain",
        "signature",
      ]),
      finding("policy", "PASS", "Sample: spending stayed inside the policy.", [
        "chain",
      ]),
      finding(
        "settlement",
        "PENDING",
        "Sample: the payment has not been seen on chain.",
        ["chain"],
      ),
      finding("delivery", "PENDING", "Sample: no result yet.", []),
      finding("completion", "PENDING", "Sample: the task is still running.", [
        "recorder_assertion",
      ]),
    ],
  },
];

export function findSampleTask(id: string): SampleTask | undefined {
  return SAMPLE_TASKS.find((task) => task.id === id);
}

export interface SamplePeriod {
  label: string;
  state: { label: string; group: StateGroup };
  detail: string;
}

// One accelerated demo schedule: four payments of 5.00 DemoUSD.
export const SAMPLE_SCHEDULE = {
  timing: "Every 2 minutes (accelerated demo)",
  amount: "5.00 DemoUSD",
  periods: "4",
  totalCap: "20.00 DemoUSD",
  recipient: "Sample recipient address",
  rows: [
    {
      label: "Payment 1",
      state: { label: "Paid", group: "done" },
      detail: "Paid inside its window. Sample payment hash D.",
    },
    {
      label: "Payment 2",
      state: { label: "Missed, skipped", group: "ended" },
      detail: "The window closed before payment. It is never paid later.",
    },
    {
      label: "Payment 3",
      state: { label: "Due, window open", group: "active" },
      detail: "Can be paid until its window closes.",
    },
    {
      label: "Payment 4",
      state: { label: "Upcoming", group: "waiting" },
      detail: "Its window has not opened yet.",
    },
  ] satisfies readonly SamplePeriod[],
};
