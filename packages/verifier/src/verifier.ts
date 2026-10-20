import {
  type EvidenceBundle,
  type VerifierReport,
  type Finding,
  VerifierReportSchema,
} from "@mandate/schema";
import { checkIntegrity } from "./integrity.js";
import { checkAuthority } from "./authority.js";
import { checkPolicy } from "./policy.js";
import { checkSettlement } from "./settlement.js";
import { checkDelivery } from "./delivery.js";
import { checkCompletion } from "./completion.js";

export type VerifyOptions = {
  trustedManifest?: unknown;
  rpcUrl?: string;
};

export function verifyBundleSync(
  bundle: EvidenceBundle,
  options: VerifyOptions = {},
): VerifierReport {
  const findings: Finding[] = [
    checkIntegrity(bundle),
    checkAuthority(bundle),
    checkPolicy(bundle),
    checkSettlement(bundle),
    checkDelivery(bundle),
    checkCompletion(bundle),
  ];

  const report: VerifierReport = {
    schemaVersion: 4,
    taskId: bundle.manifest.taskId,
    inspectionHead: bundle.manifest.inspection.toBlock,
    findings,
    unmatchedOutflows: [],
    limitations: [
      "Checks only the bundle's internal consistency and schemas.",
      "Not implemented: chain reads (--rpc), the trusted deployment manifest (--trusted), event hash recomputation, checkpoint signature, anchor, and signature recovery.",
      "Findings that need those checks are UNVERIFIABLE, never PASS.",
    ],
  };

  return VerifierReportSchema.parse(report);
}

export async function verifyBundle(
  bundle: EvidenceBundle,
  options: VerifyOptions = {},
): Promise<VerifierReport> {
  return verifyBundleSync(bundle, options);
}

export function computeExitCode(report: VerifierReport): number {
  const hasFail = report.findings.some((f) => f.state === "FAIL");
  if (hasFail) return 1;

  const hasPendingOrUnverifiable = report.findings.some(
    (f) => f.state === "PENDING" || f.state === "UNVERIFIABLE",
  );
  if (hasPendingOrUnverifiable) return 2;

  return 0;
}
