import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  runMigrations,
  type Migration,
  type MigrationClient,
} from "../src/migrations.js";
const migration = (
  name = "0001_start.sql",
  sql = "CREATE TABLE demo(id integer);",
): Migration => ({
  name,
  sql,
  version: Number(name.slice(0, 4)),
  sha256: createHash("sha256").update(sql).digest("hex"),
});
function fake(
  options: {
    locked?: boolean;
    prior?: { name: string; sha256: string }[];
    failSql?: boolean;
    unlockFails?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const client = {
    query: async (text: string) => {
      calls.push(text);
      if (text.includes("pg_try_advisory_lock"))
        return { rows: [{ acquired: !options.locked }] };
      if (text.includes("pg_advisory_unlock")) {
        if (options.unlockFails) throw Error("network");
        return { rows: [{ released: true }] };
      }
      if (text.startsWith("SELECT name,sha256"))
        return { rows: options.prior ?? [] };
      if (text === migration().sql && options.failSql)
        throw Object.assign(Error("private sql detail"), { code: "42P07" });
      return { rows: [] };
    },
  };
  return { client: client as unknown as MigrationClient, calls };
}
test("OPS-RUN-01 apply records commit and releases an acquired lock", async () => {
  const f = fake();
  assert.deepEqual(await runMigrations(f.client, [migration()]), {
    applied: ["0001_start.sql"],
    alreadyApplied: [],
  });
  assert.ok(f.calls.includes("BEGIN"));
  assert.ok(f.calls.includes("COMMIT"));
  assert.ok(f.calls.at(-1)?.includes("pg_advisory_unlock"));
});
test("OPS-RUN-02 second application is a no-op", async () => {
  const m = migration(),
    f = fake({ prior: [{ name: m.name, sha256: m.sha256 }] });
  assert.deepEqual(await runMigrations(f.client, [m]), {
    applied: [],
    alreadyApplied: [m.name],
  });
  assert.equal(f.calls.includes("BEGIN"), false);
});
test("OPS-RUN-03 checksum/missing file stops before changes", async () => {
  const f = fake({ prior: [{ name: "0001_start.sql", sha256: "changed" }] });
  await assert.rejects(runMigrations(f.client, [migration()]), {
    code: "CHECKSUM_CHANGED",
  });
  assert.equal(f.calls.includes("BEGIN"), false);
  assert.ok(f.calls.at(-1)?.includes("unlock"));
});
test("OPS-RUN-04 failed SQL rolls back and does not record success", async () => {
  const f = fake({ failSql: true });
  await assert.rejects(runMigrations(f.client, [migration()]), {
    code: "SQL_FAILED",
  });
  assert.ok(f.calls.includes("ROLLBACK"));
  assert.equal(f.calls.includes("COMMIT"), false);
  assert.equal(
    f.calls.some((s) => s.startsWith("INSERT INTO")),
    false,
  );
});
test("OPS-RUN-05 bounded lock timeout never unlocks someone else's lock", async () => {
  const f = fake({ locked: true });
  await assert.rejects(
    runMigrations(f.client, [migration()], { lockTimeoutMs: 25, retryMs: 5 }),
    { code: "LOCK_TIMEOUT" },
  );
  assert.equal(
    f.calls.some((s) => s.includes("pg_advisory_unlock")),
    false,
  );
  assert.equal(f.calls.includes("BEGIN"), false);
});
test("OPS-RUN-06 cleanup failure cannot turn a failed run green", async () => {
  const f = fake({ unlockFails: true });
  await assert.rejects(runMigrations(f.client, [migration()]), {
    code: "UNLOCK_FAILED",
  });
  const both = fake({ failSql: true, unlockFails: true });
  await assert.rejects(
    runMigrations(both.client, [migration()]),
    (e) =>
      !!e &&
      typeof e === "object" &&
      "cleanupFailed" in e &&
      e.cleanupFailed === true,
  );
});
test("OPS-RUN-07 invalid schema/timeout and retroactive versions reject", async () => {
  const f = fake();
  await assert.rejects(
    runMigrations(f.client, [migration()], {
      schema: 'public";DROP SCHEMA x;--',
    }),
    { code: "INVALID_SCHEMA" },
  );
  await assert.rejects(
    runMigrations(f.client, [migration()], { lockTimeoutMs: Infinity }),
    { code: "INVALID_TIMEOUT" },
  );
  const first = migration(),
    second = migration("0002_next.sql", "CREATE TABLE next(id int);");
  const g = fake({ prior: [{ name: second.name, sha256: second.sha256 }] });
  await assert.rejects(runMigrations(g.client, [first, second]), {
    code: "OUT_OF_ORDER",
  });
});
