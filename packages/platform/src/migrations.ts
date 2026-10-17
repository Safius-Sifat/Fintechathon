import { readdir, readFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { PoolClient } from "pg";

export class MigrationError extends Error {
  cleanupFailed = false;
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MigrationError";
  }
}
export type Migration = {
  name: string;
  version: number;
  sql: string;
  sha256: string;
};
export type MigrationClient = Pick<PoolClient, "query">;
const error = (code: string, message: string): never => {
  throw new MigrationError(code, message);
};
const identifier = /^[a-z_][a-z0-9_]{0,62}$/;

// Conservative release lint, not a SQL sandbox. Migrations remain privileged reviewed code.
export function sqlStatements(sql: string): string[][] {
  let i = 0;
  const statements: string[][] = [];
  let words: string[] = [];
  const push = () => {
    if (words.length) statements.push(words);
    words = [];
  };
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (/^\s/.test(rest)) {
      i++;
      continue;
    }
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) error("SQL_LEX", "Unterminated SQL comment");
      continue;
    }
    const quote = sql[i];
    if (quote === "'" || quote === '"') {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote && sql[i + 1] === quote) {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          i++;
          closed = true;
          break;
        }
        // E-string escapes are conservatively rejected rather than misclassified.
        if (quote === "'" && sql[i] === "\\")
          error(
            "SQL_LEX",
            "Escaped string syntax requires manual migration review",
          );
        i++;
      }
      if (!closed) error("SQL_LEX", "Unterminated SQL quote");
      words.push("QUOTED");
      continue;
    }
    const dollar = rest.match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end === -1) error("SQL_LEX", "Unterminated dollar string");
      words.push("QUOTED");
      i = end + dollar.length;
      continue;
    }
    if (quote === ";") {
      push();
      i++;
      continue;
    }
    const token = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (token) {
      words.push(token.toUpperCase());
      i += token.length;
      continue;
    }
    // Punctuation/numbers cannot start an allowed SQL command.
    if (!words.length) error("SQL_LEX", "Unexpected SQL statement prefix");
    i++;
  }
  push();
  return statements;
}

export function assertAutomaticExpansion(sql: string): void {
  const statements = sqlStatements(sql);
  if (!statements.length)
    error("EMPTY_MIGRATION", "Empty migration is not accepted");
  for (const words of statements) {
    const prefix = words.slice(0, 6).join(" ");
    if (words.includes("CONCURRENTLY") || words.includes("CASCADE"))
      error(
        "MANUAL_MIGRATION",
        "Concurrent or cascading DDL requires a reviewed manual operation",
      );
    const create =
      words[0] === "CREATE" &&
      (words[1] === "TABLE" ||
        words[1] === "INDEX" ||
        (words[1] === "UNIQUE" && words[2] === "INDEX"));
    const insert = words[0] === "INSERT" && words[1] === "INTO";
    const add =
      words[0] === "ALTER" &&
      words[1] === "TABLE" &&
      words.includes("ADD") &&
      words.includes("COLUMN") &&
      !["DROP", "RENAME", "TYPE", "NOT", "CONSTRAINT", "GENERATED"].some((w) =>
        words.includes(w),
      );
    if (!(create || insert || add))
      error(
        "MANUAL_MIGRATION",
        `Statement is outside automatic expansion policy: ${prefix}`,
      );
  }
}

export async function discoverMigrations(
  directory: string,
): Promise<Migration[]> {
  const entries = await readdir(directory);
  let raw: unknown;
  try {
    raw = JSON.parse(
      await readFile(resolve(directory, "manifest.json"), "utf8"),
    );
  } catch {
    return error(
      "MANIFEST_INVALID",
      "A valid migration manifest.json is required",
    );
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return error("MANIFEST_INVALID", "Invalid migration manifest");
  const data = raw as Record<string, unknown>;
  if (
    data.schemaVersion !== 1 ||
    Object.keys(data).some(
      (k) => !["schemaVersion", "migrations"].includes(k),
    ) ||
    !data.migrations ||
    typeof data.migrations !== "object" ||
    Array.isArray(data.migrations)
  )
    return error("MANIFEST_INVALID", "Unexpected migration manifest structure");
  const declarations = data.migrations as Record<string, unknown>;
  const names = entries.filter((name) => name.endsWith(".sql")).sort();
  if (!names.length)
    return error("NO_MIGRATIONS", "No SQL migrations discovered");
  if (Object.keys(declarations).sort().join("\n") !== names.join("\n"))
    return error(
      "MANIFEST_MISMATCH",
      "SQL files and reviewed manifest entries must match exactly",
    );
  const versions = new Set<number>();
  const migrations: Migration[] = [];
  for (const name of names) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      return error("INVALID_NAME", "Use four-digit numeric migration names");
    const version = Number(name.slice(0, 4));
    if (version === 0 || versions.has(version))
      return error(
        "DUPLICATE_VERSION",
        "Migration versions must be unique and positive",
      );
    versions.add(version);
    const info = await lstat(resolve(directory, name));
    if (!info.isFile() || info.isSymbolicLink())
      return error("INVALID_FILE", "Migration must be a regular file");
    const item = declarations[name];
    if (!item || typeof item !== "object" || Array.isArray(item))
      return error("MANIFEST_INVALID", "Invalid migration declaration");
    const declaration = item as Record<string, unknown>;
    if (
      Object.keys(declaration).sort().join() !== "kind,transaction" ||
      declaration.kind !== "expand" ||
      declaration.transaction !== "required"
    )
      return error(
        "MANUAL_MIGRATION",
        "Only reviewed transactional expand migrations run automatically",
      );
    const bytes = await readFile(resolve(directory, name));
    const sql = bytes.toString("utf8");
    assertAutomaticExpansion(sql);
    migrations.push({
      name,
      version,
      sql,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return migrations;
}

export async function runMigrations(
  client: MigrationClient,
  migrations: readonly Migration[],
  options: {
    schema?: string;
    lockTimeoutMs?: number;
    statementTimeoutMs?: number;
    retryMs?: number;
    production?: boolean;
  } = {},
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  const schema = options.schema ?? "public";
  if (!identifier.test(schema))
    return error("INVALID_SCHEMA", "Invalid migration schema identifier");
  const lockTimeout = options.lockTimeoutMs ?? 10000;
  const statementTimeout = options.statementTimeoutMs ?? 120000;
  if (
    ![lockTimeout, statementTimeout, options.retryMs ?? 100].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 600000,
    )
  )
    return error(
      "INVALID_TIMEOUT",
      "Migration timeouts must be bounded positive integers",
    );
  const ledger = `"${schema}"."schema_migrations"`;
  let acquired = false;
  let primary: unknown;
  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  try {
    await client.query(
      "SELECT pg_catalog.set_config('statement_timeout',$1,false), pg_catalog.set_config('lock_timeout',$2,false), pg_catalog.set_config('standard_conforming_strings','on',false)",
      [String(statementTimeout), String(lockTimeout)],
    );
    if (options.production) {
      const role = await client.query<{
        rolsuper: boolean;
        rolcreaterole: boolean;
      }>(
        "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname = current_user",
      );
      if (
        role.rows[0]?.rolsuper !== false ||
        role.rows[0]?.rolcreaterole !== false
      )
        return error(
          "UNSAFE_ROLE",
          "Production migrations require a dedicated non-administrator role",
        );
    }
    const deadline = Date.now() + lockTimeout;
    do {
      const lock = await client.query<{ acquired: boolean }>(
        "SELECT pg_catalog.pg_try_advisory_lock(84532) AS acquired",
      );
      acquired = lock.rows[0]?.acquired === true;
      if (acquired) break;
      if (Date.now() >= deadline)
        return error(
          "LOCK_TIMEOUT",
          "Another migration runner holds the database lock",
        );
      await new Promise((r) =>
        setTimeout(
          r,
          Math.min(options.retryMs ?? 100, Math.max(1, deadline - Date.now())),
        ),
      );
    } while (!acquired);
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${ledger} (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const prior = await client.query<{ name: string; sha256: string }>(
      `SELECT name,sha256 FROM ${ledger} ORDER BY name`,
    );
    const known = new Map(migrations.map((m) => [m.name, m]));
    for (const row of prior.rows) {
      const m = known.get(row.name);
      if (!m || m.sha256 !== row.sha256)
        return error(
          "CHECKSUM_CHANGED",
          "An applied migration is missing or its bytes changed",
        );
    }
    const priorNames = new Set(prior.rows.map((row) => row.name));
    const maxPrior = Math.max(
      0,
      ...prior.rows.map((row) => Number(row.name.slice(0, 4))),
    );
    for (const m of migrations) {
      if (priorNames.has(m.name)) {
        alreadyApplied.push(m.name);
        continue;
      }
      if (m.version < maxPrior)
        return error(
          "OUT_OF_ORDER",
          "Cannot insert a migration before the applied release",
        );
      await client.query("BEGIN");
      try {
        await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
        await client.query(m.sql);
        await client.query(`INSERT INTO ${ledger}(name,sha256) VALUES($1,$2)`, [
          m.name,
          m.sha256,
        ]);
        await client.query("COMMIT");
        applied.push(m.name);
      } catch (cause) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* Caller destroys this connection on failure. */
        }
        const pgCode =
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          typeof cause.code === "string" &&
          /^[A-Z0-9]{5}$/.test(cause.code)
            ? cause.code
            : "unknown";
        return error(
          "SQL_FAILED",
          `Migration ${m.name} rolled back (database code ${pgCode})`,
        );
      }
    }
    return { applied, alreadyApplied };
  } catch (cause) {
    primary = cause;
    throw cause;
  } finally {
    if (acquired) {
      try {
        const unlocked = await client.query<{ released: boolean }>(
          "SELECT pg_catalog.pg_advisory_unlock(84532) AS released",
        );
        if (unlocked.rows[0]?.released !== true)
          throw new Error("Lock release not confirmed");
      } catch {
        if (primary instanceof MigrationError) primary.cleanupFailed = true;
        else if (!primary)
          error(
            "UNLOCK_FAILED",
            "Migration connection must be discarded: lock release failed",
          );
      }
    }
  }
}
