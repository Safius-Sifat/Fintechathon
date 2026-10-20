// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import { UuidSchema } from "./primitives";
export const FindingSchema = z
  .object({
    name: z.enum([
      "integrity",
      "authority",
      "policy",
      "settlement",
      "delivery",
      "completion",
    ]),
    state: z.enum(["PASS", "FAIL", "PENDING", "UNVERIFIABLE"]),
    ruleId: z.string().min(1).max(64),
    reason: z.string().max(2000),
    evidenceIds: z.array(UuidSchema),
    basis: z.array(
      z.enum(["chain", "signature", "artifact", "recorder_assertion"]),
    ),
  })
  .strict();
