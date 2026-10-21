import { setDefaultOpenAIKey, setTracingDisabled } from "@openai/agents";
import { chatServer } from "./chat/server.js";

// The Mandate chat agent (plan 05). Holds only the OpenAI key; reaches the
// Mandate API with the per-conversation agent token the API passes in.
// Needs OPENAI_API_KEY, AGENT_SERVICE_TOKEN, MANDATE_API_URL and
// MANDATE_SHOP_URL; MANDATE_CHAT_MODEL picks a model (the SDK default if unset).
const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

setDefaultOpenAIKey(need("OPENAI_API_KEY"));
// Conversations stay between the owner, this service and the model call; no
// traces are exported unless explicitly enabled.
setTracingDisabled(process.env.MANDATE_AGENT_TRACING !== "1");

const app = chatServer({
  serviceToken: need("AGENT_SERVICE_TOKEN"),
  apiUrl: need("MANDATE_API_URL"),
  shopUrl: need("MANDATE_SHOP_URL"),
  model: process.env.MANDATE_CHAT_MODEL,
});
await app.listen({
  host: process.env.AGENT_HOST ?? "127.0.0.1",
  port: Number(process.env.AGENT_PORT ?? 3003),
});
console.log("[agent] chat service listening");
