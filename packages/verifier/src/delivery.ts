import {
  DeliveryEnvelopeSchema,
  checkX402Settlement,
  deliveryDomain,
  hashCanonical,
  hashDigest,
  type DeliveryReceipt,
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";
import { recoverAddress, type Hash, type Hex } from "viem";
import {
  REQUIRED_CONFIRMATIONS,
  deliveryPayloads,
  executedActions,
  orderDeliveries,
  type ExecutedAction,
  type VerifyContext,
} from "./context.js";

const OP_X402 = 6;

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({ name: "delivery", state, ruleId, reason, evidenceIds, basis });

// Checks each recorded provider delivery and shop order: the result matches
// its signed hash and the signer is the provider that the chain shows was
// paid for that invoice. For an x402 order the chain must also show the
// facilitator's transfer of exactly the order amount from this wallet to the
// shop, consuming the payment's nonce. A signed result is the provider's
// claim, not proof the website behaved that way or that goods shipped.
export async function checkDelivery(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Promise<Finding> {
  const ids = bundle.events.map((e) => e.eventId);
  const results = deliveryPayloads(bundle)
    .map((p) => DeliveryEnvelopeSchema.safeParse(p))
    .filter((p) => p.success)
    .map((p) => p.data!);
  const orders = orderDeliveries(bundle);
  if (results.length + orders.length === 0)
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
  const chain = ctx.chain;
  const paid = new Map<string, ExecutedAction>();
  for (const r of chain.receipts.values())
    if (r?.status === "success")
      for (const a of executedActions(r, bundle.manifest.wallet))
        paid.set(a.invoiceId.toLowerCase(), a);

  // The provider that was paid for this receipt's invoice signed it.
  const signedByPayee = async (receipt: DeliveryReceipt, signature: Hex) => {
    const action = paid.get(receipt.invoiceId.toLowerCase());
    if (!action)
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
        receipt,
        deliveryDomain(bundle.manifest.wallet),
      ),
      signature,
    }).catch(() => null);
    if (!signer || signer.toLowerCase() !== action.target.toLowerCase())
      return finding(
        "FAIL",
        "DELIVERY_WRONG_SIGNER",
        "A delivery is not signed by the provider that was paid",
        ids,
        ["signature", "chain"],
      );
    return action;
  };

  for (const d of results) {
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
    const action = await signedByPayee(d.receipt, d.providerSignature);
    if ("state" in action) return action;
  }

  for (const o of orders) {
    if (
      o.receipt.resultHash.toLowerCase() !==
      hashCanonical(o.order).toLowerCase()
    )
      return finding(
        "FAIL",
        "DELIVERY_ORDER_CHANGED",
        "An order does not match its signed hash",
        ids,
        ["artifact"],
      );
    const action = await signedByPayee(o.receipt, o.providerSignature);
    if ("state" in action) return action;
    if (action.requestId.toLowerCase() !== o.receipt.requestId.toLowerCase())
      return finding(
        "FAIL",
        "DELIVERY_ORDER_OTHER_PAYMENT",
        "An order names another payment request than the one executed",
        ids,
        ["chain", "signature"],
      );
    if (action.operation !== OP_X402) {
      if (action.assets !== BigInt(o.order.amount))
        return finding(
          "FAIL",
          "DELIVERY_ORDER_AMOUNT",
          "The order's amount differs from what the wallet paid",
          ids,
          ["chain", "signature"],
        );
      continue;
    }
    const settled = await checkX402Settlement(
      {
        getBlockNumber: async () => chain.latestBlock,
        getTransactionReceipt: async ({ hash }) => {
          const r = chain.receipts.get(hash.toLowerCase());
          if (!r) throw new Error("Not in a block");
          return r;
        },
      },
      {
        wallet: bundle.manifest.wallet,
        asset: action.asset,
        recipient: action.target,
        amount: o.order.amount,
      },
      action.requestId,
      o.receipt.paymentTxHash as Hash,
      REQUIRED_CONFIRMATIONS,
    );
    if (settled.state === "PENDING")
      return finding(
        "PENDING",
        "DELIVERY_ORDER_SETTLEMENT_PENDING",
        `The order's payment is not final: ${settled.reason}`,
        ids,
        ["chain"],
      );
    if (settled.state === "INVALID")
      return finding(
        "FAIL",
        "DELIVERY_ORDER_NOT_SETTLED",
        `The order's payment does not settle it: ${settled.reason}`,
        ids,
        ["chain"],
      );
  }

  const parts = [
    results.length
      ? `${results.length} results are signed by the paid provider and unchanged`
      : null,
    orders.length
      ? `${orders.length} orders are signed by the paid shop, unchanged, and their payment settled on chain`
      : null,
  ].filter(Boolean);
  return finding(
    "PASS",
    "DELIVERY_SIGNED_BY_PAID_PROVIDER",
    `${parts.join("; ")}. This proves what the provider reported, not that a website behaved that way or that goods shipped`,
    ids,
    ["signature", "artifact", "chain"],
  );
}
