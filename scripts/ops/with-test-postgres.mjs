import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  chmod,
  access,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pins = JSON.parse(
  await readFile(join(root, "scripts/ops/postgres-test-tools.json"), "utf8"),
);
const platform = process.platform + "-" + process.arch;
const tool = pins.tools[platform];
if (!tool)
  throw Error(
    "Unsupported local test platform; use Linux x64 CI or supply TEST_DATABASE_URL to the DB test target",
  );
const packageDirectory = join(
  root,
  ".tools",
  "postgres-test-" + platform,
  "package",
);
const bin = join(packageDirectory, "native/bin");
try {
  await access(join(bin, "postgres"));
} catch {
  const response = await fetch(tool.url);
  if (!response.ok) throw Error("Test PostgreSQL download failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    "sha512-" + createHash("sha512").update(bytes).digest("base64") !==
    tool.integrity
  )
    throw Error("Test PostgreSQL integrity mismatch");
  const cache = dirname(packageDirectory);
  await mkdir(cache, { recursive: true });
  const archive = join(cache, "binary.tgz");
  await writeFile(archive, bytes);
  await exec("tar", ["-xzf", archive, "-C", cache]);
  await rm(archive);
  // Reviewed package postinstall restores only its packaged native-library symlinks.
  const links = JSON.parse(
    await readFile(join(packageDirectory, "native/pg-symlinks.json"), "utf8"),
  );
  for (const item of links) {
    for (const path of [item.source, item.target]) {
      const target = resolve(packageDirectory, path);
      if (!target.startsWith(packageDirectory + "/native/"))
        throw Error("Invalid test tool symlink");
    }
  }
  await exec(process.execPath, ["scripts/hydrate-symlinks.js"], {
    cwd: packageDirectory,
  });
}
const version = (
  await exec(join(bin, "postgres"), ["--version"])
).stdout.trim();
if (version !== "postgres (PostgreSQL) " + pins.postgresVersion)
  throw Error("Unexpected test PostgreSQL version");
const temp = await mkdtemp(join(tmpdir(), "mandate-pg-"));
const data = join(temp, "data");
const password = randomBytes(24).toString("hex");
const passwordFile = join(temp, "password");
const ca = join(temp, "server.crt");
const key = join(temp, "server.key");
let started = false;
async function freePort() {
  return new Promise((res, rej) => {
    const server = net.createServer();
    server.once("error", rej);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => res(port));
    });
  });
}
const port = await freePort();
try {
  await writeFile(passwordFile, password, { mode: 0o600 });
  await exec(
    join(bin, "initdb"),
    [
      "-D",
      data,
      "-U",
      "ops_fixture",
      "--pwfile",
      passwordFile,
      "--auth-host=scram-sha-256",
      "--auth-local=trust",
      "--locale=C",
      "--encoding=UTF8",
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const config = join(temp, "cert.conf");
  await writeFile(
    config,
    "[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:true\n",
  );
  await exec("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-config",
    config,
    "-keyout",
    key,
    "-out",
    ca,
  ]);
  await chmod(key, 0o600);
  await exec(join(bin, "pg_ctl"), [
    "-D",
    data,
    "-l",
    join(temp, "server.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${temp} -c shared_buffers=32MB -c max_connections=20 -c ssl=on -c ssl_cert_file=${ca} -c ssl_key_file=${key}`,
    "-w",
    "start",
  ]);
  started = true;
  const url = `postgresql://ops_fixture:${password}@127.0.0.1:${port}/postgres`;
  console.log(
    JSON.stringify({
      testDatabase: version,
      bind: "127.0.0.1",
      tls: true,
      disposable: true,
    }),
  );
  const status = await new Promise((resolveExit, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "packages/platform/test/db/*.test.ts",
        "apps/api/test/db/*.test.ts",
        "apps/worker/test/db/*.test.ts",
        "services/policy/test/db/*.test.ts",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          APP_ENV: "test",
          TEST_DATABASE_URL: url,
          TEST_DATABASE_CA: ca,
        },
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  process.exitCode = status;
} finally {
  if (started)
    await exec(join(bin, "pg_ctl"), [
      "-D",
      data,
      "-m",
      "immediate",
      "-w",
      "stop",
    ]).catch(() => {
      process.exitCode = 1;
    });
  await rm(temp, { recursive: true, force: true });
}
