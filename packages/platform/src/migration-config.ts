import type { PoolConfig } from "pg";
import { readFile } from "node:fs/promises";

export type Environment = Record<string, string | undefined>;
export async function migrationPoolConfig(
  env: Environment,
): Promise<PoolConfig> {
  const production = env.APP_ENV === "production" || env.APP_ENV === "staging";
  if (
    env.APP_ENV &&
    !["development", "test", "staging", "production"].includes(env.APP_ENV)
  )
    throw new Error("APP_ENV is invalid");
  const url = env.MIGRATION_DATABASE_URL;
  if (production) {
    if (!url)
      throw new Error(
        "Production requires MIGRATION_DATABASE_URL, not a runtime connection",
      );
    if (!env.MIGRATION_CA_FILE)
      throw new Error("Production requires MIGRATION_CA_FILE");
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
      throw new Error("TLS verification cannot be disabled");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Migration connection URL is invalid");
    }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error("PostgreSQL URL required");
    if (
      [...parsed.searchParams.keys()].some((key) =>
        key.toLowerCase().startsWith("ssl"),
      )
    )
      throw new Error(
        "URL SSL options are forbidden; use the verified CA configuration",
      );
    if (
      !env.MIGRATION_EXPECTED_USER ||
      decodeURIComponent(parsed.username) !== env.MIGRATION_EXPECTED_USER
    )
      throw new Error("Migration role does not match MIGRATION_EXPECTED_USER");
    if (env.MIGRATION_EXPECTED_USER === "postgres")
      throw new Error("Production cannot use postgres administrator");
    return {
      connectionString: url,
      connectionTimeoutMillis: 5000,
      max: 1,
      ssl: {
        ca: await readFile(env.MIGRATION_CA_FILE, "utf8"),
        rejectUnauthorized: true,
      },
    };
  }
  if (url)
    return { connectionString: url, connectionTimeoutMillis: 5000, max: 1 };
  if (!env.POSTGRES_PASSWORD)
    throw new Error("Set a dedicated migration connection or run local setup");
  return {
    host: "127.0.0.1",
    port: 5432,
    user: env.POSTGRES_USER ?? "mandate",
    database: env.POSTGRES_DB ?? "mandate",
    password: env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 5000,
    max: 1,
  };
}
