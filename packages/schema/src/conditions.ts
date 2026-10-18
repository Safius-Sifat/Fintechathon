import { z } from "zod";
import {
  big,
  Hex32Schema,
  NonZeroAddressSchema,
  Uint256,
  Uint64,
  uintNumber,
} from "./primitives.js";
import { ScheduleSchema } from "./authority.js";

export const TARGET_IDS = ["checkout-healthy", "checkout-broken"] as const;
export const CHECK_ORDER = ["pageLoad", "title", "formSubmit"] as const;
export const PROVIDER_IDS = ["a", "b"] as const;
export const RUNBOOK_IDS = [
  "browser-check",
  "liquidity-keeper",
  "scheduled-pay",
  "service-allowance",
] as const;

export const TargetIdSchema = z.enum(TARGET_IDS);
export const CheckSchema = z.enum(CHECK_ORDER);
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export const RunbookIdSchema = z.enum(RUNBOOK_IDS);

const inOrder =
  <T extends string>(order: readonly T[]) =>
  (values: readonly T[]) =>
    values.every(
      (v, i) => i === 0 || order.indexOf(values[i - 1]!) < order.indexOf(v),
    );
// Checks use the fixed order pageLoad,title,formSubmit; provider IDs sort a,b. Duplicates reject.
export const ChecksSchema = z
  .array(CheckSchema)
  .min(1)
  .max(3)
  .refine(
    inOrder(CHECK_ORDER),
    "Checks must be unique in order pageLoad,title,formSubmit",
  );
export const ProviderIdsSchema = z
  .array(ProviderIdSchema)
  .min(1)
  .max(2)
  .refine(inOrder(PROVIDER_IDS), "Provider IDs must be unique and sorted");

export const BrowserConditionsSchema = z
  .object({
    targetId: TargetIdSchema,
    checks: ChecksSchema,
    providerIds: ProviderIdsSchema,
    maxPaidAttempts: uintNumber(3).min(1),
    maxSteps: uintNumber(8).min(1),
    taskDeadline: Uint64,
    resultMaxAgeSeconds: z.literal(300),
  })
  .strict();
// amountUnits is the owner-approved maximum; the agent's SET_AMOUNT answer must not exceed it (S9.2).
export const LiquidityConditionsSchema = z
  .object({
    vault: NonZeroAddressSchema,
    command: z.enum(["deposit", "redeem"]),
    amountUnits: Uint256.refine(
      (v) => big(v) > 0n,
      "amountUnits must be positive",
    ),
    maxSlippageBps: z.literal(50),
    riskSourceId: z.literal("demo-risk-v1"),
    signalMaxAgeSeconds: z.literal(60),
  })
  .strict();
export const AllowanceConditionsSchema = z
  .object({
    providerIds: ProviderIdsSchema,
    capabilities: ChecksSchema,
    periodSeconds: z.union([z.literal(86400), z.literal(604800)]),
    maxPaymentsPerPeriod: uintNumber(200).min(1),
  })
  .strict();
export const CallConditionsSchema = z
  .object({
    templateIds: z
      .array(Hex32Schema)
      .min(1)
      .max(8)
      .refine(
        (ids) => ids.every((id, i) => i === 0 || ids[i - 1]! < id),
        "Template IDs must be sorted and unique",
      ),
    purpose: z.string().min(1).max(200),
  })
  .strict();

const BRANCH_FOR: Record<
  (typeof RUNBOOK_IDS)[number],
  "browser" | "liquidity" | "schedule" | "allowance"
> = {
  "browser-check": "browser",
  "liquidity-keeper": "liquidity",
  "scheduled-pay": "schedule",
  "service-allowance": "allowance",
};

export const ConditionsSchema = z
  .object({
    schemaVersion: z.literal(4),
    runbookId: RunbookIdSchema,
    browser: BrowserConditionsSchema.nullable(),
    liquidity: LiquidityConditionsSchema.nullable(),
    schedule: ScheduleSchema.nullable(),
    allowance: AllowanceConditionsSchema.nullable(),
    calls: CallConditionsSchema.nullable(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const branches = (
      ["browser", "liquidity", "schedule", "allowance"] as const
    ).filter((b) => c[b] !== null);
    if (branches.length !== 1 || branches[0] !== BRANCH_FOR[c.runbookId])
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly the branch matching runbookId must be non-null",
      });
    if (c.calls !== null && c.liquidity === null)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "calls may only accompany the liquidity branch",
      });
  });

export const RunbookManifestSchema = z
  .object({
    schemaVersion: z.literal(4),
    runbookId: RunbookIdSchema,
    kind: uintNumber(3),
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    entryArtifactHash: Hex32Schema,
    inputSchemaHash: Hex32Schema,
    outputSchemaHash: Hex32Schema,
    validatorArtifactHash: Hex32Schema,
    dependencyLockHash: Hex32Schema,
  })
  .strict();

export const ProviderBindingSchema = z
  .object({ providerId: ProviderIdSchema, recipient: NonZeroAddressSchema })
  .strict();
export const ScopeSchema = z
  .object({
    conditions: ConditionsSchema,
    runbookManifest: RunbookManifestSchema,
    providerBindings: z
      .array(ProviderBindingSchema)
      .max(2)
      .refine(
        (b) =>
          b.every((x, i) => i === 0 || b[i - 1]!.providerId < x.providerId),
        "Provider bindings must be sorted by providerId and unique",
      ),
  })
  .strict();

export type Conditions = z.infer<typeof ConditionsSchema>;
export type RunbookManifest = z.infer<typeof RunbookManifestSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type ProviderBinding = z.infer<typeof ProviderBindingSchema>;
