// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import { TargetIdSchema } from "./conditions";
import { Hex32Schema, Uint256, Uint64 } from "./primitives";
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

// Mandate Test Shop (plan 05). Prices stay within one payment's ceiling.
export const MAX_SHOP_PRICE = "500000";
const ProductIdSchema = z.string().regex(/^[a-z0-9-]{1,48}$/);
const SizeSchema = z.string().regex(/^[0-9A-Z.]{1,8}$/);
export const ShopProductSchema = z
  .object({
    productId: ProductIdSchema,
    name: z.string().min(1).max(80),
    brand: z.string().min(1).max(40),
    category: z.enum(["running", "court", "trail", "lifestyle"]),
    colors: z.array(z.string().min(1).max(24)).min(1).max(4),
    sizes: z.array(SizeSchema).max(16),
    price: Uint256.refine(
      (v) => BigInt(v) > 0n && BigInt(v) <= BigInt(MAX_SHOP_PRICE),
      "Shop prices are between 0 and 0.50",
    ),
    description: z.string().min(1).max(300),
    image: z.string().regex(/^\/shop\/images\/[a-z0-9-]+\.svg$/),
  })
  .strict();
export const OrderSchema = z
  .object({
    schemaVersion: z.literal(4),
    orderId: Hex32Schema,
    inputHash: Hex32Schema,
    productId: ProductIdSchema,
    name: z.string().min(1).max(80),
    size: SizeSchema.nullable(),
    amount: Uint256,
    deliveryHash: Hex32Schema,
    testShop: z.literal(true),
    placedAt: Uint64,
  })
  .strict();
export type ShopProduct = z.infer<typeof ShopProductSchema>;
export type Order = z.infer<typeof OrderSchema>;
