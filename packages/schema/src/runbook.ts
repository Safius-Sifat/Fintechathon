import { z } from "zod";
import { ActionSchema, InvoiceSchema, PermitSchema } from "./authority.js";
import {
  ConditionsSchema,
  ProviderIdSchema,
  ScopeSchema,
} from "./conditions.js";
import { DeliveryEnvelopeSchema, QuoteEnvelopeSchema } from "./provider.js";
import { AgentAnswerRecordSchema, AgentQuestionSchema } from "./agent.js";
import { ActionStateSchema, WalletViewSchema } from "./api.js";
import { WalletPolicyListsSchema, WalletPolicySchema } from "./policy.js";
import {
  AddressSchema,
  Hex32Schema,
  HexDataSchema,
  JsonObjectSchema,
  NonZeroAddressSchema,
  SignatureSchema,
  Uint256,
  Uint32,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const RunbookStateSchema = z
  .object({
    schemaVersion: z.literal(4),
    step: z.number().int().min(0),
    attempt: z.number().int().min(0),
    retrievals: z.number().int().min(0),
    selectedProvider: ProviderIdSchema.nullable(),
    quotes: z.array(QuoteEnvelopeSchema),
    delivery: DeliveryEnvelopeSchema.nullable(),
    missedPeriods: z.array(z.number().int().min(0)),
  })
  .strict();
export const INITIAL_RUNBOOK_STATE = {
  schemaVersion: 4,
  step: 0,
  attempt: 0,
  retrievals: 0,
  selectedProvider: null,
  quotes: [],
  delivery: null,
  missedPeriods: [],
} as const;

export const X402AuthorizationSchema = z
  .object({
    payTo: NonZeroAddressSchema,
    amount: Uint256,
    validAfter: Uint64,
    validBefore: Uint64,
    nonce: Hex32Schema,
    authorizationDigest: Hex32Schema,
  })
  .strict();

export const ActionIntentSchema = z
  .object({
    operation: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(5),
      z.literal(6),
    ]),
    target: AddressSchema,
    amount: Uint256,
    minOutput: Uint256,
    invoice: InvoiceSchema.nullable(),
    providerSignature: SignatureSchema.nullable(),
    inputHash: Hex32Schema,
    period: Uint32,
    templateId: Hex32Schema.nullable(),
    callData: HexDataSchema.nullable(),
    x402: X402AuthorizationSchema.nullable(),
  })
  .strict()
  .superRefine((i, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if ((i.operation === 5) !== (i.templateId !== null && i.callData !== null))
      issue(
        "CALL requires templateId and callData; other operations forbid them",
      );
    if ((i.operation === 6) !== (i.x402 !== null))
      issue("X402 requires x402 authorization; other operations forbid it");
    if ((i.invoice === null) !== (i.providerSignature === null))
      issue("invoice and providerSignature go together");
  });

export const StoredActionSchema = z
  .object({
    decisionKey: z.string().min(1).max(128),
    action: ActionSchema,
    state: ActionStateSchema,
    txHash: Hex32Schema.nullable(),
    invoice: InvoiceSchema.nullable(),
  })
  .strict();

export const ApprovalRecordSchema = z
  .object({
    approvalId: UuidSchema,
    actionDigest: Hex32Schema,
    state: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
  })
  .strict();

export const RunbookSnapshotSchema = z
  .object({
    taskId: UuidSchema,
    chainTaskId: Hex32Schema,
    walletId: UuidSchema,
    walletAddress: AddressSchema,
    permitId: Hex32Schema,
    conditions: ConditionsSchema,
    scope: ScopeSchema,
    permit: PermitSchema,
    walletPolicy: z
      .object({ policy: WalletPolicySchema, lists: WalletPolicyListsSchema })
      .strict(),
    now: Uint64,
    chainBlock: Uint64,
    wallet: WalletViewSchema,
    actions: z.array(StoredActionSchema),
    observations: z.array(JsonObjectSchema),
    agentAnswers: z.array(AgentAnswerRecordSchema),
    approvals: z.array(ApprovalRecordSchema),
    runbookState: RunbookStateSchema,
  })
  .strict();

const evidence = z.array(JsonObjectSchema);
export const RunbookDecisionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("PROPOSE"),
      decisionKey: z.string().min(1).max(128),
      intent: ActionIntentSchema,
      evidence,
      nextState: RunbookStateSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("WAIT"),
      dueAt: Uint64,
      reason: z.string().max(500),
      nextState: RunbookStateSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("COMPLETE"),
      result: JsonObjectSchema,
      evidence,
      nextState: RunbookStateSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("AWAIT_AGENT"),
      question: AgentQuestionSchema,
      evidence,
      nextState: RunbookStateSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("NEEDS_OWNER"),
      reason: z.string().max(500),
      evidence,
      nextState: RunbookStateSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("FAILED"),
      reason: z.string().max(500),
      evidence,
      nextState: RunbookStateSchema,
    })
    .strict(),
]);

export type RunbookState = z.infer<typeof RunbookStateSchema>;
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type RunbookSnapshot = z.infer<typeof RunbookSnapshotSchema>;
export type RunbookDecision = z.infer<typeof RunbookDecisionSchema>;
