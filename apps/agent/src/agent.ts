import { Agent, run, tool } from "@openai/agents";
import type { AgentAnswer, AgentQuestion } from "@mandate/schema";
import { z } from "zod";
import { SYSTEM_PROMPT, questionPrompt, toAnswer } from "./decide.js";

// The model the trusted manifest records for this agent.
export const DEFAULT_MODEL = "gpt-5.6-luna";

export interface DecideOptions {
  model: string;
  goal: string;
  maxTurns?: number;
}

// Asks the model, through the OpenAI Agents SDK, to answer one runbook
// question. The agent has exactly one tool, which only accepts an offered
// option or an amount within bounds; it has no other tools. Returns null when
// the model gives no valid answer; the service then applies the question's
// safe default at the deadline.
export async function decideWithAgent(
  question: AgentQuestion,
  opts: DecideOptions,
): Promise<AgentAnswer | null> {
  let chosen: AgentAnswer | null = null;
  const answer = tool({
    name: "answer",
    description:
      "Answer the runbook question with one offered optionId, or an amount in base units within the allowed range, plus a short reason.",
    parameters: z.object({
      optionId: z.string().nullable(),
      amount: z
        .string()
        .regex(/^[0-9]+$/)
        .nullable(),
      rationale: z.string().min(1).max(2000),
    }),
    execute: async (args) => {
      if (chosen) return "Already answered.";
      const result = toAnswer(question, {
        optionId: args.optionId ?? undefined,
        amount: args.amount ?? undefined,
        rationale: args.rationale,
      });
      if (!result.ok) return `Rejected: ${result.reason}`;
      chosen = result.answer;
      return "Accepted.";
    },
  });
  const agent = new Agent({
    name: "Mandate task agent",
    instructions: SYSTEM_PROMPT,
    model: opts.model,
    tools: [answer],
  });
  await run(agent, questionPrompt(question, opts.goal), {
    maxTurns: opts.maxTurns ?? 4,
  });
  return chosen;
}
