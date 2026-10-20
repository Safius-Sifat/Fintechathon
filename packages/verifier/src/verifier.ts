import {
  VerifierReportSchema,
  type EvidenceBundle,
  type VerifierReport,
} from "@mandate/schema";
import { checkAuthority } from "./authority.js";
import { checkCompletion } from "./completion.js";
import {
  readChainFacts,
  rpcReader,
  type ChainReader,
  type VerifyContext,
} from "./context.js";
import { checkDelivery } from "./delivery.js";
import { checkIntegrity } from "./integrity.js";
import { checkPolicy } from "./policy.js";
import { checkSettlement } from "./settlement.js";

export type VerifyOptions = {
  // Ed25519 evidence key from a separately trusted deployment manifest.
  trustedEvidenceKey?: `0x${string}` | undefined;
  // Your own Base Sepolia RPC. Without it, chain-backed findings stay UNVERIFIABLE.
  rpcUrl?: string | undefined;
  chain?: ChainReader | undefined;
};

export async function verifyBundle(
  bundle: EvidenceBundle,
  options: VerifyOptions = {},
): Promise<VerifierReport> {
  const reader =
    options.chain ?? (options.rpcUrl ? rpcReader(options.rpcUrl) : null);
  const ctx: VerifyContext = {
    trustedEvidenceKey: options.trustedEvidenceKey ?? null,
    chain: reader ? await readChainFacts(bundle, reader) : null,
  };
  const findings = [
    checkIntegrity(bundle, ctx),
    await checkAuthority(bundle, ctx),
    checkPolicy(bundle, ctx),
    checkSettlement(bundle, ctx),
    await checkDelivery(bundle, ctx),
    checkCompletion(bundle, ctx),
  ];
  const limitations = [
    "Unexplained outflows across the wallet's full history are not scanned yet.",
    "Completion rests on the recorder's own event and is never independent.",
  ];
  if (!ctx.trustedEvidenceKey)
    limitations.push(
      "No trusted evidence key: the checkpoint signature was not checked.",
    );
  if (!ctx.chain) limitations.push("No RPC: nothing was read from the chain.");
  return VerifierReportSchema.parse({
    schemaVersion: 4,
    taskId: bundle.manifest.taskId,
    inspectionHead: ctx.chain
      ? ctx.chain.latestBlock.toString()
      : bundle.manifest.inspection.toBlock,
    findings,
    unmatchedOutflows: [],
    limitations,
  });
}

// Exit codes (S6): 0 every finding PASS, 1 any FAIL, 2 otherwise.
export function computeExitCode(report: VerifierReport): number {
  if (report.findings.some((f) => f.state === "FAIL")) return 1;
  if (report.findings.some((f) => f.state !== "PASS")) return 2;
  return 0;
}
