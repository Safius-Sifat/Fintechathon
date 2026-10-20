import { timingSafeEqual } from "node:crypto";
import { createFoundationApp } from "@mandate/platform";
import type { z } from "zod";
import {
  KeygenCheckRequestSchema,
  PolicyCheckRequestSchema,
  type PolicyService,
} from "./authorize.js";

// Private loopback service: callers authenticate with the internal service token,
// never with a public API bearer.
export function createPolicyServer(
  service: PolicyService,
  internalToken: string,
) {
  if (Buffer.byteLength(internalToken) < 32)
    throw new Error("Internal token must be at least 32 bytes");
  const app = createFoundationApp("policy", { logger: false });
  const expected = Buffer.from("Bearer " + internalToken);
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/internal/")) return;
    const given = Buffer.from(request.headers.authorization ?? "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      return reply.code(401).send({ code: "AUTH_SCOPE" });
  });
  const parse = <T>(schema: z.ZodType<T>, body: unknown) =>
    schema.safeParse(body);
  app.post(
    "/internal/policy/check",
    { bodyLimit: 16384 },
    async (request, reply) => {
      const input = parse(PolicyCheckRequestSchema, request.body);
      if (!input.success)
        return reply.code(422).send({ code: "INTENT_INVALID" });
      return service.check(input.data);
    },
  );
  app.post(
    "/internal/policy/keygen-check",
    { bodyLimit: 1024 },
    async (request, reply) => {
      const input = parse(KeygenCheckRequestSchema, request.body);
      if (!input.success)
        return reply.code(422).send({ code: "INTENT_INVALID" });
      return service.keygen(input.data.mpcWalletId);
    },
  );
  return app;
}
