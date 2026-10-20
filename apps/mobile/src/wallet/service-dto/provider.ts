// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import { TargetIdSchema } from "./conditions";
import { Hex32Schema, Uint64 } from "./primitives";
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

