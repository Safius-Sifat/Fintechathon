import {
  decodePaymentSignatureHeader,
  encodePaymentResponseHeader,
  type FacilitatorClient,
} from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  BASE_SEPOLIA_USDC,
  checkX402Settlement,
  X402_NETWORK,
  X402AcceptsSchema,
  type Invoice,
  type X402Accepts,
} from "@mandate/schema";
import type { Hash, Hex } from "viem";
import { REQUIRED_CONFIRMATIONS, type ChainReader } from "./payment.js";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// The x402 `accepts` entry for a USDC invoice (S9.10). It carries the signed
// Mandate invoice so the wallet can bind the payment to it.
export function x402Accepts(
  invoice: Invoice,
  providerSignature: Hex,
  maxTimeoutSeconds: number,
): X402Accepts | null {
  if (!same(invoice.asset, BASE_SEPOLIA_USDC)) return null;
  return X402AcceptsSchema.parse({
    scheme: "exact",
    network: X402_NETWORK,
    amount: invoice.amount,
    asset: invoice.asset,
    payTo: invoice.recipient,
    maxTimeoutSeconds,
    extra: {
      assetTransferMethod: "eip3009",
      name: "USDC",
      version: "2",
      mandateInvoice: invoice,
      mandateProviderSignature: providerSignature,
    },
  });
}

export const asRequirements = (a: X402Accepts): PaymentRequirements => ({
  scheme: a.scheme,
  network: a.network,
  asset: a.asset,
  amount: a.amount,
  payTo: a.payTo,
  maxTimeoutSeconds: a.maxTimeoutSeconds,
  extra: { ...a.extra },
});

export type PayloadProblem = string | null;

// The payment must be exactly what the wallet's X402 Action authorises for
// this invoice: from the wallet, to the provider, the invoice amount, nonce =
// requestId, and the wallet's 65-byte requestId ‖ permitId ‖ 0x01 signature.
export function checkPayload(
  payload: PaymentPayload,
  accepts: X402Accepts,
  invoice: Invoice,
  requestId: Hex,
): PayloadProblem {
  if (payload.x402Version !== 2) return "Only x402 version 2 is accepted";
  const a = payload.accepted;
  if (
    a.scheme !== "exact" ||
    a.network !== accepts.network ||
    !same(a.asset, accepts.asset) ||
    !same(a.payTo, accepts.payTo) ||
    a.amount !== accepts.amount
  )
    return "The payment does not accept this invoice's terms";
  const auth = (payload.payload as { authorization?: Record<string, string> })
    .authorization;
  const signature = (payload.payload as { signature?: string }).signature;
  if (!auth || typeof signature !== "string")
    return "The payment has no EIP-3009 authorization";
  if (
    !same(auth.from ?? "", invoice.wallet) ||
    !same(auth.to ?? "", invoice.recipient) ||
    auth.value !== invoice.amount ||
    auth.validAfter !== "0" ||
    !same(auth.nonce ?? "", requestId)
  )
    return "The authorization does not pay this invoice";
  if (
    !/^0x[0-9a-fA-F]{130}$/.test(signature) ||
    !same(signature.slice(0, 66), requestId) ||
    !signature.toLowerCase().endsWith("01")
  )
    return "The signature is not the wallet's x402 approval";
  return null;
}

// Settlement on chain: the shared check, with this provider's confirmations.
export const checkSettlement = (
  chain: ChainReader,
  invoice: Invoice,
  requestId: Hex,
  txHash: Hash,
) =>
  checkX402Settlement(
    chain,
    invoice,
    requestId,
    txHash,
    REQUIRED_CONFIRMATIONS,
  );

export type SettleOutcome =
  | { state: "PAID"; txHash: Hash; responseHeader: string }
  | { state: "PENDING"; reason: string; txHash: Hash }
  | { state: "REFUSED"; status: 400 | 402; error: string };

// One x402 settlement per invoice (S9.10): check the payment against the
// invoice, verify and settle it once through the facilitator (recording the
// settlement before anything else), then require the settlement on chain.
// A retry with a recorded settlement only re-checks the chain.
export async function settleOnce(input: {
  facilitator: FacilitatorClient;
  chain: ChainReader;
  accepts: X402Accepts;
  invoice: Invoice;
  requestId: Hex;
  header: string;
  recorded: Hash | null;
  record: (txHash: Hash) => Promise<void>;
}): Promise<SettleOutcome> {
  let txHash = input.recorded;
  if (!txHash) {
    let payload: PaymentPayload;
    try {
      payload = decodePaymentSignatureHeader(input.header);
    } catch {
      return {
        state: "REFUSED",
        status: 400,
        error: "Malformed PAYMENT-SIGNATURE",
      };
    }
    const problem = checkPayload(
      payload,
      input.accepts,
      input.invoice,
      input.requestId,
    );
    if (problem) return { state: "REFUSED", status: 402, error: problem };
    const requirements = asRequirements(input.accepts);
    const verified = await input.facilitator.verify(payload, requirements);
    if (!verified.isValid)
      return {
        state: "REFUSED",
        status: 402,
        error: `The facilitator refused the payment: ${verified.invalidReason ?? "invalid"}`,
      };
    const settled = await input.facilitator.settle(payload, requirements);
    if (!settled.success || !/^0x[0-9a-fA-F]{64}$/.test(settled.transaction))
      return {
        state: "REFUSED",
        status: 402,
        error: `Settlement failed: ${settled.errorReason ?? "unknown"}`,
      };
    txHash = settled.transaction as Hash;
    await input.record(txHash);
  }
  const settlement = await checkSettlement(
    input.chain,
    input.invoice,
    input.requestId,
    txHash,
  );
  if (settlement.state === "PENDING")
    return { state: "PENDING", reason: settlement.reason, txHash };
  if (settlement.state === "INVALID")
    return { state: "REFUSED", status: 402, error: settlement.reason };
  return {
    state: "PAID",
    txHash,
    responseHeader: encodePaymentResponseHeader({
      success: true,
      transaction: txHash,
      network: input.accepts.network,
      payer: input.invoice.wallet,
    }),
  };
}

export type { FacilitatorClient };
