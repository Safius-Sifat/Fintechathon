// A chat with the agent as the phone shows it: the service's stored events
// grouped into turns, plus the text the agent is writing right now. Every
// card comes from a stored event; the phone adds nothing of its own.
import type { ChatEvent, Conversation } from "../wallet/api";
import type { ShopProduct } from "../wallet/service-dto/provider";

export interface ChatStep {
  id: string;
  label: string;
  state: "started" | "done" | "failed";
  detail?: string;
}

export type ChatCard =
  | { kind: "products"; key: string; note: string; products: ShopProduct[] }
  | { kind: "question"; key: string; question: string; options: string[] }
  | {
      kind: "purchase";
      key: string;
      taskId: string;
      product: ShopProduct;
      size: string | null;
      amount: string;
    }
  | { kind: "task"; key: string; taskId: string; label: string }
  | { kind: "error"; key: string; message: string };

export type Turn =
  | { kind: "user"; key: string; text: string }
  | {
      kind: "agent";
      key: string;
      steps: ChatStep[];
      text: string;
      cards: ChatCard[];
      // The agent is still writing this reply.
      writing: boolean;
    };

type AgentTurn = Extract<Turn, { kind: "agent" }>;

export function buildThread(
  events: readonly ChatEvent[],
  live: string,
  replying: boolean,
): Turn[] {
  const turns: Turn[] = [];
  const reply = (key: string): AgentTurn => {
    const last = turns.at(-1);
    if (last?.kind === "agent") return last;
    const turn: AgentTurn = {
      kind: "agent",
      key,
      steps: [],
      text: "",
      cards: [],
      writing: false,
    };
    turns.push(turn);
    return turn;
  };
  for (const e of events) {
    const key = String(e.seq);
    if (e.type === "user") {
      turns.push({ kind: "user", key, text: e.text });
      continue;
    }
    const turn = reply(key);
    switch (e.type) {
      case "agent":
        turn.text = e.text;
        break;
      case "step": {
        const step: ChatStep = {
          id: e.id,
          label: e.label,
          state: e.state,
          ...(e.detail ? { detail: e.detail } : {}),
        };
        const at = turn.steps.findIndex((s) => s.id === e.id);
        if (at >= 0) turn.steps[at] = step;
        else turn.steps.push(step);
        break;
      }
      case "products":
        turn.cards.push({
          kind: "products",
          key,
          note: e.note,
          products: e.products,
        });
        break;
      case "question":
        turn.cards.push({
          kind: "question",
          key,
          question: e.question,
          options: e.options,
        });
        break;
      case "purchase":
        turn.cards.push({
          kind: "purchase",
          key,
          taskId: e.taskId,
          product: e.product,
          size: e.size,
          amount: e.amount,
        });
        break;
      case "task":
        turn.cards.push({
          kind: "task",
          key,
          taskId: e.taskId,
          label: e.label,
        });
        break;
      case "error":
        turn.cards.push({ kind: "error", key, message: e.message });
        break;
    }
  }
  if (replying) {
    const turn = reply("writing");
    turn.writing = true;
    if (live) turn.text = live;
  }
  return turns;
}

const DAY = 86400;

// Pinned chats lead, then Today, Yesterday and Earlier by last activity.
export function groupChats(
  chats: readonly Conversation[],
  now = new Date(),
): { title: string; chats: Conversation[] }[] {
  const midnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const groups: [string, (c: Conversation) => boolean][] = [
    ["Pinned", (c) => c.pinned],
    ["Today", (c) => c.updatedAt >= midnight],
    ["Yesterday", (c) => c.updatedAt >= midnight - DAY],
    ["Earlier", () => true],
  ];
  const left = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  return groups
    .map(([title, fits]) => {
      const taken = left.filter(fits);
      for (const c of taken) left.splice(left.indexOf(c), 1);
      return { title, chats: taken };
    })
    .filter((g) => g.chats.length);
}

export const chatTitle = (c: Conversation) => c.title ?? "New chat";
