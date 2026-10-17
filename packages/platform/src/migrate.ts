import { Pool } from "pg";
import { resolve } from "node:path";
import { migrationPoolConfig } from "./migration-config.js";
import {
  discoverMigrations,
  runMigrations,
  MigrationError,
} from "./migrations.js";

async function main() {
  if (
    !process.env.APP_ENV ||
    ["development", "test"].includes(process.env.APP_ENV)
  ) {
    const { config } = await import("dotenv");
    config({
      path: resolve(import.meta.dirname, "../../../.env"),
      quiet: true,
    });
  }
  const config = await migrationPoolConfig(process.env);
  const migrations = await discoverMigrations(
    process.env.MIGRATIONS_DIR ??
      resolve(import.meta.dirname, "../../../apps/api/migrations"),
  );
  const pool = new Pool(config);
  let client;
  let failed = false;
  try {
    client = await pool.connect();
    const result = await runMigrations(client, migrations, {
      schema: process.env.MIGRATION_SCHEMA ?? "public",
      lockTimeoutMs: Number(process.env.MIGRATION_LOCK_TIMEOUT_MS ?? 10000),
      statementTimeoutMs: Number(
        process.env.MIGRATION_STATEMENT_TIMEOUT_MS ?? 120000,
      ),
      production: ["production", "staging"].includes(process.env.APP_ENV ?? ""),
    });
    console.log(JSON.stringify({ status: "migrated", ...result }));
  } catch (cause) {
    failed = true;
    throw cause;
  } finally {
    client?.release(failed);
    await pool.end();
  }
}
main().catch((cause: unknown) => {
  // Never print connection strings, SQL text, environment or raw driver error objects.
  console.error(
    JSON.stringify({
      status: "failed",
      code:
        cause instanceof MigrationError ? cause.code : "MIGRATION_SETUP_FAILED",
      message:
        cause instanceof MigrationError
          ? cause.message
          : "Migration setup/connection failed; check private configuration",
    }),
  );
  process.exitCode = 1;
});
