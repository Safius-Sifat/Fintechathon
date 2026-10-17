import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverMigrations,
  assertAutomaticExpansion,
  sqlStatements,
} from "../src/migrations.js";

async function fixture(
  files: Record<string, string>,
  run: (directory: string) => Promise<void>,
  overrides?: unknown,
) {
  const dir = await mkdtemp(join(tmpdir(), "mandate-migration-"));
  try {
    for (const [name, sql] of Object.entries(files))
      await writeFile(join(dir, name), sql);
    const migrations = Object.fromEntries(
      Object.keys(files).map((name) => [
        name,
        { kind: "expand", transaction: "required" },
      ]),
    );
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify(overrides ?? { schemaVersion: 1, migrations }),
    );
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("OPS-MIG-01 discovers exact reviewed bytes and stable checksums", () =>
  fixture(
    { "0001_start.sql": "CREATE TABLE demo(id integer);\n" },
    async (dir) => {
      const a = await discoverMigrations(dir);
      const b = await discoverMigrations(dir);
      assert.equal(a.length, 1);
      assert.equal(a[0]?.version, 1);
      assert.match(a[0]!.sha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(a, b);
    },
  ));
test("OPS-MIG-02 manifest/files must match, with unique valid versions", async () => {
  await fixture(
    {
      "0001_a.sql": "CREATE TABLE a(id int);",
      "0001_b.sql": "CREATE TABLE b(id int);",
    },
    async (dir) => {
      await assert.rejects(discoverMigrations(dir), /unique/);
    },
  );
  await fixture({ "bad.sql": "CREATE TABLE a(id int);" }, async (dir) => {
    await assert.rejects(discoverMigrations(dir), /four-digit/);
  });
  await fixture(
    { "0001_a.sql": "CREATE TABLE a(id int);" },
    async (dir) => {
      await assert.rejects(discoverMigrations(dir), /match exactly/);
    },
    { schemaVersion: 1, migrations: {} },
  );
});
test("OPS-MIG-03 manual/destructive/nontransactional/procedural SQL cannot enter automatic lane", async () => {
  for (const sql of [
    "DROP TABLE x;",
    "TRUNCATE x;",
    "CREATE INDEX CONCURRENTLY i ON x(id);",
    "DO $$ BEGIN DROP TABLE x; END $$;",
    "BEGIN; CREATE TABLE x(id int); COMMIT;",
    "ALTER TABLE x DROP COLUMN id;",
    "ALTER TABLE x ADD COLUMN y int NOT NULL;",
  ])
    assert.throws(
      () => assertAutomaticExpansion(sql),
      /manual|outside automatic/,
    );
  await fixture(
    { "0001_a.sql": "CREATE TABLE a(id int);" },
    async (dir) => {
      await assert.rejects(discoverMigrations(dir), /Only reviewed/);
    },
    {
      schemaVersion: 1,
      migrations: {
        "0001_a.sql": { kind: "contract", transaction: "required" },
      },
    },
  );
});
test("OPS-MIG-04 quotes/comments cannot disguise a second destructive statement", () => {
  assertAutomaticExpansion(
    "-- DROP TABLE ignored\nCREATE TABLE x(id int, label text DEFAULT 'semi; DROP'); /* nested /* x */ comment */ INSERT INTO x VALUES(1,'ok');",
  );
  assert.throws(
    () =>
      assertAutomaticExpansion(
        "CREATE TABLE x(id int); /* comment */ DROP TABLE x;",
      ),
    /outside automatic/,
  );
  assert.throws(
    () => sqlStatements("CREATE TABLE x(label text DEFAULT 'unterminated)"),
    /Unterminated/,
  );
  assert.throws(() => sqlStatements("/* missing close"), /Unterminated/);
});
test("OPS-MIG-05 symlinked SQL is rejected", () =>
  fixture({ "0001_a.sql": "CREATE TABLE a(id int);" }, async (dir) => {
    await rm(join(dir, "0001_a.sql"));
    await writeFile(join(dir, "source.txt"), "CREATE TABLE a(id int);");
    await symlink(join(dir, "source.txt"), join(dir, "0001_a.sql"));
    await assert.rejects(discoverMigrations(dir), /regular file/);
  }));
