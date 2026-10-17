import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { resolve } from "node:path";
if (
  !process.env.APP_ENV ||
  ["development", "test"].includes(process.env.APP_ENV)
) {
  config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
}
export async function startFoundationService(
  service: "api" | "provider" | "policy",
  fallbackPort: number,
) {
  const app = Fastify({
    logger: {
      level: "info",
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
  });
  const manifestPath = process.env.DEPLOYMENT_MANIFEST_FILE;
  // Load once: this process cannot silently switch contracts during a release.
  const deployment = manifestPath
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : null;
  app.get("/deployment.json", async (_request, reply) => {
    if (!deployment)
      return reply.code(503).send({ code: "DEPLOYMENT_NOT_CONFIGURED" });
    return reply.header("Cache-Control", "no-store").send(deployment);
  });
  app.get("/healthz", async () => ({
    service,
    status: "ok",
    stage: "bootstrap",
    revision: process.env.SOURCE_REVISION ?? null,
    chainId: 84532,
  }));
  app.get("/readyz", async (_request, reply) =>
    reply.code(503).send({
      service,
      ready: false,
      reason:
        "Financial implementation and qualification gates are incomplete; see docs/plans.",
    }),
  );
  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(501).send({
      code: "NOT_IMPLEMENTED",
      message: `${service}: requested capability is not implemented in the bootstrap.`,
      retryable: false,
    }),
  );
  const prefix = service.toUpperCase();
  const host = process.env[prefix + "_HOST"] ?? "127.0.0.1";
  const port = Number(process.env[prefix + "_PORT"] ?? fallbackPort);
  await app.listen({ host, port });
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.once(sig, () => void app.close());
}
