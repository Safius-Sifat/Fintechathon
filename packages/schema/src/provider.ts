import { z } from "zod";
import { DeliveryReceiptSchema, InvoiceSchema } from "./authority.js";
import {
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

export const DeliveryEnvelopeSchema = z
  .object({
    result: BrowserResultSchema,
    receipt: DeliveryReceiptSchema,
    providerSignature: SignatureSchema,
    artifacts: z.array(ArtifactSchema).max(16),
  })
  .strict();

export const ProviderSchema = z
  .object({
    providerId: ProviderIdSchema,
    recipient: AddressSchema,
    capabilities: ChecksSchema,
  })
  .strict();

export type CheckRequest = z.infer<typeof CheckRequestSchema>;
export type X402Accepts = z.infer<typeof X402AcceptsSchema>;
export type QuoteEnvelope = z.infer<typeof QuoteEnvelopeSchema>;
export type BrowserResult = z.infer<typeof BrowserResultSchema>;
export type DeliveryEnvelope = z.infer<typeof DeliveryEnvelopeSchema>;
