import { randomUUID } from "node:crypto";
import { tool } from "@openai/agents";
import { z } from "zod";
import { units, usdc, type Emit, type Product } from "./events.js";

// What one reply may use. The token is a wallet-scoped agent token with
// read and prepare only (S9.12 tier T1): it can open tasks and read them,
// never sign, approve or pay.
export interface ChatContext {
  apiUrl: string;
  shopUrl: string;
  token: string;
  walletId: string;
  // Hash of the owner's saved delivery details; null until they add some.
  deliveryHash: string | null;
  emit: Emit;
  fetch?: typeof fetch;
}

const TIMEOUT_MS = 20_000;

// Runs one tool as a visible step: started, then done or failed.
async function step<T>(
  ctx: ChatContext,
  label: string,
  work: () => Promise<{ value: T; detail?: string }>,
): Promise<T> {
  const id = randomUUID();
  ctx.emit({ type: "step", id, label, state: "started" });
  try {
    const { value, detail } = await work();
    ctx.emit({
      type: "step",
      id,
      label,
      state: "done",
      ...(detail ? { detail } : {}),
    });
    return value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "failed";
    ctx.emit({ type: "step", id, label, state: "failed", detail });
    throw error;
  }
}

async function getJson(ctx: ChatContext, url: string, init?: RequestInit) {
  const res = await (ctx.fetch ?? fetch)(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { message?: string; error?: string } | null)?.message ??
      (body as { error?: string } | null)?.error ??
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}

const api = (ctx: ChatContext, path: string, init: RequestInit = {}) =>
  getJson(ctx, ctx.apiUrl + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ctx.token}`,
      ...(init.headers ?? {}),
    },
  });

const brief = (p: Product) =>
  `${p.productId}: ${p.name} by ${p.brand}, ${p.category}, ${p.colors.join("/")}, ${usdc(p.price)} USDC, sizes ${p.sizes.join(" ") || "one size"}`;

export function chatTools(ctx: ChatContext) {
  // Products the shop actually returned in this reply, by ID.
  const seen = new Map<string, Product>();

  const searchProducts = tool({
    name: "search_products",
    description:
      "Search the Mandate Test Shop catalogue. Returns real products with prices in USDC. Use before showing or buying anything.",
    parameters: z.object({
      query: z.string().max(120).describe("Words such as 'running blue'"),
      maxPrice: z
        .string()
        .nullable()
        .describe("Most the user wants to pay in USDC, e.g. '0.40', or null"),
      size: z.string().nullable().describe("EU size such as '42', or null"),
      category: z.enum(["running", "court", "trail", "lifestyle"]).nullable(),
    }),
    execute: (input) =>
      step(ctx, "Searching the shop", async () => {
        const q = new URLSearchParams({ q: input.query, limit: "6" });
        const max = input.maxPrice ? units(input.maxPrice) : null;
        if (max) q.set("maxPrice", max);
        if (input.size) q.set("size", input.size);
        if (input.category) q.set("category", input.category);
        const body = (await getJson(
          ctx,
          `${ctx.shopUrl}/shop/catalog?${q.toString()}`,
        )) as { products: Product[] };
        for (const p of body.products) seen.set(p.productId, p);
        const found = body.products.length;
        return {
          value: found
            ? body.products.map(brief).join("\n")
            : "No products match. Suggest widening the search.",
          detail: `${found} found`,
        };
      }),
  });

  const showProducts = tool({
    name: "show_products",
    description:
      "Show product cards in the chat so the user can choose. Only IDs returned by search_products in this reply.",
    parameters: z.object({
      productIds: z.array(z.string()).min(1).max(6),
      note: z.string().max(200).describe("One short line above the cards"),
    }),
    execute: async ({ productIds, note }) => {
      const products = productIds
        .map((id) => seen.get(id))
        .filter((p): p is Product => !!p);
      if (!products.length)
        return "None of those IDs came from search_products; search first.";
      ctx.emit({ type: "products", note, products });
      return `Showed ${products.length} products. Wait for the user to choose.`;
    },
  });

  const askChoice = tool({
    name: "ask_choice",
    description:
      "Ask one short question with tappable answers, for a missing size, budget or colour. Then stop and wait.",
    parameters: z.object({
      question: z.string().max(160),
      options: z.array(z.string().max(24)).min(2).max(6),
    }),
    execute: async ({ question, options }) => {
      ctx.emit({ type: "question", question, options });
      return "Asked. Wait for the user's answer.";
    },
  });

  const requestPurchase = tool({
    name: "request_purchase",
    description:
      "Prepare the purchase of one product the user chose. This does not pay: it opens an order the user must approve and sign on their phone. Only after the user clearly chose the product and size.",
    parameters: z.object({
      productId: z.string(),
      size: z.string().nullable(),
    }),
    execute: (input) =>
      step(ctx, "Preparing the order", async () => {
        if (!ctx.deliveryHash)
          throw new Error(
            "No delivery address is saved. Ask the user to add one in Settings first.",
          );
        const product =
          seen.get(input.productId) ??
          ((await getJson(
            ctx,
            `${ctx.shopUrl}/shop/catalog/${encodeURIComponent(input.productId)}`,
          )) as Product);
        if (product.sizes.length && !product.sizes.includes(input.size ?? ""))
          throw new Error(
            `Size ${input.size ?? "none"} is not available for ${product.name}.`,
          );
        const task = (await api(ctx, "/v1/tasks", {
          method: "POST",
          headers: { "idempotency-key": randomUUID() },
          body: JSON.stringify({
            walletId: ctx.walletId,
            runbookId: "commerce-buy",
            goal: `Buy ${product.name}${input.size ? `, size ${input.size}` : ""}`,
            input: {
              productId: product.productId,
              size: input.size,
              maxAmount: product.price,
              deliveryHash: ctx.deliveryHash,
              taskDeadline: String(Math.floor(Date.now() / 1000) + 3600),
            },
          }),
        })) as { taskId: string };
        ctx.emit({
          type: "purchase",
          taskId: task.taskId,
          product,
          size: input.size,
          amount: product.price,
        });
        return {
          value: `Order prepared for ${product.name} at ${usdc(product.price)} USDC. The user must now approve it on the sheet; nothing is paid until they do.`,
          detail: `${usdc(product.price)} USDC`,
        };
      }),
  });

  const startPageCheck = tool({
    name: "start_page_check",
    description:
      "Start a paid check of the demo checkout page (page loads, title, form submits). The user approves the spending on their phone.",
    parameters: z.object({
      page: z.enum(["healthy", "broken"]),
      formSubmit: z.boolean(),
    }),
    execute: (input) =>
      step(ctx, "Preparing the page check", async () => {
        const checkInput = {
          targetId: `checkout-${input.page}`,
          checks: input.formSubmit
            ? ["pageLoad", "title", "formSubmit"]
            : ["pageLoad", "title"],
          maxPaidAttempts: 3,
          maxSteps: 8,
          taskDeadline: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const label = `Check the ${input.page} checkout page`;
        const task = (await api(ctx, "/v1/tasks", {
          method: "POST",
          headers: { "idempotency-key": randomUUID() },
          body: JSON.stringify({
            walletId: ctx.walletId,
            runbookId: "browser-check",
            goal: label,
            input: checkInput,
          }),
        })) as { taskId: string };
        ctx.emit({
          type: "task",
          taskId: task.taskId,
          runbookId: "browser-check",
          label,
          input: checkInput,
        });
        return {
          value:
            "Page check prepared. The user must approve the spending on their phone.",
        };
      }),
  });

  const taskStatus = tool({
    name: "get_task_status",
    description: "Read where a task the user started stands.",
    parameters: z.object({ taskId: z.string().uuid() }),
    execute: (input) =>
      step(ctx, "Checking the order", async () => {
        const t = (await api(ctx, `/v1/tasks/${input.taskId}`)) as {
          outcomeState: string;
          authorityState: string;
          payments: { chainState: string; txHash: string | null }[];
        };
        return {
          value: JSON.stringify({
            outcome: t.outcomeState,
            permission: t.authorityState,
            payments: t.payments.map((p) => p.chainState),
          }),
        };
      }),
  });

  return [
    searchProducts,
    showProducts,
    askChoice,
    requestPurchase,
    startPageCheck,
    taskStatus,
  ];
}
