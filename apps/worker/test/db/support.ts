import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { Pool } from "pg";
import { createPublicClient, custom, http, type PublicClient } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
  discoverMigrations,
  runMigrations,
} from "../../../../packages/platform/src/migrations.js";

const url = process.env.TEST_DATABASE_URL;
const caPath = process.env.TEST_DATABASE_CA;
if (!url || !caPath)
  throw new Error(
    "TEST_DATABASE_URL and TEST_DATABASE_CA required; real database acceptance cannot be skipped",
  );
const ca = await readFile(caPath, "utf8");
const poolConfig = {
  connectionString: url,
  max: 3,
  connectionTimeoutMillis: 3000,
  ssl: { ca, rejectUnauthorized: true },
};
export const admin = new Pool({ ...poolConfig, max: 1 });

export async function isolatedSchema(prefix: string) {
  const schema = prefix + "_" + randomBytes(8).toString("hex");
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ ...poolConfig, options: "-c search_path=" + schema });
  const client = await pool.connect();
  try {
    await runMigrations(
      client,
      await discoverMigrations(
        new URL("../../../api/migrations", import.meta.url).pathname,
      ),
      { schema },
    );
  } finally {
    client.release();
  }
  return {
    pool,
    drop: async () => {
      if (!pool.ended) await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    },
  };
}

// Anvil's public development mnemonic; on a local fork these hold only fork ETH.
const ANVIL_MNEMONIC =
  "test test test test test test test test test test test junk";
export const anvilAccount = (index: number) =>
  mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: index });

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

// Local fork of Base Sepolia: the deployed Person1 contracts keep their real
// addresses and code hashes. Results are LOCAL fork evidence, never public PASS.
export async function forkChain(options: { blockTime?: number } = {}) {
  const port = await freePort();
  const anvil = process.env.ANVIL_BIN ?? join(homedir(), ".foundry/bin/anvil");
  const forkUrl = process.env.ANVIL_FORK_URL ?? "https://sepolia.base.org";
  const child: ChildProcess = spawn(
    anvil,
    [
      "--fork-url",
      forkUrl,
      "--chain-id",
      "84532",
      "--port",
      String(port),
      "--silent",
      "--no-storage-caching",
      "--no-priority-fee",
      ...(options.blockTime ? ["--block-time", String(options.blockTime)] : []),
    ],
    { stdio: "ignore" },
  );
  const rpcUrl = `http://127.0.0.1:${port}`;
  // anvil suggests a 1 gwei priority fee; Base Sepolia suggests about 0.001 gwei.
  // Answer that one call like the public network so fee budgets see realistic quotes.
  const upstream = http(rpcUrl, { retryCount: 0 })({});
  const client: PublicClient = createPublicClient({
    transport: custom({
      request: ({ method, params }) =>
        method === "eth_maxPriorityFeePerGas"
          ? Promise.resolve("0xf4240")
          : upstream.request({ method, params }),
    }),
  });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await client.getChainId()) === 84532) break;
    } catch {
      if (child.exitCode !== null)
        throw new Error("anvil exited; fork RPC unavailable");
      if (Date.now() > deadline) throw new Error("anvil fork did not start");
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const rpc = (method: string, params: unknown[] = []) =>
    client.request({ method: method as never, params: params as never });
  return {
    rpcUrl,
    client,
    forkBlock: await client.getBlockNumber(),
    rpc,
    mine: (blocks = 1) => rpc("anvil_mine", ["0x" + blocks.toString(16)]),
    close: async () => {
      child.kill("SIGTERM");
      await new Promise((r) => child.once("exit", r));
    },
  };
}
