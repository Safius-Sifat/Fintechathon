import { z } from "zod";
import { DeliveryReceiptSchema, InvoiceSchema } from "./authority.js";
import {
  CHECK_ORDER,
  ChecksSchema,
  ProviderIdSchema,
  TargetIdSchema,
} from "./conditions.js";
import {
  AddressSchema,
  Hex32Schema,
  NonZeroAddressSchema,
  SignatureSchema,
  Uint256,
  Uint64,
  uintNumber,
} from "./primitives.js";

// POST /providers/:id/check (S6). reviewWindowSeconds lets an invoice outlive owner co-signature.
export const CheckRequestSchema = z
  .object({
    taskId: Hex32Schema,
    wallet: NonZeroAddressSchema,
    asset: NonZeroAddressSchema,
    targetId: TargetIdSchema,
    checks: ChecksSchema,
    reviewWindowSeconds: uintNumber(900).optional(),
  })
  .strict();

// x402 v2 `exact` PaymentRequirements entry (S9.10). It must describe exactly the signed invoice.
export const X402AcceptsSchema = z
  .object({
    scheme: z.literal("exact"),
    network: z.literal("eip155:84532"),
    amount: Uint256,
    asset: NonZeroAddressSchema,
    payTo: NonZeroAddressSchema,
    maxTimeoutSeconds: uintNumber(900).min(1),
    extra: z
      .object({
        assetTransferMethod: z.literal("eip3009").optional(),
        name: z.literal("USDC"),
        version: z.literal("2"),
        mandateInvoice: InvoiceSchema,
        mandateProviderSignature: SignatureSchema,
      })
      .strict(),
  })
  .strict();

export const QuoteEnvelopeSchema = z
  .object({
    providerId: ProviderIdSchema,
    invoice: InvoiceSchema,
    providerSignature: SignatureSchema,
    x402: X402AcceptsSchema.nullable(), // null when the quoted asset is not USDC
  })
  .strict()
  .refine(
    (q) =>
      q.x402 === null ||
      (q.x402.asset === q.invoice.asset &&
        q.x402.payTo === q.invoice.recipient &&
        q.x402.amount === q.invoice.amount &&
        q.x402.extra.mandateInvoice.invoiceId === q.invoice.invoiceId &&
        q.x402.extra.mandateProviderSignature === q.providerSignature),
    "x402 terms must equal the signed invoice asset, recipient, amount and ID",
  );

export const BrowserResultSchema = z
  .object({
    schemaVersion: z.literal(4),
    targetId: TargetIdSchema,
    inputHash: Hex32Schema,
    checkedAt: Uint64,
    checks: z
      .object({
        pageLoad: z.boolean().optional(),
        title: z
          .object({
            actual: z.string().max(512),
            expected: z.string().max(512),
            pass: z.boolean(),
          })
          .strict()
          .optional(),
        formSubmit: z.boolean().optional(),
      })
      .strict(),
    screenshotHash: Hex32Schema,
    logHash: Hex32Schema,
  })
  .strict();

export const ArtifactSchema = z
  .object({
    artifactId: z.string().min(1).max(128),
    mediaType: z.string().min(1).max(128),
    sha256: Hex32Schema,
    base64: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })
  .strict();

export const ResultRequestSchema = z
  .object({
    invoiceId: Hex32Schema,
    requestId: Hex32Schema,
    paymentTxHash: Hex32Schema,
  })
  .strict();

// x402 retrieval (S9.10): the payment travels in the PAYMENT-SIGNATURE header
// and the provider settles it, so there is no payment hash yet.
export const X402ResultRequestSchema = z
  .object({
    invoiceId: Hex32Schema,
    requestId: Hex32Schema,
  })
  .strict();

export const DeliveryEnvelopeSchema = z
  .object({
    result: BrowserResultSchema,
    receipt: DeliveryReceiptSchema,
    providerSignature: SignatureSchema,
    artifacts: z.array(ArtifactSchema).max(16),
  })
  .strict();

// Browser providers offer page checks; the demo shop offers orders only.
export const ProviderSchema = z
  .object({
    providerId: ProviderIdSchema,
    recipient: AddressSchema,
    capabilities: z
      .array(z.enum([...CHECK_ORDER, "order"]))
      .min(1)
      .max(3),
  })
  .strict()
  .refine(
    (p) =>
      p.providerId === "shop"
        ? p.capabilities.length === 1 && p.capabilities[0] === "order"
        : ChecksSchema.safeParse(p.capabilities).success,
    "The shop offers only orders; browser providers only page checks",
  );

// The demo shop (plan 05): a trusted merchant whose products cost at most
// the contract's 0.50 per-payment ceiling. No goods ship.
export const MAX_SHOP_PRICE = "500000";
export const ShopProductSchema = z
  .object({
    productId: z.string().regex(/^[a-z0-9-]{1,48}$/),
    name: z.string().min(1).max(80),
    brand: z.string().min(1).max(40),
    category: z.enum(["running", "court", "trail", "lifestyle"]),
    colors: z.array(z.string().min(1).max(24)).min(1).max(4),
    sizes: z.array(z.string().regex(/^[0-9A-Z.]{1,8}$/)).max(16),
    price: Uint256.refine(
      (v) => BigInt(v) > 0n && BigInt(v) <= BigInt(MAX_SHOP_PRICE),
      "Shop prices are between 0 and 0.50",
    ),
    description: z.string().min(1).max(300),
    image: z.string().regex(/^\/shop\/images\/[a-z0-9-]+\.svg$/),
  })
  .strict();

// POST /providers/shop/check: the quote for one order. deliveryHash commits
// the delivery details without sending them before payment.
export const ShopOrderRequestSchema = z
  .object({
    taskId: Hex32Schema,
    wallet: NonZeroAddressSchema,
    asset: NonZeroAddressSchema,
    productId: z.string().regex(/^[a-z0-9-]{1,48}$/),
    size: z
      .string()
      .regex(/^[0-9A-Z.]{1,8}$/)
      .nullable(),
    deliveryHash: Hex32Schema,
    reviewWindowSeconds: uintNumber(900).optional(),
  })
  .strict();

export const OrderSchema = z
  .object({
    schemaVersion: z.literal(4),
    orderId: Hex32Schema,
    inputHash: Hex32Schema,
    productId: z.string().regex(/^[a-z0-9-]{1,48}$/),
    name: z.string().min(1).max(80),
    size: z
      .string()
      .regex(/^[0-9A-Z.]{1,8}$/)
      .nullable(),
    amount: Uint256,
    deliveryHash: Hex32Schema,
    testShop: z.literal(true),
    placedAt: Uint64,
  })
  .strict();

// The shop's signed order: the same DeliveryReceipt type the providers sign,
// whose resultHash commits the order.
export const OrderDeliverySchema = z
  .object({
    order: OrderSchema,
    receipt: DeliveryReceiptSchema,
    providerSignature: SignatureSchema,
  })
  .strict();

export type CheckRequest = z.infer<typeof CheckRequestSchema>;
export type X402Accepts = z.infer<typeof X402AcceptsSchema>;
export type QuoteEnvelope = z.infer<typeof QuoteEnvelopeSchema>;
export type BrowserResult = z.infer<typeof BrowserResultSchema>;
export type DeliveryEnvelope = z.infer<typeof DeliveryEnvelopeSchema>;
export type ShopProduct = z.infer<typeof ShopProductSchema>;
export type ShopOrderRequest = z.infer<typeof ShopOrderRequestSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderDelivery = z.infer<typeof OrderDeliverySchema>;
