import test from "node:test";
import assert from "node:assert/strict";
import { RunContext } from "@openai/agents";
import { chatTools, type ChatContext } from "../src/chat/tools.js";
import { chatServer } from "../src/chat/server.js";
import {
  units,
  usdc,
  type ChatEvent,
  type Product,
} from "../src/chat/events.js";

const product: Product = {
  productId: "aero-runner",
  name: "Aero Runner",
  brand: "Northfield",
  category: "running",
  colors: ["blue", "white"],
  sizes: ["41", "42"],
  price: "450000",
  description: "Light daily trainer.",
  image: "/shop/images/aero-runner.svg",
};
const TASK = "11111111-1111-4111-8111-111111111111";
const TOKEN = "mat_" + "a".repeat(43);

function harness(
  opts: { deliveryHash?: string | null; taskStatus?: number } = {},
) {
  const events: ChatEvent[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("/shop/catalog?"))
      return json(200, { products: [product] });
    if (url.includes("/shop/catalog/")) return json(200, product);
    if (url.endsWith("/v1/tasks") && init?.method === "POST")
      return json(
        opts.taskStatus ?? 200,
        opts.taskStatus ? { message: "refused" } : { taskId: TASK },
      );
    return json(404, { error: "not found" });
  }) as typeof fetch;
  const ctx: ChatContext = {
    apiUrl: "https://api.test",
    shopUrl: "https://shop.test",
    token: TOKEN,
    walletId: "22222222-2222-4222-8222-222222222222",
    deliveryHash:
      opts.deliveryHash === undefined
        ? "0x" + "ab".repeat(32)
        : opts.deliveryHash,
    emit: (e) => events.push(e),
    fetch: fakeFetch,
  };
  const tools = Object.fromEntries(chatTools(ctx).map((t) => [t.name, t]));
  const call = (name: string, args: unknown) =>
    tools[name]!.invoke(new RunContext(), JSON.stringify(args));
  return { events, requests, call };
}

test("chat: amounts convert between units and USDC exactly", () => {
  assert.equal(usdc("450000"), "0.45");
  assert.equal(usdc("1000000"), "1.00");
  assert.equal(units("0.4"), "400000");
  assert.equal(units("abc"), null);
});

test("chat: searching the shop shows a step and only real products can be shown", async () => {
  const h = harness();
  assert.match(
    String(
      await h.call("show_products", { productIds: ["aero-runner"], note: "x" }),
    ),
    /search first/,
  );
  const found = String(
    await h.call("search_products", {
      query: "running",
      maxPrice: "0.50",
      size: "42",
      category: null,
    }),
  );
  assert.match(found, /aero-runner: Aero Runner.*0\.45 USDC/);
  assert.match(h.requests[0]!.url, /maxPrice=500000/);
  await h.call("show_products", {
    productIds: ["aero-runner", "invented"],
    note: "Two picks",
  });
  const steps = h.events.filter((e) => e.type === "step");
  assert.deepEqual(
    steps.map((s) => (s as { state: string }).state),
    ["started", "done"],
  );
  const cards = h.events.find((e) => e.type === "products") as {
    products: Product[];
  };
  assert.deepEqual(
    cards.products.map((p) => p.productId),
    ["aero-runner"],
  );
});

test("chat: a purchase opens a commerce task with the shop's price and never pays", async () => {
  const h = harness();
  await h.call("search_products", {
    query: "running",
    maxPrice: null,
    size: null,
    category: null,
  });
  await h.call("request_purchase", { productId: "aero-runner", size: "42" });
  const post = h.requests.find((r) => r.url.endsWith("/v1/tasks"))!;
  assert.equal(
    (post.init!.headers as Record<string, string>).authorization,
    `Bearer ${TOKEN}`,
  );
  const body = JSON.parse(String(post.init!.body));
  assert.equal(body.runbookId, "commerce-buy");
  assert.equal(body.input.maxAmount, "450000");
  assert.equal(body.input.size, "42");
  const purchase = h.events.find((e) => e.type === "purchase") as {
    taskId: string;
    amount: string;
  };
  assert.equal(purchase.taskId, TASK);
  assert.equal(purchase.amount, "450000");
});

test("chat: no saved address, a wrong size or an API refusal fail the step with a reason", async () => {
  for (const [opts, args] of [
    [{ deliveryHash: null }, { productId: "aero-runner", size: "42" }],
    [{}, { productId: "aero-runner", size: "47" }],
    [{ taskStatus: 403 }, { productId: "aero-runner", size: "42" }],
  ] as const) {
    const h = harness(opts);
    const out = String(await h.call("request_purchase", args));
    assert.ok(out.length > 0);
    const failed = h.events.filter(
      (e) => e.type === "step" && e.state === "failed",
    );
    assert.equal(failed.length, 1, JSON.stringify(opts));
    assert.equal(
      h.events.some((e) => e.type === "purchase"),
      false,
    );
  }
});

test("chat server: only the API's secret is accepted and replies stream as events", async () => {
  const app = chatServer({
    serviceToken: "secret-for-tests",
    apiUrl: "https://api.test",
    shopUrl: "https://shop.test",
    reply: async (_ctx, _history, emit) => {
      emit({ type: "text_delta", text: "Hi" });
      emit({ type: "agent", text: "Hi" });
      return "Hi";
    },
  });
  const payload = {
    conversationId: "33333333-3333-4333-8333-333333333333",
    walletId: "22222222-2222-4222-8222-222222222222",
    token: TOKEN,
    deliveryHash: null,
    history: [{ role: "user", text: "Buy me running shoes" }],
  };
  const denied = await app.inject({
    method: "POST",
    url: "/v1/reply",
    payload,
  });
  assert.equal(denied.statusCode, 401);
  const res = await app.inject({
    method: "POST",
    url: "/v1/reply",
    headers: { authorization: "Bearer secret-for-tests" },
    payload,
  });
  assert.equal(res.statusCode, 200);
  const lines = res.body
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.deepEqual(
    lines.map((l) => l.type),
    ["text_delta", "agent"],
  );
});

test("chat server: a model failure becomes a plain error event, not a fake reply", async () => {
  const app = chatServer({
    serviceToken: "s",
    apiUrl: "https://api.test",
    shopUrl: "https://shop.test",
    reply: async () => {
      throw new Error("401 Incorrect API key provided");
    },
  });
  const res = await app.inject({
    method: "POST",
    url: "/v1/reply",
    headers: { authorization: "Bearer s" },
    payload: {
      conversationId: "33333333-3333-4333-8333-333333333333",
      walletId: "22222222-2222-4222-8222-222222222222",
      token: TOKEN,
      deliveryHash: null,
      history: [{ role: "user", text: "hello" }],
    },
  });
  const events = res.body
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.deepEqual(events, [
    { type: "error", message: "The agent's model is not configured." },
  ]);
});

test("chat server: a reply is not cancelled once the request body is read", async () => {
  let aborted: boolean | null = null;
  const app = chatServer({
    serviceToken: "s",
    apiUrl: "https://api.test",
    shopUrl: "https://shop.test",
    reply: async (_ctx, _history, emit, opts) => {
      await new Promise((r) => setTimeout(r, 50));
      aborted = opts?.signal?.aborted ?? null;
      emit({ type: "agent", text: "done" });
      return "done";
    },
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  try {
    const { port } = app.server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${port}/v1/reply`, {
      method: "POST",
      headers: {
        authorization: "Bearer s",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        conversationId: "33333333-3333-4333-8333-333333333333",
        walletId: "22222222-2222-4222-8222-222222222222",
        token: TOKEN,
        deliveryHash: null,
        history: [{ role: "user", text: "hello" }],
      }),
    });
    assert.match(await res.text(), /"type":"agent"/);
    assert.equal(aborted, false);
  } finally {
    await app.close();
  }
});
