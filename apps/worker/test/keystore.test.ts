import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { loadKeystoreSigner } from "@mandate/platform";

const exec = promisify(execFile);
// Public Anvil development key; the keystore is created by Foundry's own tool.
const KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

test("Foundry keystores load only with the right password, owner-only files and the expected address", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mandate-ks-"));
  try {
    const cast = process.env.CAST_BIN ?? join(homedir(), ".foundry/bin/cast");
    await exec(cast, [
      "wallet",
      "import",
      "lane",
      "--private-key",
      KEY,
      "--keystore-dir",
      dir,
      "--unsafe-password",
      "pw-1",
    ]).catch(() =>
      exec("cast", [
        "wallet",
        "import",
        "lane",
        "--private-key",
        KEY,
        "--keystore-dir",
        dir,
        "--unsafe-password",
        "pw-1",
      ]),
    );
    const keystoreFile = join(dir, "lane");
    const passwordFile = join(dir, "pw");
    await writeFile(passwordFile, "pw-1\n", { mode: 0o600 });
    await chmod(keystoreFile, 0o600);
    const account = await loadKeystoreSigner({
      keystoreFile,
      passwordFile,
      expectedAddress: ADDRESS,
    });
    assert.equal(account.address, ADDRESS);
    await assert.rejects(
      loadKeystoreSigner({
        keystoreFile,
        passwordFile,
        expectedAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      }),
      /does not match/,
    );
    await writeFile(passwordFile, "wrong", { mode: 0o600 });
    await assert.rejects(
      loadKeystoreSigner({
        keystoreFile,
        passwordFile,
        expectedAddress: ADDRESS,
      }),
      /password is incorrect/,
    );
    await chmod(passwordFile, 0o644);
    await assert.rejects(
      loadKeystoreSigner({
        keystoreFile,
        passwordFile,
        expectedAddress: ADDRESS,
      }),
      /readable only by their owner/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
