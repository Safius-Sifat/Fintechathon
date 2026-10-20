import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import {
  AgentAnswerSchema,
  AgentQuestionSchema,
  checkAgentAnswer,
  Hex32Schema,
  IntentCompileRequestSchema,
  IntentDraftSchema,
  TermsSchema,
  RunbookIdSchema,
  JsonObjectSchema,
  canonicalJson,
  type AgentQuestion,
  type DeploymentManifest,
} from "@mandate/schema";
import { appendEvent, transaction, type Clock } from "@mandate/platform";
import { AuthError } from "../auth/errors.js";
import {
  requireOwner,
  requireTaskAccess,
  requireWalletAccess,
  scopeDenied,
  type Principal,
} from "./access.js";

// Person4's compiler library; the API hosts it but never invents a draft itself.
export type IntentCompiler = (input: {
  walletId: string;
  goal: string;
}) => Promise<unknown>;

// Who produced an agent decision; sent by the MCP server as the x-mandate-agent header.
const AgentIdentitySchema = z
  .object({
    runtime: z.string().min(1).max(64),
    sdkVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    model: z.string().min(1).max(64),
    toolCallId: z.string().min(1).max(128),
    mcpToolsetHash: Hex32Schema,
  })
  .strict();

const LONG_POLL_SECONDS = 25;
const invalid = (reason: string) =>
  new AuthError(422, reason, "AGENT_ANSWER_INVALID");

export class AgenticService {
  constructor(
    readonly database: Pool,
    readonly clock: Clock,
    readonly compiler: IntentCompiler | null,
    readonly manifest: DeploymentManifest | null,
  ) {}

  private async task(principal: Principal, taskId: string) {
    const row = (
      await this.database.query<{
        id: string;
        wallet_id: string;
        owner_address: string;
      }>(
        "SELECT t.id,t.wallet_id,w.owner_address FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1",
        [taskId],
      )
    ).rows[0];
    if (principal.kind !== "agent")
      throw scopeDenied("Agent questions require a task run token.");
    return requireTaskAccess(principal, row, "run");
  }

  async next(
    principal: Principal,
    taskId: string,
    waitSeconds = LONG_POLL_SECONDS,
  ): Promise<AgentQuestion | null> {
    await this.task(principal, taskId);
    const deadline =
      Date.now() + Math.min(waitSeconds, LONG_POLL_SECONDS) * 1000;
    for (;;) {
      const row = (
        await this.database.query<{ question: AgentQuestion }>(
          "SELECT question FROM agent_questions WHERE task_id=$1 AND state='OPEN' AND deadline>$2",
          [taskId, this.clock()],
        )
      ).rows[0];
      if (row || Date.now() >= deadline)
        return row ? AgentQuestionSchema.parse(row.question) : null;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Bounds are recomputed from current permit headroom when the answer arrives.
  private async currentMax(
    permitId: string | null,
    stored: bigint,
  ): Promise<bigint> {
    if (!permitId) return stored;
    const row = (
      await this.database.query<{ cap: string; used: string }>(
        "SELECT p.spend_cap::text AS cap,COALESCE((SELECT sum(amount) FROM reservations WHERE permit_id=p.permit_id AND state IN ('RESERVED','UNKNOWN','INCLUDED')),0)::text AS used FROM permits p WHERE p.permit_id=$1",
        [permitId],
      )
    ).rows[0];
    if (!row) return 0n;
    const headroom = BigInt(row.cap) - BigInt(row.used);
    return headroom < stored ? (headroom > 0n ? headroom : 0n) : stored;
  }

  async answer(
    principal: Principal,
    questionId: string,
    input: unknown,
    identityHeader: string | undefined,
  ) {
    const answer = AgentAnswerSchema.safeParse(input);
    if (!answer.success)
      throw invalid(
        "Answer must be one optionId or one amount, with a rationale.",
      );
    let identity: z.infer<typeof AgentIdentitySchema>;
    try {
      identity = AgentIdentitySchema.parse(
        JSON.parse(identityHeader ?? "null"),
      );
    } catch {
      throw new AuthError(
        422,
        "x-mandate-agent identity header is required.",
        "AGENT_ANSWER_INVALID",
      );
    }
    const hash = createHash("sha256")
      .update(canonicalJson(answer.data))
      .digest("hex");
    return transaction(this.database, async (c) => {
      const row = (
        await c.query<{
          task_id: string;
          question: AgentQuestion;
          permit_id: string | null;
          state: string;
          answer_hash: string | null;
          decision_id: string | null;
          deadline: string;
        }>(
          "SELECT task_id,question,permit_id,state,answer_hash,decision_id,deadline FROM agent_questions WHERE question_id=$1 FOR UPDATE",
          [questionId],
        )
      ).rows[0];
      if (!row) throw scopeDenied();
      await this.task(principal, row.task_id);
      if (row.state !== "OPEN") {
        if (row.answer_hash === hash)
          return { accepted: true as const, decisionId: row.decision_id! };
        throw new AuthError(
          409,
          "This question already has a different decision.",
          "DUPLICATE_REQUEST",
        );
      }
      if (this.clock() >= Number(row.deadline))
        throw invalid("Question deadline passed.");
      const question = AgentQuestionSchema.parse(row.question);
      const bounds = question.bounds
        ? {
            ...question.bounds,
            maxUnits: (
              await this.currentMax(
                row.permit_id,
                BigInt(question.bounds.maxUnits),
              )
            ).toString(),
          }
        : null;
      if (bounds && BigInt(bounds.minUnits) > BigInt(bounds.maxUnits))
        throw invalid("No remaining budget for this amount.");
      const checked = checkAgentAnswer({ ...question, bounds }, answer.data);
      if (!checked.ok) throw invalid(checked.reason);
      const decisionId = randomUUID();
      const now = this.clock();
      await c.query(
        "UPDATE agent_questions SET state='ANSWERED',answer=$2,answer_hash=$3,decision_id=$4,agent_token_id=$5,answered_at=$6 WHERE question_id=$1",
        [
          questionId,
          { ...answer.data, runtime: identity.runtime, model: identity.model },
          hash,
          decisionId,
          principal.kind === "agent" ? principal.tokenId : null,
          now,
        ],
      );
      await c.query(
        "UPDATE tasks SET outcome_state='RUNNING',updated_at=$2 WHERE id=$1",
        [row.task_id, now],
      );
      await appendEvent(
        c,
        {
          taskId: row.task_id,
          type: "AGENT_DECISION",
          dedupeKey: "decision:" + questionId,
          payload: {
            questionId,
            optionId: answer.data.optionId,
            amount: answer.data.amount,
            rationale: answer.data.rationale,
            rationaleHash:
              "0x" +
              createHash("sha256").update(answer.data.rationale).digest("hex"),
            ...identity,
            agentTokenId: principal.kind === "agent" ? principal.tokenId : null,
          },
        },
        now,
      );
      await c.query(
        "INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at) VALUES($1,'task.advance',$2,$3,'READY',$4,10,$4,$4) ON CONFLICT DO NOTHING",
        [randomUUID(), "answer:" + questionId, { taskId: row.task_id }, now],
      );
      return { accepted: true as const, decisionId };
    });
  }

  // The compiled draft is a proposal; anything outside the trusted manifest is refused.
  async compile(principal: Principal, input: unknown) {
    const owner = requireOwner(principal);
    const body = IntentCompileRequestSchema.parse(input);
    const wallet = (
      await this.database.query<{ id: string; owner_address: string }>(
        "SELECT id,owner_address FROM wallets WHERE id=$1",
        [body.walletId],
      )
    ).rows[0];
    requireWalletAccess(owner, wallet, "read");
    if (!this.compiler || !this.manifest)
      throw new AuthError(
        503,
        "Intent compiler (Person4) or trusted manifest is not configured; use the manual form.",
        "INTENT_INVALID",
      );
    const output = z
      .object({
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
      .strict()
      .safeParse(
        await this.compiler({ walletId: body.walletId, goal: body.goal }),
      );
    if (!output.success)
      throw new AuthError(
        422,
        "Compiler output does not match the shared schema.",
        "INTENT_INVALID",
      );
    const { terms, runbookId } = output.data.draft;
    const m = this.manifest;
    const providers = new Set(m.providers.map((p) => p.recipient));
    const policy = (
      await this.database.query<{
        lists: {
          assetCaps: { asset: string; perTx: string }[];
          templates: { templateId: string }[];
          blocklist: string[];
        };
      }>(
        "SELECT lists FROM wallet_policies WHERE wallet_id=$1 ORDER BY version DESC LIMIT 1",
        [body.walletId],
      )
    ).rows[0]?.lists;
    const cap = policy?.assetCaps.find(
      (c) => c.asset.toLowerCase() === terms.asset.toLowerCase(),
    );
    if (
      !m.runbooks.some((r) => r.runbookId === runbookId) ||
      !m.agentAssets.some((a) => a.address === terms.asset) ||
      terms.recipients.some(
        (r) =>
          !providers.has(r) ||
          policy?.blocklist.some((b) => b.toLowerCase() === r.toLowerCase()),
      ) ||
      terms.templateIds.some(
        (t) => !policy?.templates.some((p) => p.templateId === t),
      ) ||
      (cap && BigInt(terms.maxPayment) > BigInt(cap.perTx))
    )
      throw new AuthError(
        422,
        "Draft names an unknown runbook, asset, provider or template, or exceeds the wallet policy.",
        "INTENT_INVALID",
      );
    const draft = IntentDraftSchema.parse({
      intentId: randomUUID(),
      ...output.data,
    });
    await this.database.query(
      "INSERT INTO intent_drafts(intent_id,wallet_id,goal,draft,created_at) VALUES($1,$2,$3,$4,$5)",
      [draft.intentId, body.walletId, body.goal, draft, this.clock()],
    );
    return draft;
  }
}
