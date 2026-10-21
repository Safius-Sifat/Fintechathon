import { Agent, run, type AgentInputItem } from "@openai/agents";
import type { ChatEvent } from "./events.js";
import { chatTools, type ChatContext } from "./tools.js";

export const INSTRUCTIONS = `You are the agent inside Mandate, a crypto wallet on Base Sepolia test network.
You help the owner buy from the Mandate Test Shop and run paid checks of a demo checkout page.

How you work:
- Use tools for every fact. Never state a price, product, order status or payment you did not get from a tool.
- To buy: search_products, then show_products with the best few matches, and let the user choose.
- If size or budget is missing and matters, use ask_choice once instead of guessing.
- Only call request_purchase after the user clearly picked one product and a size it comes in.
- request_purchase does not pay. After it, say in one sentence that the order is ready for them to approve on the sheet below.
- Never say anything was paid, ordered or shipped unless get_task_status shows it. The shop sells samples for test USDC and nothing ships.
- Prices are in USDC. Every product costs under 0.50 USDC because test payments are capped there.
- You cannot move money, sign, change limits or stop agents; the owner does that in the app.
- Keep replies short: one or two sentences, plain words, no lists of what you are about to do.`;

export type HistoryItem = { role: "user" | "assistant"; text: string };

const asInput = (history: HistoryItem[]): AgentInputItem[] =>
  history.map((h) =>
    h.role === "user"
      ? { role: "user", content: h.text }
      : {
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: h.text }],
        },
  );

// One agent reply to the conversation so far. Events stream to `emit` as they
// happen: text as it is written, each tool as a step, and the cards and
// purchase requests the tools produce. Ends with the full reply text.
export async function reply(
  context: Omit<ChatContext, "emit">,
  history: HistoryItem[],
  emit: (event: ChatEvent) => void,
  options: {
    model?: string | undefined;
    maxTurns?: number;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const agent = new Agent({
    name: "Mandate agent",
    instructions: INSTRUCTIONS,
    tools: chatTools({ ...context, emit }),
    ...(options.model ? { model: options.model } : {}),
  });
  const result = await run(agent, asInput(history), {
    stream: true,
    maxTurns: options.maxTurns ?? 8,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  for await (const event of result) {
    if (
      event.type === "raw_model_stream_event" &&
      event.data.type === "output_text_delta"
    )
      emit({ type: "text_delta", text: event.data.delta });
  }
  await result.completed;
  const text = String(result.finalOutput ?? "").trim();
  emit({ type: "agent", text });
  return text;
}
