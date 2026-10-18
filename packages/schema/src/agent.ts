import { z } from "zod";
import {
  big,
  JsonObjectSchema,
  NonZeroAddressSchema,
  Uint256,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const AGENT_QUESTION_KINDS = [
  "SELECT_OFFER",
  "RETRY_OR_FALLBACK",
  "SET_AMOUNT",
  "CONFIRM_COMPLETION",
  "ESCALATE",
] as const;

export const AgentOptionSchema = z
  .object({
    optionId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    label: z.string().min(1).max(200),
    facts: JsonObjectSchema,
    untrusted: z.boolean(),
  })
  .strict();

export const AgentBoundsSchema = z
  .object({ asset: NonZeroAddressSchema, minUnits: Uint256, maxUnits: Uint256 })
  .strict()
  .refine(
    (b) => big(b.minUnits) <= big(b.maxUnits),
    "minUnits must not exceed maxUnits",
  );

export const AgentQuestionSchema = z
  .object({
    questionId: UuidSchema,
    kind: z.enum(AGENT_QUESTION_KINDS),
    prompt: z.string().min(1).max(2000),
    options: z.array(AgentOptionSchema).max(10),
    bounds: AgentBoundsSchema.nullable(),
    defaultOptionId: z.string().nullable(),
    defaultAmount: Uint256.nullable(),
    deadline: Uint64,
  })
  .strict()
  .superRefine((q, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const ids = q.options.map((o) => o.optionId);
    if (new Set(ids).size !== ids.length)
      issue("optionId values must be unique");
    if (q.kind === "SET_AMOUNT") {
      if (q.bounds === null || q.options.length !== 0)
        issue("SET_AMOUNT uses bounds and no options");
      if (q.defaultOptionId !== null) issue("SET_AMOUNT has no default option");
      if (q.defaultAmount !== null && q.bounds !== null) {
        const v = big(q.defaultAmount);
        if (v < big(q.bounds.minUnits) || v > big(q.bounds.maxUnits))
          issue("defaultAmount outside bounds");
      }
    } else {
      if (q.bounds !== null || q.options.length === 0)
        issue("Choice questions use options and no bounds");
      if (q.defaultAmount !== null)
        issue("Choice questions have no default amount");
      if (q.defaultOptionId !== null && !ids.includes(q.defaultOptionId))
        issue("defaultOptionId must be one of the options");
    }
  });

// What the agent sends. No addresses, calldata or token fields exist here by design.
export const AgentAnswerSchema = z
  .object({
    optionId: z.string().nullable(),
    amount: Uint256.nullable(),
    rationale: z.string().max(2000),
  })
  .strict()
  .refine(
    (a) => (a.optionId === null) !== (a.amount === null),
    "Provide exactly one of optionId or amount",
  );

export const AgentAnswerRecordSchema = z
  .object({
    questionId: UuidSchema,
    decisionId: UuidSchema,
    optionId: z.string().nullable(),
    amount: Uint256.nullable(),
    rationale: z.string().max(2000),
    source: z.enum(["AGENT", "DEFAULT"]),
    runtime: z.string().max(64).nullable(),
    model: z.string().max(64).nullable(),
    receivedAt: Uint64,
  })
  .strict();

export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;
export type AgentAnswerRecord = z.infer<typeof AgentAnswerRecordSchema>;

/** Shared validation the API applies on receipt; the worker re-applies it with recomputed bounds. */
export function checkAgentAnswer(
  question: AgentQuestion,
  answer: AgentAnswer,
): { ok: true } | { ok: false; code: "AGENT_ANSWER_INVALID"; reason: string } {
  const fail = (reason: string) => ({
    ok: false as const,
    code: "AGENT_ANSWER_INVALID" as const,
    reason,
  });
  if (question.kind === "SET_AMOUNT") {
    if (answer.amount === null || question.bounds === null)
      return fail("amount required");
    const v = big(answer.amount);
    if (v < big(question.bounds.minUnits) || v > big(question.bounds.maxUnits))
      return fail("amount outside bounds");
    return { ok: true };
  }
  if (answer.optionId === null) return fail("optionId required");
  if (!question.options.some((o) => o.optionId === answer.optionId))
    return fail("optionId not offered");
  return { ok: true };
}
