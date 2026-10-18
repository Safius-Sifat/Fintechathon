import { z } from "zod";
import { CHAIN_ID } from "./runtime.js";
import {
  ActionSchema,
  ApprovalSchema,
  InvoiceSchema,
  PermitSchema,
  ScheduleSchema,
} from "./authority.js";
import { WalletPolicyListsSchema, WalletPolicySchema } from "./policy.js";
import { WalletDomainSchema } from "./domains.js";
import { RunbookIdSchema, ScopeSchema } from "./conditions.js";
import { BrowserResultSchema } from "./provider.js";
import { FindingSchema } from "./evidence.js";
import {
  AddressSchema,
  Hex32Schema,
  JsonObjectSchema,
  NonZeroAddressSchema,
  SignatureSchema,
  Uint256,
  Uint32,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const ERROR_CODES = [
  "AUTH_SCOPE",
  "PERMIT_INACTIVE",
  "SCOPE_MISMATCH",
  "RUNBOOK_VERSION",
  "RECIPIENT_DENIED",
  "PAYMENT_CAP",
  "DAILY_CAP",
  "LIQUID_FLOOR",
  "RESERVATION_CONFLICT",
  "QUOTE_EXPIRED",
  "DUPLICATE_REQUEST",
  "SCHEDULE_WINDOW",
  "STALE_SIGNAL",
  "MPC_UNAVAILABLE",
  "SIGNING_UNKNOWN",
  "SIMULATION_REVERT",
  "SETTLEMENT_UNKNOWN",
  "DELIVERY_INVALID",
  "EVIDENCE_UNAVAILABLE",
  "POLICY_VIOLATION",
  "SCREENING_HIT",
  "SIMULATION_MISMATCH",
  "REVIEW_REQUIRED",
  "OWNER_REJECTED",
  "WALLET_FROZEN",
  "WALLET_INHIBITED",
  "TEMPLATE_DENIED",
  "PERIOD_CAP",
  "AGENT_ANSWER_INVALID",
  "INTENT_INVALID",
  "NOT_IMPLEMENTED",
  "REAUTH_REQUIRED",
] as const;
export const ApiErrorSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string().max(2000),
    actionId: z.string().nullable(),
    evidenceId: z.string().nullable(),
    retryable: z.boolean(),
  })
  .strict();

export const OUTCOME_STATES = [
  "DRAFT",
  "AWAITING_OWNER",
  "READY",
  "RUNNING",
  "AWAITING_AGENT",
  "COMPLETED",
  "DELIVERY_FAILED",
  "NEEDS_OWNER",
  "CANCELLED",
] as const;
export const AUTHORITY_STATES = [
  "PENDING",
  "ACTIVE",
  "FROZEN",
  "CLOSING",
  "CLOSED",
  "REVOKED",
  "EXPIRED",
  "INVALIDATED",
] as const;
export const ACTION_STATES = [
  "PROPOSED",
  "RESERVED",
  "AWAITING_APPROVAL",
  "SIGNING",
  "SIGNED",
  "SUBMITTED",
  "INCLUDED",
  "FINALIZED",
  "DENIED",
  "REJECTED",
  "REVERTED",
  "UNKNOWN",
] as const;
export const OutcomeStateSchema = z.enum(OUTCOME_STATES);
export const AuthorityStateSchema = z.enum(AUTHORITY_STATES);
export const ActionStateSchema = z.enum(ACTION_STATES);

// POST /permits/draft "terms" (S4 v7). Server derives everything else.
export const TermsSchema = z
  .object({
    asset: NonZeroAddressSchema,
    startsAt: Uint64,
    expiresAt: Uint64,
    maxActions: Uint32,
    maxPayments: Uint32,
    maxPayment: Uint256,
    spendCap: Uint256,
    liquidFloor: Uint256,
    depositCap: Uint256,
    withdrawCap: Uint256,
    reviewThreshold: Uint256,
    periodCap: Uint256,
    periodSeconds: Uint32,
    recipients: z.array(NonZeroAddressSchema).max(4),
    schedule: ScheduleSchema,
    templateIds: z.array(Hex32Schema).max(8),
  })
  .strict();

const typedDataJsonSchema = <P extends string, M extends z.ZodTypeAny>(
  primaryType: P,
  message: M,
) =>
  z
    .object({
      types: z.record(
        z.array(z.object({ name: z.string(), type: z.string() }).strict()),
      ),
      primaryType: z.literal(primaryType),
      domain: WalletDomainSchema,
      message,
    })
    .strict();
export const TypedPermitSchema = typedDataJsonSchema("Permit", PermitSchema);
export const TypedApprovalSchema = typedDataJsonSchema(
  "Approval",
  ApprovalSchema,
);
export const TypedWalletPolicySchema = typedDataJsonSchema(
  "WalletPolicy",
  WalletPolicySchema,
);

export const OwnerApprovalSchema = z
  .object({
    draftId: UuidSchema,
    typedData: TypedPermitSchema,
    scope: ScopeSchema,
    recipients: z.array(NonZeroAddressSchema).max(4),
    schedule: ScheduleSchema,
    templateIds: z.array(Hex32Schema).max(8),
    digest: Hex32Schema,
    policyVersion: Uint64,
    intentId: UuidSchema.nullable(),
  })
  .strict();

export const WalletViewSchema = z
  .object({
    walletId: UuidSchema,
    owner: AddressSchema,
    address: AddressSchema.nullable(),
    chainId: z.literal(CHAIN_ID),
    provisioningState: z.enum(["DEPLOYING", "KEYGEN", "READY", "FAILED"]),
    executorAddress: AddressSchema.nullable(),
    paused: z.boolean(),
    frozen: z.boolean(),
    epoch: Uint64,
    policyVersion: Uint64,
    inhibited: z.boolean(),
    assets: z.array(
      z
        .object({
          asset: AddressSchema,
          symbol: z.string().max(11),
          liquidUnits: Uint256,
          reservedUnits: Uint256,
        })
        .strict(),
    ),
    liquidUnits: Uint256,
    floorUnits: Uint256,
    reservedUnits: Uint256,
    vaultAssetsUnits: Uint256,
    spendableUnits: Uint256,
    budgets: z
      .object({
        day: Uint64,
        walletSpentUnits: Uint256,
        executorSpentUnits: Uint256,
        walletRemainingUnits: Uint256,
        executorRemainingUnits: Uint256,
      })
      .strict(),
    asOfBlock: Uint64,
  })
  .strict();

export const TaskViewSchema = z
  .object({
    taskId: UuidSchema,
    chainTaskId: Hex32Schema,
    walletId: UuidSchema,
    runbookId: RunbookIdSchema,
    outcomeState: OutcomeStateSchema,
    authorityState: AuthorityStateSchema,
    currentStep: z.string().max(64),
    grossSpendUnits: Uint256,
    payments: z.array(
      z
        .object({
          actionId: UuidSchema,
          requestId: Hex32Schema,
          providerId: z.string().nullable(),
          amountUnits: Uint256,
          txHash: Hex32Schema.nullable(),
          chainState: ActionStateSchema,
        })
        .strict(),
    ),
    delivery: z
      .object({
        state: z.enum(["NONE", "PENDING", "VALID", "INVALID", "FAILED"]),
        result: BrowserResultSchema.nullable(),
      })
      .strict(),
    result: JsonObjectSchema.nullable(),
    findings: z.array(FindingSchema),
    nextPollMs: z.literal(2000),
  })
  .strict();

export const CreateTaskRequestSchema = z
  .object({
    walletId: UuidSchema,
    runbookId: RunbookIdSchema,
    goal: z.string().min(1).max(2000),
    input: JsonObjectSchema,
  })
  .strict();
export const PermitDraftRequestSchema = z
  .object({ taskId: UuidSchema, terms: TermsSchema })
  .strict();
export const SignedSubmitSchema = z
  .object({ draftId: UuidSchema, ownerSignature: SignatureSchema })
  .strict();

export const AGENT_SCOPES = ["read", "prepare", "run", "evidence"] as const;
export const AgentTokenRequestSchema = z
  .object({
    walletId: UuidSchema,
    taskId: UuidSchema.nullable(),
    scopes: z
      .array(z.enum(AGENT_SCOPES))
      .min(1)
      .refine((s) => new Set(s).size === s.length, "Scopes must be unique"),
    expiresAt: Uint64,
  })
  .strict();

// S9.3 intent compiler.
export const IntentCompileRequestSchema = z
  .object({ walletId: UuidSchema, goal: z.string().min(1).max(2000) })
  .strict();
export const IntentDraftSchema = z
  .object({
    intentId: UuidSchema,
    draft: z
      .object({
        runbookId: RunbookIdSchema,
        input: JsonObjectSchema,
        terms: TermsSchema,
      })
      .strict(),
    explanation: z.string().max(4000),
    warnings: z.array(z.string().max(500)).max(20),
  })
  .strict();

// S9.5 owner co-signature requests. Agent tokens never see these.
export const ApprovalRequestSchema = z
  .object({
    approvalId: UuidSchema,
    walletId: UuidSchema,
    taskId: UuidSchema,
    action: ActionSchema,
    invoice: InvoiceSchema.nullable(),
    typedData: TypedApprovalSchema,
    digest: Hex32Schema,
    rationale: z.string().max(2000).nullable(),
    rationaleUntrusted: z.literal(true),
    expiresAt: Uint64,
    state: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
  })
  .strict();

// S9.4 policy drafts.
export const PolicyDraftRequestSchema = z
  .object({
    policy: z.object({ reviewThreshold: Uint256 }).strict(),
    lists: WalletPolicyListsSchema,
  })
  .strict();
export const PolicyDraftSchema = z
  .object({
    draftId: UuidSchema,
    typedData: TypedWalletPolicySchema,
    digest: Hex32Schema,
    effects: z.array(z.string().max(500)).max(50),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Terms = z.infer<typeof TermsSchema>;
export type OwnerApproval = z.infer<typeof OwnerApprovalSchema>;
export type WalletView = z.infer<typeof WalletViewSchema>;
export type TaskView = z.infer<typeof TaskViewSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type IntentDraft = z.infer<typeof IntentDraftSchema>;
export type PolicyDraft = z.infer<typeof PolicyDraftSchema>;
