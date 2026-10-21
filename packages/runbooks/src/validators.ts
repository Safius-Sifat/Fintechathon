import {
  BrowserResultSchema,
  OrderSchema,
  type BrowserResult,
  type OrderDelivery,
  type DeliveryEnvelope,
  type QuoteEnvelope,
  deliveryDomain,
  hashCanonical,
  hashDigest,
  invoiceDomain,
  TARGET_IDS,
  CHECK_ORDER,
} from "@mandate/schema";
import { recoverAddress, type Address, type Hex } from "viem";
import { z } from "zod";

export const BrowserInputSchema = z
  .object({
    targetId: z.enum(TARGET_IDS),
    checks: z
      .array(z.enum(CHECK_ORDER))
      .min(1)
      .max(3)
      .refine(
        (arr: readonly string[]) =>
          arr.every(
            (val, i) =>
              i === 0 ||
              CHECK_ORDER.indexOf(arr[i - 1] as any) <
                CHECK_ORDER.indexOf(val as any),
          ),
        "Checks must be in fixed order: pageLoad, title, formSubmit",
      ),
    maxPaidAttempts: z.number().int().min(1).max(3).default(3),
    maxSteps: z.number().int().min(1).max(8).default(8),
    taskDeadline: z.string().regex(/^[0-9]+$/),
  })
  .strict();

export const LiquidityInputSchema = z
  .object({
    vault: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    command: z.enum(["deposit", "redeem"]),
    amountUnits: z.string().regex(/^[1-9][0-9]*$/),
    maxSlippageBps: z.literal(50).default(50),
  })
  .strict();

export const ScheduleInputSchema = z
  .object({
    recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    amount: z.string().regex(/^[1-9][0-9]*$/),
    start: z.string().regex(/^[0-9]+$/),
    interval: z.number().int().min(1),
    window: z.number().int().min(1),
    periods: z.number().int().min(1),
  })
  .strict();

// One order from the demo shop (plan 05). The phone sends only the hash of
// the delivery details; maxAmount is the most the owner will pay.
export const CommerceInputSchema = z
  .object({
    productId: z.string().regex(/^[a-z0-9-]{1,48}$/),
    size: z
      .string()
      .regex(/^[0-9A-Z.]{1,8}$/)
      .nullable(),
    maxAmount: z.string().regex(/^[1-9][0-9]*$/),
    deliveryHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    taskDeadline: z.string().regex(/^[0-9]+$/),
  })
  .strict();

export type BrowserInput = z.infer<typeof BrowserInputSchema>;
export type CommerceInput = z.infer<typeof CommerceInputSchema>;
export type LiquidityInput = z.infer<typeof LiquidityInputSchema>;
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;

export function validateBrowserResult(result: unknown): BrowserResult {
  return BrowserResultSchema.parse(result);
}

export function hashInput(input: unknown): Hex {
  return hashCanonical(input);
}

const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

async function signerOf(digest: Hex, signature: Hex): Promise<Address | null> {
  try {
    return await recoverAddress({ hash: digest, signature });
  } catch {
    return null;
  }
}

// A quote is usable only when its Invoice is signed by the provider it pays
// (signer equals recipient), names this task and wallet, and is unexpired.
export async function checkQuote(
  quote: QuoteEnvelope,
  expected: {
    chainTaskId: Hex;
    wallet: Address;
    nowSeconds: bigint;
    maxPayment: bigint;
  },
): Promise<string | null> {
  const inv = quote.invoice;
  if (inv.taskId.toLowerCase() !== expected.chainTaskId.toLowerCase())
    return "The quote is for another task.";
  if (!sameAddress(inv.wallet, expected.wallet))
    return "The quote is for another wallet.";
  if (BigInt(inv.expiresAt) <= expected.nowSeconds)
    return "The quote has expired.";
  if (BigInt(inv.amount) > expected.maxPayment)
    return "The quote is above the payment limit.";
  const signer = await signerOf(
    hashDigest("Invoice", inv, invoiceDomain(expected.wallet)),
    quote.providerSignature,
  );
  if (!signer || !sameAddress(signer, inv.recipient))
    return "The quote is not signed by the provider it pays.";
  return null;
}

// A delivery counts only when its receipt matches the paid invoice and the
// result bytes, and is signed by the same provider key that was paid.
export async function checkDelivery(
  delivery: DeliveryEnvelope,
  expected: {
    wallet: Address;
    invoiceId: Hex;
    requestId: Hex;
    inputHash: Hex;
    paymentTxHash: Hex;
    provider: Address;
  },
): Promise<string | null> {
  const r = delivery.receipt;
  if (r.invoiceId.toLowerCase() !== expected.invoiceId.toLowerCase())
    return "The result is for another invoice.";
  if (r.requestId.toLowerCase() !== expected.requestId.toLowerCase())
    return "The result is for another payment request.";
  if (r.paymentTxHash.toLowerCase() !== expected.paymentTxHash.toLowerCase())
    return "The result names another payment.";
  if (
    r.inputHash.toLowerCase() !== expected.inputHash.toLowerCase() ||
    delivery.result.inputHash.toLowerCase() !== expected.inputHash.toLowerCase()
  )
    return "The result is for another input.";
  if (
    r.resultHash.toLowerCase() !== hashCanonical(delivery.result).toLowerCase()
  )
    return "The result does not match its signed hash.";
  const signer = await signerOf(
    hashDigest("DeliveryReceipt", r, deliveryDomain(expected.wallet)),
    delivery.providerSignature,
  );
  if (!signer || !sameAddress(signer, expected.provider))
    return "The result is not signed by the paid provider.";
  return null;
}

// An order counts only when the shop that was paid signed a receipt for this
// invoice, request and settlement, and the order is exactly what the owner
// approved: product, size, delivery hash and the paid amount.
export async function checkOrderDelivery(
  delivery: OrderDelivery,
  expected: {
    wallet: Address;
    invoiceId: Hex;
    requestId: Hex;
    inputHash: Hex;
    paymentTxHash: Hex;
    shop: Address;
    productId: string;
    size: string | null;
    deliveryHash: Hex;
    amount: string;
  },
): Promise<string | null> {
  const order = OrderSchema.safeParse(delivery.order);
  if (!order.success) return "The order is malformed.";
  const o = order.data;
  const r = delivery.receipt;
  if (r.invoiceId.toLowerCase() !== expected.invoiceId.toLowerCase())
    return "The order is for another invoice.";
  if (r.requestId.toLowerCase() !== expected.requestId.toLowerCase())
    return "The order is for another payment request.";
  if (r.paymentTxHash.toLowerCase() !== expected.paymentTxHash.toLowerCase())
    return "The order names another payment.";
  if (
    r.inputHash.toLowerCase() !== expected.inputHash.toLowerCase() ||
    o.inputHash.toLowerCase() !== expected.inputHash.toLowerCase()
  )
    return "The order is for another request.";
  if (
    o.productId !== expected.productId ||
    o.size !== expected.size ||
    o.deliveryHash.toLowerCase() !== expected.deliveryHash.toLowerCase() ||
    o.amount !== expected.amount
  )
    return "The order differs from what was approved.";
  if (r.resultHash.toLowerCase() !== hashCanonical(o).toLowerCase())
    return "The order does not match its signed hash.";
  const signer = await signerOf(
    hashDigest("DeliveryReceipt", r, deliveryDomain(expected.wallet)),
    delivery.providerSignature,
  );
  if (!signer || !sameAddress(signer, expected.shop))
    return "The order is not signed by the paid shop.";
  return null;
}
