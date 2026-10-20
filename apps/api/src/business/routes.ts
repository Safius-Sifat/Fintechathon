import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { CreateTaskRequestSchema, UuidSchema } from "@mandate/schema";
import { apiError, AuthError } from "../auth/errors.js";
import type { BusinessService } from "./service.js";

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
    // Task interpretation belongs to Person4's runbook package, which is not yet
    // implemented; tasks are never created from an uninterpreted goal.
    routes.post("/v1/tasks", { bodyLimit: 65536 }, async (request) => {
      await principal(request);
      idempotencyKey(request);
      parse(CreateTaskRequestSchema, request.body);
      throw new AuthError(
        503,
        "Runbook preparation dependency (@mandate/runbooks prepareTask) is unavailable.",
        "RUNBOOK_VERSION",
      );
    });
  });
}
