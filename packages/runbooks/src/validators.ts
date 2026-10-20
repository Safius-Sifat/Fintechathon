import {
  BrowserResultSchema,
  type BrowserResult,
  hashCanonical,
  TARGET_IDS,
  CHECK_ORDER,
} from "@mandate/schema";
import { type Hex } from "viem";
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
            (val, i) => i === 0 || CHECK_ORDER.indexOf(arr[i - 1] as any) < CHECK_ORDER.indexOf(val as any),
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

export type BrowserInput = z.infer<typeof BrowserInputSchema>;
export type LiquidityInput = z.infer<typeof LiquidityInputSchema>;
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;

export function validateBrowserResult(result: unknown): BrowserResult {
  return BrowserResultSchema.parse(result);
}

export function hashInput(input: unknown): Hex {
  return hashCanonical(input);
}
