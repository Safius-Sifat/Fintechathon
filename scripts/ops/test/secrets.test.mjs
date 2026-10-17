import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializeSecrets, validateSecretMap } from "../secrets.mjs";
const entry = {
  file: "jwt.key",
  secretId: "https://mandate-app.vault.azure.net/secrets/jwt/" + "a".repeat(32),
};
const map = { schemaVersion: 1, entries: [entry] };
test("OPS-SEC-01 exact-version secrets and bounded filenames required", () => {
  assert.throws(
    () =>
      validateSecretMap({
        ...map,
        entries: [{ ...entry, file: "../outside" }],
      }),
    /TARGET/,
  );
  assert.throws(
    () =>
      validateSecretMap({
        ...map,
        entries: [{ ...entry, secretId: entry.secretId.slice(0, -33) }],
      }),
    /VERSIONED/,
  );
  assert.throws(
    () => validateSecretMap({ ...map, entries: [entry, entry] }),
    /TARGET/,
  );
});
test("OPS-SEC-02 stores private files without returning values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-secrets-"));
  try {
    const result = await materializeSecrets(map, {
      directory: dir,
      readSecret: async () => "test-only-private-value",
    });
    assert.deepEqual(result, { files: ["jwt.key"], count: 1 });
    assert.equal((await stat(join(dir, "jwt.key"))).mode & 0o777, 0o600);
    assert.equal(
      await readFile(join(dir, "jwt.key"), "utf8"),
      "test-only-private-value",
    );
    assert.equal(JSON.stringify(result).includes("private-value"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("OPS-SEC-03 symlinks cannot redirect secret writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-secrets-"));
  try {
    const actual = join(dir, "actual");
    await mkdir(actual);
    await symlink(actual, join(dir, "link"));
    await assert.rejects(
      materializeSecrets(map, {
        directory: join(dir, "link"),
        readSecret: async () => "fixture",
      }),
      /SYMLINK/,
    );
    await symlink(join(dir, "outside"), join(actual, "jwt.key"));
    await assert.rejects(
      materializeSecrets(map, {
        directory: actual,
        readSecret: async () => "fixture",
      }),
      /REGULAR/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("OPS-SEC-04 failed retrieval does not overwrite existing secret", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-secrets-"));
  try {
    await materializeSecrets(map, {
      directory: dir,
      readSecret: async () => "old-fixture",
    });
    await assert.rejects(
      materializeSecrets(map, {
        directory: dir,
        readSecret: async () => {
          throw Error("RBAC_DENIED");
        },
      }),
      /RBAC/,
    );
    assert.equal(await readFile(join(dir, "jwt.key"), "utf8"), "old-fixture");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import { assertPublicCertificates } from "../secrets.mjs";
import { execFileSync } from "node:child_process";
test("public CA permission exception accepts genuine certificates only", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-ca-validation-"));
  try {
    const cert = join(dir, "ca.crt");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=unit-test-only",
        "-keyout",
        join(dir, "fixture.key"),
        "-out",
        cert,
      ],
      { stdio: "pipe" },
    );
    const value = await readFile(cert, "utf8");
    assert.equal(assertPublicCertificates(value), value);
    assert.throws(
      () => assertPublicCertificates(value + "not-certificate-data"),
      /REQUIRED/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("secret text or malformed PEM can never be made a public CA file", () => {
  assert.throws(
    () => assertPublicCertificates("test-only-sensitive-text"),
    /REQUIRED/,
  );
  assert.throws(
    () =>
      assertPublicCertificates(
        "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
      ),
    /INVALID/,
  );
  assert.throws(
    () => assertPublicCertificates("-----BEGIN " + "PRIVATE KEY-----"),
    /REQUIRED/,
  );
});
