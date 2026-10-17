import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrationPoolConfig } from "../src/migration-config.js";

test("OPS-CFG-01 production rejects developer/runtime credentials", async () => {
  await assert.rejects(
    migrationPoolConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://app@db/x",
      POSTGRES_PASSWORD: "local-only-fixture",
    }),
    /MIGRATION_DATABASE_URL/,
  );
});
test("OPS-CFG-02 production cannot disable or override TLS", async () => {
  const base = {
    APP_ENV: "production",
    MIGRATION_DATABASE_URL: "postgresql://migrator@db/x",
    MIGRATION_CA_FILE: "/not-read",
    MIGRATION_EXPECTED_USER: "migrator",
  };
  await assert.rejects(
    migrationPoolConfig({ ...base, NODE_TLS_REJECT_UNAUTHORIZED: "0" }),
    /disabled/,
  );
  await assert.rejects(
    migrationPoolConfig({
      ...base,
      MIGRATION_DATABASE_URL: base.MIGRATION_DATABASE_URL + "?sslmode=disable",
    }),
    /SSL options/,
  );
});
test("OPS-CFG-03 role and CA are explicit, with verified TLS", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-ca-"));
  try {
    const ca = join(dir, "ca.pem");
    await writeFile(ca, "public-fixture-ca");
    const env = {
      APP_ENV: "production",
      MIGRATION_DATABASE_URL: "postgresql://migrator@db/x",
      MIGRATION_CA_FILE: ca,
      MIGRATION_EXPECTED_USER: "migrator",
    };
    const result = await migrationPoolConfig(env);
    assert.deepEqual(result.ssl, {
      ca: "public-fixture-ca",
      rejectUnauthorized: true,
    });
    await assert.rejects(
      migrationPoolConfig({ ...env, MIGRATION_EXPECTED_USER: "runtime" }),
      /does not match/,
    );
    await assert.rejects(
      migrationPoolConfig({
        ...env,
        MIGRATION_DATABASE_URL: "postgresql://postgres@db/x",
        MIGRATION_EXPECTED_USER: "postgres",
      }),
      /administrator/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("OPS-CFG-04 explicit test URL needs no production credentials", async () => {
  const c = await migrationPoolConfig({
    APP_ENV: "test",
    MIGRATION_DATABASE_URL: "postgresql://test@127.0.0.1/test",
  });
  assert.equal(c.ssl, undefined);
  assert.equal(c.max, 1);
  await assert.rejects(migrationPoolConfig({ APP_ENV: "prod" }), /APP_ENV/);
});
