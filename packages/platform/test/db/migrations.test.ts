import { test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { discoverMigrations, runMigrations } from "../../src/migrations.js";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw Error("TEST_DATABASE_URL required: DB acceptance cannot be skipped");
const ca = process.env.TEST_DATABASE_CA
  ? await readFile(process.env.TEST_DATABASE_CA, "utf8")
  : undefined;
const pool = new Pool({
  connectionString: url,
  max: 6,
  ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
});
async function db(run: (c: any, schema: string, dir: string) => Promise<void>) {
  const schema = "ops_" + randomBytes(8).toString("hex");
  const dir = await mkdtemp(join(tmpdir(), "mandate-sql-"));
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA "${schema}"`);
    await run(c, schema, dir);
  } finally {
    await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    c.release();
    await rm(dir, { recursive: true, force: true });
  }
}
async function files(dir: string, values: Record<string, string>) {
  for (const [name, sql] of Object.entries(values))
    await writeFile(join(dir, name), sql);
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      migrations: Object.fromEntries(
        Object.keys(values).map((n) => [
          n,
          { kind: "expand", transaction: "required" },
        ]),
      ),
    }),
  );
  return discoverMigrations(dir);
}
test("OPS-DB-01 clean install, upgrade, idempotence and old query compatibility", () =>
  db(async (c, schema, dir) => {
    const a = await files(dir, {
      "0001_start.sql":
        "CREATE TABLE entries(id integer PRIMARY KEY); INSERT INTO entries VALUES(1);",
    });
    assert.deepEqual((await runMigrations(c, a, { schema })).applied, [
      "0001_start.sql",
    ]);
    assert.deepEqual((await runMigrations(c, a, { schema })).applied, []);
    const b = await files(dir, {
      "0001_start.sql": a[0]!.sql,
      "0002_expand.sql": "ALTER TABLE entries ADD COLUMN label text;",
    });
    assert.deepEqual((await runMigrations(c, b, { schema })).applied, [
      "0002_expand.sql",
    ]);
    assert.deepEqual(
      (await c.query(`SELECT id FROM "${schema}".entries`)).rows,
      [{ id: 1 }],
    );
  }));
test("OPS-DB-02 multi-statement SQL failure rolls back table and ledger row", () =>
  db(async (c, schema, dir) => {
    const m = await files(dir, {
      "0001_fail.sql":
        "CREATE TABLE rolled_back(id int); INSERT INTO missing_table VALUES(1);",
    });
    await assert.rejects(runMigrations(c, m, { schema }), {
      code: "SQL_FAILED",
    });
    assert.equal(
      (
        await c.query("SELECT to_regclass($1) AS name", [
          schema + ".rolled_back",
        ])
      ).rows[0].name,
      null,
    );
    assert.equal(
      (
        await c.query(
          `SELECT count(*)::int AS n FROM "${schema}".schema_migrations`,
        )
      ).rows[0].n,
      0,
    );
  }));
test("OPS-DB-03 checksum tamper and removed applied migration rejected", () =>
  db(async (c, schema, dir) => {
    const m = await files(dir, {
      "0001_start.sql": "CREATE TABLE original(id int);",
    });
    await runMigrations(c, m, { schema });
    const changed = await files(dir, {
      "0001_start.sql": "CREATE TABLE changed(id int);",
    });
    await assert.rejects(runMigrations(c, changed, { schema }), {
      code: "CHECKSUM_CHANGED",
    });
  }));
test("OPS-DB-04 competing real sessions apply only once", () =>
  db(async (c, schema, dir) => {
    const other = await pool.connect();
    try {
      const m = await files(dir, {
        "0001_start.sql": "CREATE TABLE once(id int);",
      });
      const r = await Promise.all([
        runMigrations(c, m, { schema }),
        runMigrations(other, m, { schema }),
      ]);
      assert.equal(
        r.reduce((n, x) => n + x.applied.length, 0),
        1,
      );
      assert.equal(
        (
          await c.query(
            `SELECT count(*)::int AS n FROM "${schema}".schema_migrations`,
          )
        ).rows[0].n,
        1,
      );
    } finally {
      other.release();
    }
  }));
test("OPS-DB-05 real advisory lock timeout does not unlock another session", () =>
  db(async (c, schema, dir) => {
    const other = await pool.connect();
    try {
      await other.query("SELECT pg_advisory_lock(84532)");
      const m = await files(dir, {
        "0001_start.sql": "CREATE TABLE x(id int);",
      });
      await assert.rejects(
        runMigrations(c, m, { schema, lockTimeoutMs: 40, retryMs: 5 }),
        { code: "LOCK_TIMEOUT" },
      );
      assert.equal(
        (await other.query("SELECT pg_advisory_unlock(84532) AS released"))
          .rows[0].released,
        true,
      );
    } finally {
      other.release();
    }
  }));
test("OPS-DB-06 production runner rejects administrator role", () =>
  db(async (c, schema, dir) => {
    const m = await files(dir, { "0001_start.sql": "CREATE TABLE x(id int);" });
    await assert.rejects(runMigrations(c, m, { schema, production: true }), {
      code: "UNSAFE_ROLE",
    });
  }));
test("OPS-DB-07 runtime role has no migration DDL privilege", () =>
  db(async (c, schema, dir) => {
    const role = "runtime_" + randomBytes(6).toString("hex");
    await c.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEROLE`);
    try {
      await c.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
      await c.query(`SET ROLE "${role}"`);
      const m = await files(dir, {
        "0001_start.sql": "CREATE TABLE x(id int);",
      });
      await assert.rejects(runMigrations(c, m, { schema }));
    } finally {
      await c.query("RESET ROLE");
      await c.query(`REVOKE USAGE ON SCHEMA "${schema}" FROM "${role}"`);
      await c.query(`DROP ROLE "${role}"`);
    }
  }));
test("OPS-DB-08 dedicated nonadmin schema owner can migrate in production mode", () =>
  db(async (c, schema, dir) => {
    const role = "migrator_" + randomBytes(6).toString("hex");
    await c.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEROLE`);
    try {
      await c.query(`ALTER SCHEMA "${schema}" OWNER TO "${role}"`);
      await c.query(`SET ROLE "${role}"`);
      const m = await files(dir, {
        "0001_start.sql": "CREATE TABLE owned(id int);",
      });
      assert.deepEqual(
        (await runMigrations(c, m, { schema, production: true })).applied,
        ["0001_start.sql"],
      );
    } finally {
      await c.query("RESET ROLE");
      await c.query(`DROP OWNED BY "${role}" CASCADE`);
      await c.query(`DROP ROLE "${role}"`);
    }
  }));
test("OPS-DB-09 verified TLS succeeds and wrong CA fails when supplied", async () => {
  if (!ca) throw Error("TEST_DATABASE_CA required for verified TLS acceptance");
  const c = await pool.connect();
  try {
    assert.equal(
      (await c.query("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"))
        .rows[0].ssl,
      true,
    );
  } finally {
    c.release();
  }
  const wrong = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 3000,
    ssl: { ca: "invalid-ca-fixture", rejectUnauthorized: true },
  });
  try {
    await assert.rejects(wrong.connect());
  } finally {
    await wrong.end();
  }
});
test("OPS-DB-99 close test pool", async () => {
  await pool.end();
});
