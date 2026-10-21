import assert from "node:assert/strict";
import test from "node:test";
import { buildThread, groupChats } from "../src/state/chatThread";
import type { ChatEvent, Conversation } from "../src/wallet/api";

const product = {
  productId: "aero-runner",
  name: "Aero Runner",
  brand: "Northfield",
  category: "running" as const,
  colors: ["blue", "white"],
  sizes: ["41", "42"],
  price: "450000",
  description: "Light daily trainer.",
  image: "/shop/images/aero-runner.svg",
};
let seq = 0;
const at = <T extends object>(e: T) =>
  ({ ...e, seq: ++seq, createdAt: 1000 + seq }) as unknown as ChatEvent;

test("events become turns: steps merge by id, text leads, cards keep order", () => {
  seq = 0;
  const turns = buildThread(
    [
      at({ type: "user", text: "Running shoes size 42" }),
      at({ type: "step", id: "a", label: "Searching", state: "started" }),
      at({
        type: "step",
        id: "a",
        label: "Searching",
        state: "done",
        detail: "1 found",
      }),
      at({ type: "products", note: "One pick", products: [product] }),
      at({ type: "agent", text: "Here is one." }),
      at({ type: "user", text: "I'll take it" }),
      at({ type: "error", message: "The agent could not reply. Try again." }),
    ],
    "",
    false,
  );
  assert.deepEqual(
    turns.map((t) => t.kind),
    ["user", "agent", "user", "agent"],
  );
  const reply = turns[1]!;
  assert.ok(reply.kind === "agent");
  assert.deepEqual(reply.steps, [
    { id: "a", label: "Searching", state: "done", detail: "1 found" },
  ]);
  assert.equal(reply.text, "Here is one.");
  assert.deepEqual(
    reply.cards.map((c) => c.kind),
    ["products"],
  );
  assert.equal(reply.writing, false);
  const failed = turns[3]!;
  assert.ok(failed.kind === "agent" && failed.cards[0]!.kind === "error");
});

test("while the agent replies, live text shows in a writing turn", () => {
  seq = 0;
  const waiting = buildThread([at({ type: "user", text: "hi" })], "", true);
  assert.equal(waiting.length, 2);
  assert.ok(waiting[1]!.kind === "agent" && waiting[1]!.writing);
  const writing = buildThread(
    [
      at({ type: "user", text: "hi" }),
      at({ type: "step", id: "s", label: "Searching", state: "started" }),
    ],
    "Hel",
    true,
  );
  assert.equal(writing.length, 2);
  const turn = writing[1]!;
  assert.ok(turn.kind === "agent");
  assert.equal(turn.text, "Hel");
  assert.equal(turn.steps.length, 1);
});

test("chats group into pinned, today, yesterday and earlier", () => {
  const now = new Date(2026, 9, 21, 15, 0, 0);
  const midnight = new Date(2026, 9, 21).getTime() / 1000;
  const chat = (id: string, updatedAt: number, pinned = false) =>
    ({
      conversationId: id,
      title: id,
      pinned,
      updatedAt,
      status: "idle",
    }) as Conversation;
  const groups = groupChats(
    [
      chat("old", midnight - 5 * 86400),
      chat("today", midnight + 3600),
      chat("pinned-old", midnight - 9 * 86400, true),
      chat("yesterday", midnight - 3600),
      chat("today-later", midnight + 7200),
    ],
    now,
  );
  assert.deepEqual(
    groups.map((g) => [g.title, g.chats.map((c) => c.conversationId)]),
    [
      ["Pinned", ["pinned-old"]],
      ["Today", ["today-later", "today"]],
      ["Yesterday", ["yesterday"]],
      ["Earlier", ["old"]],
    ],
  );
});
