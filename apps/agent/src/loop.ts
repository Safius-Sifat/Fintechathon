import type { AgentAnswer, AgentQuestion } from "@mandate/schema";

export interface AgentApi {
  nextQuestion(taskId: string): Promise<AgentQuestion | null>;
  answerQuestion(questionId: string, answer: AgentAnswer): Promise<unknown>;
  getTask(taskId: string): Promise<Record<string, unknown>>;
}

export type Decide = (question: AgentQuestion) => Promise<AgentAnswer | null>;

const TERMINAL = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "CLOSED",
]);

// Answers the runbook's questions for one task until the task ends. The
// service runs the money side; the agent only makes the bounded choices.
export async function runAgent(
  api: AgentApi,
  taskId: string,
  decide: Decide,
  log: (line: string) => void = () => {},
  maxIdlePolls = 1_000,
): Promise<string> {
  for (let idle = 0; idle < maxIdlePolls; ) {
    const task = await api.getTask(taskId);
    const state = String(task.state ?? task.status ?? "");
    if (TERMINAL.has(state)) return state;
    const question = await api.nextQuestion(taskId);
    if (!question) {
      idle++;
      continue;
    }
    idle = 0;
    log(`question ${question.kind}: ${question.prompt}`);
    const answer = await decide(question);
    if (!answer) {
      log("no valid answer; the service will use the safe default");
      continue;
    }
    await api.answerQuestion(question.questionId, answer);
    log(`answered ${answer.optionId ?? answer.amount}: ${answer.rationale}`);
  }
  return "STOPPED";
}
