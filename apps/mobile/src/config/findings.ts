import type { Finding } from "@mandate/schema";
import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";

// The six inspection categories (plan S6, P3-04). A report is only "all
// passed" when every category is present and passes on independent
// evidence. Pending, unverifiable, missing or assertion-only results are
// never shown as green.

export type FindingName = Finding["name"];
export type FindingState = Finding["state"];
export type FindingBasis = Finding["basis"][number];

export const FINDING_NAMES = [
  "integrity",
  "authority",
  "policy",
  "settlement",
  "delivery",
  "completion",
] as const satisfies readonly FindingName[];

export const FINDING_TITLES: Record<
  FindingName,
  { title: string; detail: string }
> = {
  integrity: {
    title: "Integrity",
    detail: "The evidence log is complete and has not been altered.",
  },
  authority: {
    title: "Authority",
    detail: "Every action was covered by a permission you signed.",
  },
  policy: {
    title: "Policy",
    detail: "Spending stayed inside your wallet policy and limits.",
  },
  settlement: {
    title: "Settlement",
    detail: "Payments match what happened on chain.",
  },
  delivery: {
    title: "Delivery",
    detail: "The provider's result matches what was paid for.",
  },
  completion: {
    title: "Completion",
    detail: "The task's outcome matches its recorded steps.",
  },
};

export const FINDING_STATE_LABELS: Record<FindingState, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  PENDING: "Pending",
  UNVERIFIABLE: "Cannot be verified",
};

export const BASIS_LABELS: Record<FindingBasis, string> = {
  chain: "Chain",
  signature: "Signature",
  artifact: "Artifact",
  recorder_assertion: "Service assertion",
};

// A recorder assertion is the service's own statement, not proof.
export function isAssertionOnly(finding: Finding): boolean {
  return finding.basis.every((basis) => basis === "recorder_assertion");
}

export type InspectionSummary = "allPassed" | "failed" | "incomplete";

export function summarizeFindings(
  findings: readonly Finding[],
): InspectionSummary {
  if (findings.some((finding) => finding.state === "FAIL")) return "failed";
  const allPassed = FINDING_NAMES.every((name) => {
    const forName = findings.filter((finding) => finding.name === name);
    return (
      forName.length > 0 &&
      forName.every(
        (finding) => finding.state === "PASS" && !isAssertionOnly(finding),
      )
    );
  });
  return allPassed ? "allPassed" : "incomplete";
}

export const SUMMARY_TEXT: Record<
  InspectionSummary,
  { title: string; body: string; icon: IconName; tone: Tone }
> = {
  allPassed: {
    title: "All six checks passed",
    body: "Every category passed on chain, signature or artifact evidence.",
    icon: "shield-check-outline",
    tone: "green",
  },
  failed: {
    title: "At least one check failed",
    body: "Read the failed category below before relying on this task.",
    icon: "shield-alert-outline",
    tone: "red",
  },
  incomplete: {
    title: "Not fully verified",
    body: "Some categories are pending, cannot be verified, are missing or rest only on the service's own statement.",
    icon: "shield-half-full",
    tone: "amber",
  },
};
