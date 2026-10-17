import { test } from "node:test";
import assert from "node:assert/strict";
import { managedToken } from "../vm-identity.mjs";
import { commandSucceeded } from "../run-command-result.mjs";
test("Azure Run Command guest sentinel required even when provisioning succeeds", () => {
  const sha = "a".repeat(40);
  assert.equal(
    commandSucceeded(
      {
        value: [
          {
            code: "ProvisioningState/succeeded",
            message:
              "Enable succeeded: \n[stdout]\nMANDATE_DEPLOY_OK " +
              sha +
              "\n\n[stderr]\n",
          },
        ],
      },
      sha,
    ),
    true,
  );
  assert.equal(
    commandSucceeded(
      {
        value: [
          { code: "ProvisioningState/succeeded", message: "Script failed" },
        ],
      },
      sha,
    ),
    false,
  );
  assert.equal(
    commandSucceeded(
      { value: [{ message: "MANDATE_DEPLOY_OK " + sha }] },
      "b".repeat(40),
    ),
    false,
  );
});
test("VM token helper uses IMDS metadata header and bounded allowed audience", async () => {
  let called = false;
  const token = await managedToken(
    "https://vault.azure.net",
    async (url, options) => {
      called = true;
      assert.ok(
        url.startsWith(
          "http://169.254.169.254/metadata/identity/oauth2/token?",
        ),
      );
      assert.equal(options.headers.Metadata, "true");
      assert.equal(options.redirect, "error");
      return {
        ok: true,
        json: async () => ({ access_token: "test-only-token" }),
      };
    },
  );
  assert.equal(token, "test-only-token");
  assert.equal(called, true);
  await assert.rejects(
    managedToken("https://untrusted.example", async () => {
      throw Error("must not run");
    }),
    /DENIED/,
  );
  await assert.rejects(
    managedToken("https://vault.azure.net", async () => ({ ok: false })),
    /UNAVAILABLE/,
  );
});

import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  chmod,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("backup helper resolves beside its script after changing working directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "mandate-backup-path-"));
  try {
    for (const dir of [
      "private",
      "starting-directory",
      "release/scripts/ops",
      "bin",
    ])
      await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, "private", "ca"), "test-only-ca");
    await writeFile(join(root, "private", "pass"), "test-only-pass");
    await writeFile(
      join(root, "private", "backup.env"),
      `PGSSLMODE=verify-full\nPGPASSFILE=${root}/private/pass\nPGSSLROOTCERT=${root}/private/ca\n`,
    );
    const source = await readFile(
      new URL("../backup-db.sh", import.meta.url),
      "utf8",
    );
    await writeFile(
      join(root, "release/scripts/ops/backup-db.sh"),
      source.replace("base=/opt/mandate", "base=" + root),
    );
    await writeFile(
      join(root, "release/scripts/ops/upload-backup.mjs"),
      'console.log("UPLOAD_HELPER_LOCATED");\n',
    );
    await writeFile(
      join(root, "bin/pg_dump"),
      '#!/bin/bash\nfor arg in "$@"; do case "$arg" in --file=*) printf test-only-archive > "${arg#--file=}" ;; esac; done\n',
    );
    await writeFile(
      join(root, "bin/pg_restore"),
      '#!/bin/bash\n[[ -s "${@: -1}" ]]\n',
    );
    for (const name of ["pg_dump", "pg_restore"])
      await chmod(join(root, "bin", name), 0o755);
    const result = spawnSync(
      "bash",
      ["../release/scripts/ops/backup-db.sh", "a".repeat(40)],
      {
        cwd: join(root, "starting-directory"),
        env: {
          ...process.env,
          PATH: join(root, "bin") + ":" + process.env.PATH,
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /UPLOAD_HELPER_LOCATED/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
