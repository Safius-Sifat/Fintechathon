import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { UuidSchema } from "@mandate/schema";
import { apiError, AuthError } from "../auth/errors.js";
import type { BusinessService } from "./service.js";
import type { AgenticService } from "./agentic.js";
import type { ControlService } from "./controls.js";
import type { TaskService } from "./tasks.js";
import type {
  ConversationService,
  ConversationUpdate,
  StoredEvent,
} from "./conversations.js";

const emptyBody = z.object({}).strict();
const idParam = z.object({}).catchall(UuidSchema);

function parse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AuthError(
      422,
      "Request does not match the shared API schema.",
      "INTENT_INVALID",
    );
  return result.data;
}
const idempotencyKey = (request: FastifyRequest) =>
  parse(UuidSchema, request.headers["idempotency-key"]);

export async function registerBusiness(
  app: FastifyInstance,
  service: BusinessService | null,
  agentic: AgenticService | null,
  controls: ControlService | null,
  tasks: TaskService | null,
  conversations: ConversationService | null = null,
) {
  await app.register(async (routes) => {
    routes.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      if (!service)
        return reply
          .code(503)
          .send(
            apiError(
              new AuthError(
                503,
                "Financial backend is not configured.",
                "NOT_IMPLEMENTED",
              ),
            ),
          );
    });
    routes.setErrorHandler((error, _request, reply) => {
      let failure: AuthError;
      if (error instanceof AuthError) failure = error;
      else if (error instanceof ZodError)
        failure = new AuthError(
          422,
          "Request does not match the shared API schema.",
          "INTENT_INVALID",
        );
      else {
        const status =
          error instanceof Error && "statusCode" in error
            ? error.statusCode
            : undefined;
        failure =
          status === 415 || status === 413 || status === 400
            ? new AuthError(422, "Request body is invalid.", "INTENT_INVALID")
            : new AuthError(
                503,
                "Financial backend unavailable.",
                "NOT_IMPLEMENTED",
              );
      }
      return reply.code(failure.status).send(apiError(failure));
    });
    const active = () => service!;
    const principal = (request: FastifyRequest) =>
      active().principal(request.headers.authorization);

    routes.post("/v1/wallets", { bodyLimit: 1024 }, async (request) => {
      parse(emptyBody, request.body);
      const key = idempotencyKey(request);
      return active().createWallet(await principal(request), key);
    });
    routes.get("/v1/wallets/:walletId", async (request) => {
      const { walletId } = parse(idParam, request.params);
      return active().wallet(await principal(request), walletId!);
    });
    routes.post("/v1/agent-tokens", { bodyLimit: 4096 }, async (request) => {
      const key = idempotencyKey(request);
      return active().createAgentToken(
        await principal(request),
        key,
        request.body,
      );
    });
    routes.delete("/v1/agent-tokens/:tokenId", async (request) => {
      const { tokenId } = parse(idParam, request.params);
      const key = idempotencyKey(request);
      return active().revokeAgentToken(await principal(request), key, tokenId!);
    });
    routes.get("/v1/tasks/:taskId", async (request) => {
      const { taskId } = parse(idParam, request.params);
      return active().task(await principal(request), taskId!);
    });
    routes.get("/v1/tasks/:taskId/evidence", async (request, reply) => {
      const { taskId } = parse(idParam, request.params);
      const { zip } = await active().evidence(
        await principal(request),
        taskId!,
      );
      return reply
        .header("Content-Type", "application/zip")
        .header(
          "Content-Disposition",
          `attachment; filename="evidence-${taskId}.zip"`,
        )
        .send(zip);
    });
    routes.get("/v1/accounts/:ownerAddress/activity", async (request) => {
      const { cursor } = parse(
        z.object({ cursor: z.string().max(512).optional() }).strict(),
        request.query,
      );
      const { ownerAddress } = request.params as { ownerAddress: string };
      return active().activity(await principal(request), ownerAddress, cursor);
    });
    routes.post(
      "/v1/accounts/:ownerAddress/transactions",
      { bodyLimit: 1024 },
      async (request) => {
        const { ownerAddress } = request.params as { ownerAddress: string };
        return active().registerTransaction(
          await principal(request),
          ownerAddress,
          request.body,
        );
      },
    );
    routes.post(
      "/v1/wallets/:walletId/owner-transfers/draft",
      { bodyLimit: 2048 },
      async (request) => {
        const { walletId } = parse(idParam, request.params);
        idempotencyKey(request);
        return active().ownerTransferDraft(
          await principal(request),
          walletId!,
          request.body,
        );
      },
    );
    routes.post(
      "/v1/wallets/:walletId/owner-transfers/submit",
      { bodyLimit: 2048 },
      async (request) => {
        const { walletId } = parse(idParam, request.params);
        idempotencyKey(request);
        return active().ownerTransferSubmit(
          await principal(request),
          walletId!,
          request.body,
        );
      },
    );
    routes.get("/v1/tasks/:taskId/questions/next", async (request) => {
      const { taskId } = parse(idParam, request.params);
      return agentic!.next(await principal(request), taskId!);
    });
    routes.post(
      "/v1/questions/:questionId/answer",
      { bodyLimit: 8192 },
      async (request) => {
        const { questionId } = parse(idParam, request.params);
        const identity = request.headers["x-mandate-agent"];
        return agentic!.answer(
          await principal(request),
          questionId!,
          request.body,
          typeof identity === "string" ? identity : undefined,
        );
      },
    );
    routes.post("/v1/intents/compile", { bodyLimit: 8192 }, async (request) => {
      idempotencyKey(request);
      return agentic!.compile(await principal(request), request.body);
    });
    const c = () => controls!;
    routes.get("/v1/approvals", async (request) =>
      c().approvals(await principal(request)),
    );
    routes.get("/v1/approvals/:approvalId", async (request) => {
      const { approvalId } = parse(idParam, request.params);
      return c().approval(await principal(request), approvalId!);
    });
    for (const [verb, approve] of [
      ["sign", true],
      ["reject", false],
    ] as const)
      routes.post(
        `/v1/approvals/:approvalId/${verb}`,
        { bodyLimit: 2048 },
        async (request) => {
          const { approvalId } = parse(idParam, request.params);
          idempotencyKey(request);
          return c().decide(
            await principal(request),
            approvalId!,
            request.body,
            approve,
          );
        },
      );
    routes.post(
      "/v1/wallets/:walletId/policy/draft",
      { bodyLimit: 65536 },
      async (request) => {
        const { walletId } = parse(idParam, request.params);
        idempotencyKey(request);
        return c().policyDraft(
          await principal(request),
          walletId!,
          request.body,
        );
      },
    );
    routes.post(
      "/v1/wallets/:walletId/admin/draft",
      { bodyLimit: 2048 },
      async (request) => {
        const { walletId } = parse(idParam, request.params);
        idempotencyKey(request);
        return c().adminDraft(
          await principal(request),
          walletId!,
          request.body,
        );
      },
    );
    for (const [path, kind] of [
      ["policy", "POLICY"],
      ["admin", "ADMIN"],
    ] as const)
      routes.post(
        `/v1/wallets/:walletId/${path}/submit`,
        { bodyLimit: 2048 },
        async (request) => {
          const { walletId } = parse(idParam, request.params);
          idempotencyKey(request);
          return c().submitCommand(
            await principal(request),
            walletId!,
            kind,
            request.body,
          );
        },
      );
    routes.post("/v1/devices/push", { bodyLimit: 8192 }, async (request) => {
      idempotencyKey(request);
      return c().registerPush(await principal(request), request.body);
    });
    routes.post(
      "/v1/wallets/:walletId/inhibit/clear",
      { bodyLimit: 1024 },
      async (request) => {
        const { walletId } = parse(idParam, request.params);
        idempotencyKey(request);
        return c().clearInhibit(
          await principal(request),
          walletId!,
          request.body,
        );
      },
    );
    const t = () => tasks!;
    routes.post("/v1/tasks", { bodyLimit: 65536 }, async (request) => {
      const key = idempotencyKey(request);
      const who = await principal(request);
      return active().task(who, await t().create(who, key, request.body));
    });
    routes.post(
      "/v1/tasks/:taskId/run",
      { bodyLimit: 1024 },
      async (request) => {
        const { taskId } = parse(idParam, request.params);
        parse(emptyBody, request.body);
        idempotencyKey(request);
        const who = await principal(request);
        return active().task(who, await t().run(who, taskId!));
      },
    );
    routes.post("/v1/permits/draft", { bodyLimit: 16384 }, async (request) => {
      idempotencyKey(request);
      return t().draft(await principal(request), request.body);
    });
    routes.post(
      "/v1/permits/activate",
      { bodyLimit: 4096 },
      async (request) => {
        idempotencyKey(request);
        return t().activate(await principal(request), request.body);
      },
    );

    // Agent conversations (plan 05). Owner sessions only.
    const chats = () => {
      if (!conversations)
        throw new AuthError(
          503,
          "Conversations are not configured.",
          "NOT_IMPLEMENTED",
        );
      return conversations;
    };
    const chatParam = z.object({ conversationId: UuidSchema }).strict();
    const afterQuery = z
      .object({
        after: z
          .string()
          .regex(/^[0-9]{1,12}$/)
          .optional(),
      })
      .strict();
    routes.get("/v1/conversations", async (request) =>
      chats().list(await principal(request)),
    );
    routes.post("/v1/conversations", { bodyLimit: 1024 }, async (request) =>
      chats().create(await principal(request), request.body),
    );
    routes.patch(
      "/v1/conversations/:conversationId",
      { bodyLimit: 1024 },
      async (request) => {
        const { conversationId } = parse(chatParam, request.params);
        return chats().patch(
          await principal(request),
          conversationId,
          request.body,
        );
      },
    );
    routes.delete("/v1/conversations/:conversationId", async (request) => {
      const { conversationId } = parse(chatParam, request.params);
      return chats().hide(await principal(request), conversationId);
    });
    routes.get("/v1/conversations/:conversationId/events", async (request) => {
      const { conversationId } = parse(chatParam, request.params);
      const { after } = parse(afterQuery, request.query);
      return {
        events: await chats().events(
          await principal(request),
          conversationId,
          Number(after ?? 0),
        ),
      };
    });
    routes.post(
      "/v1/conversations/:conversationId/messages",
      { bodyLimit: 8192 },
      async (request) => {
        const { conversationId } = parse(chatParam, request.params);
        return chats().post(
          await principal(request),
          conversationId,
          request.body,
        );
      },
    );
    // Server-Sent Events: stored events after `after`, then live ones
    // (including text as the agent writes it) until the client leaves.
    routes.get(
      "/v1/conversations/:conversationId/stream",
      async (request, reply) => {
        const { conversationId } = parse(chatParam, request.params);
        const { after } = parse(afterQuery, request.query);
        const who = await principal(request);
        // Subscribed before reading the backlog so nothing appended in between
        // is missed; stored events are deduplicated by seq.
        const early: ConversationUpdate[] = [];
        let deliver = (event: ConversationUpdate): unknown => early.push(event);
        const unsubscribe = chats().subscribe(conversationId, (event) =>
          deliver(event),
        );
        let backlog: StoredEvent[];
        try {
          backlog = await chats().events(
            who,
            conversationId,
            Number(after ?? 0),
          );
        } catch (error) {
          unsubscribe();
          throw error;
        }
        reply.hijack();
        const out = reply.raw;
        out.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
        });
        const send = (event: unknown, id?: number) =>
          out.write(
            `${id !== undefined && id > 0 ? `id: ${id}\n` : ""}data: ${JSON.stringify(event)}\n\n`,
          );
        let last = Number(after ?? 0);
        for (const e of backlog) {
          send(e, e.seq);
          last = e.seq;
        }
        deliver = (event) => {
          if ("live" in event) return send({ live: event.live });
          if (event.seq > 0 && event.seq <= last) return;
          if (event.seq > 0) last = event.seq;
          send(event, event.seq);
        };
        for (const event of early) deliver(event);
        const heartbeat = setInterval(() => out.write(": ping\n\n"), 15_000);
        request.raw.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
      },
    );
  });
}
