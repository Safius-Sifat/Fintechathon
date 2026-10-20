import {
  PermitSchema,
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";
import { executedActions, type VerifyContext } from "./context.js";

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({ name: "policy", state, ruleId, reason, evidenceIds, basis });

// Replays the amounts the chain says this task paid against the signed
// permit's limits.
export function checkPolicy(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Finding {
  const ids = bundle.events.map((e) => e.eventId);
  const permit = PermitSchema.safeParse(
    (bundle.authority as { permit?: unknown }).permit,
  );
  if (!permit.success)
    return finding(
      "UNVERIFIABLE",
      "POLICY_PERMIT_ABSENT",
      "No valid permit to check limits against",
      ids,
      ["recorder_assertion"],
    );
  if (!ctx.chain)
    return finding(
      "UNVERIFIABLE",
      "POLICY_NOT_REPLAYED",
      "Limits were not replayed against the chain (no RPC given)",
      ids,
      ["recorder_assertion"],
    );
  const maxPayment = BigInt(permit.data.maxPayment);
  const spendCap = BigInt(permit.data.spendCap);
  let spent = 0n;
  let payments = 0;
  for (const receipt of ctx.chain.receipts.values()) {
    if (!receipt || receipt.status !== "success") continue;
    for (const a of executedActions(receipt, bundle.manifest.wallet)) {
      if (a.operation !== 0) continue;
      payments++;
      if (a.assets > maxPayment)
        return finding(
          "FAIL",
          "POLICY_MAX_PAYMENT_EXCEEDED",
          `A payment of ${a.assets} is above maxPayment ${maxPayment}`,
          ids,
          ["chain", "signature"],
        );
      spent += a.assets;
    }
  }
  if (spent > spendCap)
    return finding(
      "FAIL",
      "POLICY_SPEND_CAP_EXCEEDED",
      `Paid ${spent} in total, above spendCap ${spendCap}`,
      ids,
      ["chain", "signature"],
    );
  if (payments > permit.data.maxPayments)
    return finding(
      "FAIL",
      "POLICY_TOO_MANY_PAYMENTS",
      `${payments} payments, above maxPayments ${permit.data.maxPayments}`,
      ids,
      ["chain", "signature"],
    );
  return finding(
    "PASS",
    "POLICY_LIMITS_RESPECTED",
    `${payments} payments totalling ${spent} fit the signed permit`,
    ids,
    ["chain", "signature"],
  );
}
