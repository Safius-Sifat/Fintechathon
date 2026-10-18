import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AuthChallengeRequestSchema,
  AuthRefreshRequestSchema,
  AuthVerifyRequestSchema,
  SessionRevokeRequestSchema,
  UuidSchema,
} from "@mandate/schema";
import type { AuthService } from "./service.js";
import { apiError, AuthError } from "./errors.js";

const emptyBody = z.object({}).strict();
function parse<T, I>(schema: z.ZodType<T, z.ZodTypeDef, I>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AuthError(422, "Request does not match the shared API schema.");
  return result.data;
}

export async function registerAuth(
  app: FastifyInstance,
  service: AuthService | null,
) {
  await app.register(async (auth) => {
    auth.addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      if (!service)
        return reply
          .code(503)
          .send(
            apiError(
              new AuthError(503, "Authentication backend is not configured."),
            ),
          );
      if (
        request.headers.origin &&
        request.headers.origin !== service.config.origin
      )
        return reply
          .code(401)
          .send(apiError(new AuthError(401, "Login origin is invalid.")));
    });
    auth.setErrorHandler((error, _request, reply) => {
      if (
        error instanceof Error &&
        "statusCode" in error &&
        error.statusCode === 415
      )
        return reply
          .code(415)
          .send(
            apiError(
              new AuthError(
                415,
                "Authentication requests require application/json.",
              ),
            ),
          );
      if (error instanceof AuthError)
        return reply.code(error.status).send(apiError(error));
      if (
        error instanceof Error &&
        "statusCode" in error &&
        error.statusCode === 413
      )
        return reply
          .code(413)
          .send(
            apiError(
              new AuthError(413, "Authentication request is too large."),
            ),
          );
      if (
        error instanceof Error &&
        "statusCode" in error &&
        error.statusCode === 400
      )
        return reply
          .code(422)
          .send(
            apiError(new AuthError(422, "Authentication request is invalid.")),
          );
      return reply
        .code(503)
        .send(
          apiError(new AuthError(503, "Authentication backend unavailable.")),
        );
    });
    const active = () => {
      if (!service)
        throw new AuthError(503, "Authentication backend is not configured.");
      return service;
    };
    auth.post("/v1/auth/challenge", { bodyLimit: 8192 }, async (request) => {
      const input = parse(AuthChallengeRequestSchema, request.body);
      const current = active();
      await current.limit(request.ip, input.ownerAddress);
      return current.challenge(input.ownerAddress, input.deviceId);
    });
    auth.post("/v1/auth/verify", { bodyLimit: 8192 }, async (request) => {
      const input = parse(AuthVerifyRequestSchema, request.body);
      const current = active();
      await current.limit(request.ip);
      return current.verify(input.challengeId, input.signature);
    });
    auth.post("/v1/auth/refresh", { bodyLimit: 8192 }, async (request) => {
      const input = parse(AuthRefreshRequestSchema, request.body);
      const current = active();
      await current.limit(request.ip);
      return current.refresh(input.sessionId, input.refreshToken);
    });
    auth.get("/v1/auth/sessions", async (request) => {
      const current = active();
      return current.sessions(
        await current.authenticate(request.headers.authorization),
      );
    });
    const mutation = async (
      request: FastifyRequest,
      _reply: FastifyReply,
      route: "/v1/auth/logout" | "/v1/auth/sessions/revoke",
    ) => {
      const current = active();
      const context = await current.authenticate(request.headers.authorization);
      const key = parse(UuidSchema, request.headers["idempotency-key"]);
      const body =
        route === "/v1/auth/logout"
          ? parse(emptyBody, request.body)
          : parse(SessionRevokeRequestSchema, request.body);
      if (
        "sessionIds" in body &&
        Array.isArray(body.sessionIds) &&
        body.sessionIds.length > 100
      )
        throw new AuthError(
          422,
          "At most 100 session IDs can be revoked per request.",
        );
      return current.mutate(context, route, key, body);
    };
    auth.post("/v1/auth/logout", { bodyLimit: 8192 }, (request, reply) =>
      mutation(request, reply, "/v1/auth/logout"),
    );
    auth.post(
      "/v1/auth/sessions/revoke",
      { bodyLimit: 8192 },
      (request, reply) => mutation(request, reply, "/v1/auth/sessions/revoke"),
    );
  });
}
