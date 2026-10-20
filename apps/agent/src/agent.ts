import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentAnswer, AgentQuestion } from "@mandate/schema";
import { z } from "zod";
import { SYSTEM_PROMPT, questionPrompt, toAnswer } from "./decide.js";

export interface DecideOptions {
  model: string;
  goal: string;
  maxTurns?: number;
}

const ANSWER_TOOL = "mcp__mandate__answer";

// Asks Claude, through the Claude Agent SDK, to answer one runbook question.
// The model gets exactly one tool, which only accepts an offered option or an
// amount within bounds. Built-in tools (shell, files, web) are disabled.
// Returns null when the model gives no valid answer; the service then applies
// the question's safe default at the deadline.
export async function decideWithClaude(
  question: AgentQuestion,
  opts: DecideOptions,
): Promise<AgentAnswer | null> {
  let chosen: AgentAnswer | null = null;
  const server = createSdkMcpServer({
    name: "mandate",
    version: "1.0.0",
    tools: [
      tool(
        "answer",
        "Answer the runbook question with one offered optionId, or an amount in base units within the allowed range, plus a short reason.",
        {
          optionId: z.string().optional(),
          amount: z
            .string()
            .regex(/^[0-9]+$/)
            .optional(),
          rationale: z.string().min(1).max(2000),
        },
        async (args) => {
          if (chosen)
            return { content: [{ type: "text", text: "Already answered." }] };
          const result = toAnswer(question, args);
          if (!result.ok)
            return {
              content: [{ type: "text", text: `Rejected: ${result.reason}` }],
              isError: true,
            };
          chosen = result.answer;
          return { content: [{ type: "text", text: "Accepted." }] };
        },
      ),
    ],
  });

  const run = query({
    prompt: questionPrompt(question, opts.goal),
    options: {
      model: opts.model,
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      mcpServers: { mandate: server },
      allowedTools: [ANSWER_TOOL],
      canUseTool: async (name, input) =>
        name === ANSWER_TOOL
          ? { behavior: "allow", updatedInput: input }
          : { behavior: "deny", message: "Only the answer tool is available." },
      settingSources: [],
      persistSession: false,
      maxTurns: opts.maxTurns ?? 4,
    },
  });
  for await (const message of run) {
    if (message.type === "result") break;
  }
  return chosen;
}
