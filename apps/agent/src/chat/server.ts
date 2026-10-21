import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { reply, type HistoryItem } from "./chat.js";
import type { ChatEvent } from "./events.js";

const ReplyRequestSchema = z
  .object({
    conversationId: z.string().uuid(),
    walletId: z.string().uuid(),
    token: z.string().regex(/^mat_[A-Za-z0-9_-]{43}$/),
    deliveryHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .nullable(),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();

export interface ChatServerConfig {
  // Shared secret the Mandate API presents; only the API may ask for replies.
  serviceToken: string;
  apiUrl: string;
  shopUrl: string;
  model?: string | undefined;
  // Replaces the model call in tests.
  reply?: typeof reply;
}

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// POST /v1/reply streams one agent reply as newline-delimited JSON events.
export function chatServer(config: ChatServerConfig): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  const answer = config.reply ?? reply;
  app.get("/healthz", async () => ({ ok: true }));
  app.post("/v1/reply", async (request, res) => {
    const auth = request.headers.authorization ?? "";
    if (!sameSecret(auth, `Bearer ${config.serviceToken}`))
      return res.code(401).send({ error: "Service credential required" });
    const parsed = ReplyRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return res.code(400).send({ error: parsed.error.message });
    const body = parsed.data;
    const abort = new AbortController();
    request.raw.on("close", () => abort.abort());
    res.hijack();
    res.raw.writeHead(200, {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    });
    const emit = (event: ChatEvent) => {
      if (!res.raw.writableEnded) res.raw.write(JSON.stringify(event) + "\n");
    };
    try {
      await answer(
        {
          apiUrl: config.apiUrl,
          shopUrl: config.shopUrl,
          token: body.token,
          walletId: body.walletId,
          deliveryHash: body.deliveryHash,
        },
        body.history as HistoryItem[],
        emit,
        { model: config.model, signal: abort.signal },
      );
    } catch (error) {
      emit({
        type: "error",
        message:
          error instanceof Error &&
          /api key|401|Incorrect API/i.test(error.message)
            ? "The agent's model is not configured."
            : "The agent could not finish this reply. Try again.",
      });
    } finally {
      res.raw.end();
    }
  });
  return app;
}
