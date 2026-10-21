import { MandateClient } from "@mandate/sdk";
import { DEFAULT_MODEL, decideWithAgent } from "./agent.js";
import { runAgent } from "./loop.js";

// Reference agent: answers one task's runbook questions with the OpenAI
// Agents SDK. Needs MANDATE_API_URL, MANDATE_AGENT_TOKEN (a run-scoped agent
// token), MANDATE_TASK_ID, MANDATE_TASK_GOAL and OPENAI_API_KEY.
const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

const client = new MandateClient({
  baseUrl: need("MANDATE_API_URL"),
  token: need("MANDATE_AGENT_TOKEN"),
});
const taskId = need("MANDATE_TASK_ID");
const goal = need("MANDATE_TASK_GOAL");
const model = process.env.MANDATE_AGENT_MODEL ?? DEFAULT_MODEL;

const outcome = await runAgent(
  client,
  taskId,
  (q) => decideWithAgent(q, { model, goal }),
  (line) => console.log(`[agent] ${line}`),
);
console.log(`[agent] task ${taskId} ended: ${outcome}`);
