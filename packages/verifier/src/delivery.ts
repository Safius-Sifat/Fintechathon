import {
  DeliveryEnvelopeSchema,
  deliveryDomain,
  hashCanonical,
  hashDigest,
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";
import { recoverAddress } from "viem";
import { executedActions, type VerifyContext } from "./context.js";

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({ name: "delivery", state, ruleId, reason, evidenceIds, basis });

// Checks each recorded provider delivery: the result matches its signed hash
// and the signer is the provider that the chain shows was paid for that
// invoice. A signed result is the provider's claim, not proof the website
// behaved that way.
export async function checkDelivery(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Promise<Finding> {
  const ids = bundle.events.map((e) => e.eventId);
  const deliveries = bundle.events
    .map((e) =>
      DeliveryEnvelopeSchema.safeParse(
        (e.payload as { delivery?: unknown }).delivery,
      ),
    )
    .filter((p) => p.success)
    .map((p) => p.data!);
  if (deliveries.length === 0)
    return finding(
      "UNVERIFIABLE",
      "DELIVERY_NO_RECORDS",
      "The bundle records no signed provider delivery",
      ids,
      ["recorder_assertion"],
    );
  if (!ctx.chain)
    return finding(
      "UNVERIFIABLE",
      "DELIVERY_PAYEE_NOT_READ",
      "Provider payees were not read from the chain (no RPC given)",
      ids,
      ["artifact"],
    );
  const paidTo = new Map<string, string>();
  for (const r of ctx.chain.receipts.values())
    if (r?.status === "success")
      for (const a of executedActions(r, bundle.manifest.wallet))
        paidTo.set(a.invoiceId.toLowerCase(), a.target.toLowerCase());
  for (const d of deliveries) {
    if (
      d.receipt.resultHash.toLowerCase() !==
      hashCanonical(d.result).toLowerCase()
    )
      return finding(
        "FAIL",
        "DELIVERY_RESULT_CHANGED",
        "A delivered result does not match its signed hash",
        ids,
        ["artifact"],
      );
    const payee = paidTo.get(d.receipt.invoiceId.toLowerCase());
    if (!payee)
      return finding(
        "FAIL",
        "DELIVERY_NOT_PAID",
        "A delivery names an invoice the chain shows no payment for",
        ids,
        ["chain"],
      );
    const signer = await recoverAddress({
      hash: hashDigest(
        "DeliveryReceipt",
        d.receipt,
        deliveryDomain(bundle.manifest.wallet),
      ),
      signature: d.providerSignature,
    }).catch(() => null);
    if (!signer || signer.toLowerCase() !== payee)
      return finding(
        "FAIL",
        "DELIVERY_WRONG_SIGNER",
        "A delivery is not signed by the provider that was paid",
        ids,
        ["signature", "chain"],
      );
  }
  return finding(
    "PASS",
    "DELIVERY_SIGNED_BY_PAID_PROVIDER",
    `${deliveries.length} results are signed by the paid provider and unchanged. This proves what the provider reported, not that the website behaved that way`,
    ids,
    ["signature", "artifact", "chain"],
  );
}
