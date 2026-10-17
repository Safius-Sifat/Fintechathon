import Fastify from "fastify";
import { Pool } from "pg";
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
  let database: Pool | null = null;
  if (service === "api" && process.env.DATABASE_URL) {
    let url: URL;
    try {
      url = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error("Runtime database URL is invalid");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.username !== "mandate_runtime" ||
      [...url.searchParams.keys()].some((key) =>
        key.toLowerCase().startsWith("ssl"),
      ) ||
      !process.env.DATABASE_CA_FILE
    ) {
      throw new Error(
        "Runtime database configuration must use the runtime role and verified TLS",
      );
    }
    database = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      ssl: {
        ca: await readFile(process.env.DATABASE_CA_FILE, "utf8"),
        rejectUnauthorized: true,
      },
    });
    database.on("error", () =>
      app.log.error("Runtime database connection failed"),
    );
    app.addHook("onClose", async () => {
      await database?.end();
    });
  }
  app.get("/health/db", async (_request, reply) => {
    if (!database)
      return reply.code(503).send({ status: "database-not-configured" });
    try {
      const result = await database.query(
        "SELECT current_user AS role, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
      );
      if (
        result.rows[0]?.role !== "mandate_runtime" ||
        result.rows[0]?.ssl !== true
      )
        throw new Error("Runtime database boundary invalid");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "database-unavailable" });
    }
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
