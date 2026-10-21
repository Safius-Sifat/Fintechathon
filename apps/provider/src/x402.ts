import type { FacilitatorClient } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  BASE_SEPOLIA_USDC,
  X402_NETWORK,
  X402AcceptsSchema,
  type Invoice,
  type X402Accepts,
} from "@mandate/schema";
import {
  decodeEventLog,
  erc20Abi,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
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

const authorizationUsed = parseAbi([
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);

export type SettlementCheck =
  | { state: "PAID"; blockNumber: bigint }
  | { state: "PENDING"; reason: string }
  | { state: "INVALID"; reason: string };

// A settlement counts only when its transaction moved exactly the invoice
// amount from the wallet to the provider in USDC and consumed this request's
// authorization nonce, with three confirmations.
export async function checkSettlement(
  chain: ChainReader,
  invoice: Invoice,
  requestId: Hex,
  txHash: Hash,
): Promise<SettlementCheck> {
  const receipt = await chain
    .getTransactionReceipt({ hash: txHash })
    .catch(() => null);
  if (!receipt)
    return { state: "PENDING", reason: "The settlement is not in a block yet" };
  if (receipt.status !== "success")
    return { state: "INVALID", reason: "The settlement reverted" };
  let transferred = false;
  let used = false;
  for (const log of receipt.logs) {
    if (!same(log.address, invoice.asset)) continue;
    try {
      const ev = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics as never,
      });
      if (
        ev.eventName === "Transfer" &&
        same(ev.args.from, invoice.wallet) &&
        same(ev.args.to, invoice.recipient) &&
        ev.args.value === BigInt(invoice.amount)
      )
        transferred = true;
      continue;
    } catch {
      // Not a Transfer log.
    }
    try {
      const ev = decodeEventLog({
        abi: authorizationUsed,
        data: log.data,
        topics: log.topics as never,
      });
      if (
        same(ev.args.authorizer, invoice.wallet as Address) &&
        same(ev.args.nonce, requestId)
      )
        used = true;
    } catch {
      // Not an AuthorizationUsed log.
    }
  }
  if (!transferred || !used)
    return {
      state: "INVALID",
      reason: "The settlement does not pay this invoice",
    };
  const depth = (await chain.getBlockNumber()) - receipt.blockNumber + 1n;
  if (depth < REQUIRED_CONFIRMATIONS)
    return {
      state: "PENDING",
      reason: `${depth} of ${REQUIRED_CONFIRMATIONS} confirmations`,
    };
  return { state: "PAID", blockNumber: receipt.blockNumber };
}

export type { FacilitatorClient };
