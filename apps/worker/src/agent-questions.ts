import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  AgentAnswerRecordSchema,
  AgentQuestionSchema,
  type AgentAnswerRecord,
  type AgentQuestion,
} from "@mandate/schema";
import { appendEvent, transaction } from "@mandate/platform";

// Called inside the transaction that commits the runbook's AWAIT_AGENT decision.
export async function recordQuestion(
  c: PoolClient,
  input: { taskId: string; permitId: string | null; question: AgentQuestion },
  now: number,
): Promise<void> {
  const question = AgentQuestionSchema.parse(input.question);
  await c.query(
    "INSERT INTO agent_questions(question_id,task_id,question,permit_id,state,deadline,created_at) VALUES($1,$2,$3,$4,'OPEN',$5,$6) ON CONFLICT (question_id) DO NOTHING",
    [
      question.questionId,
      input.taskId,
      question,
      input.permitId,
      question.deadline,
      now,
    ],
  );
  await c.query(
    "UPDATE tasks SET outcome_state='AWAITING_AGENT',updated_at=$2 WHERE id=$1",
    [input.taskId, now],
  );
  await appendEvent(
    c,
    {
      taskId: input.taskId,
      type: "AGENT_QUESTION",
      dedupeKey: "question:" + question.questionId,
      payload: { question },
    },
    now,
  );
}

// Past-deadline questions take their recorded default once; without a safe
// default the step fails and the task needs the owner.
export async function expireQuestions(
  database: Pool,
  now: number,
): Promise<number> {
  const due = await database.query<{ question_id: string }>(
    "SELECT question_id FROM agent_questions WHERE state='OPEN' AND deadline<=$1 ORDER BY deadline",
    [now],
  );
  for (const { question_id } of due.rows)
    await transaction(database, async (c) => {
      const row = (
        await c.query<{
          task_id: string;
          question: AgentQuestion;
          state: string;
        }>(
          "SELECT task_id,question,state FROM agent_questions WHERE question_id=$1 FOR UPDATE",
          [question_id],
        )
      ).rows[0];
      if (!row || row.state !== "OPEN") return;
      const q = row.question;
      const hasDefault = q.defaultOptionId !== null || q.defaultAmount !== null;
      const decisionId = randomUUID();
      const answer = hasDefault
        ? {
            optionId: q.defaultOptionId,
            amount: q.defaultAmount,
            rationale: "Deadline passed; recorded default applied.",
          }
        : null;
      await c.query(
        "UPDATE agent_questions SET state=$2,answer=$3,decision_id=$4,answered_at=$5 WHERE question_id=$1",
        [
          question_id,
          hasDefault ? "DEFAULTED" : "FAILED",
          answer,
          decisionId,
          now,
        ],
      );
      await c.query(
        "UPDATE tasks SET outcome_state=$2,updated_at=$3 WHERE id=$1",
        [row.task_id, hasDefault ? "RUNNING" : "NEEDS_OWNER", now],
      );
      await appendEvent(
        c,
        {
          taskId: row.task_id,
          type: "AGENT_TIMEOUT",
          dedupeKey: "timeout:" + question_id,
          payload: {
            questionId: question_id,
            decisionId,
            defaultApplied: hasDefault,
            answer,
          },
        },
        now,
      );
    });
  return due.rowCount ?? 0;
}

// snapshot.agentAnswers for the next advance call.
export async function answersFor(
  database: Pool,
  taskId: string,
): Promise<AgentAnswerRecord[]> {
  const rows = await database.query<{
    question_id: string;
    decision_id: string;
    state: string;
    answer: {
      optionId: string | null;
      amount: string | null;
      rationale: string;
      runtime?: string;
      model?: string;
    };
    answered_at: string;
  }>(
    "SELECT question_id,decision_id,state,answer,answered_at::text FROM agent_questions WHERE task_id=$1 AND state IN ('ANSWERED','DEFAULTED') ORDER BY answered_at,question_id",
    [taskId],
  );
  return rows.rows.map((r) =>
    AgentAnswerRecordSchema.parse({
      questionId: r.question_id,
      decisionId: r.decision_id,
      optionId: r.answer.optionId,
      amount: r.answer.amount,
      rationale: r.answer.rationale,
      source: r.state === "DEFAULTED" ? "DEFAULT" : "AGENT",
      runtime: r.answer.runtime ?? null,
      model: r.answer.model ?? null,
      receivedAt: r.answered_at,
    }),
  );
}
