import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  AuthChallengeResponseSchema,
  AuthTokensSchema,
  buildTypedData,
} from "@mandate/schema";
import {
  discoverMigrations,
  runMigrations,
} from "../../../../packages/platform/src/migrations.js";
import { createApi, type ApiOptions } from "../../src/app.js";

// Public Anvil fixture keys only; these accounts must never hold live funds.
export const ownerA = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
export const ownerB = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const deviceId = "0x" + "de".repeat(32);
export const authConfig = {
  origin: "https://api.mandate.example",
  issuer: "https://api.mandate.example",
  audience: "mandate-owner-api",
  signingKey: new Uint8Array(32).fill(7),
};

const url = process.env.TEST_DATABASE_URL;
const caPath = process.env.TEST_DATABASE_CA;
if (!url || !caPath)
  throw new Error(
    "TEST_DATABASE_URL and TEST_DATABASE_CA required; real database acceptance cannot be skipped",
  );
const ca = await readFile(caPath, "utf8");
export const poolConfig = {
  connectionString: url,
  max: 12,
  connectionTimeoutMillis: 3000,
  ssl: { ca, rejectUnauthorized: true },
};
export const admin = new Pool(poolConfig);

export async function isolatedSchema(prefix: string) {
  const schema = prefix + "_" + randomBytes(8).toString("hex");
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ ...poolConfig, options: "-c search_path=" + schema });
  const client = await pool.connect();
  try {
    const migrations = await discoverMigrations(
      new URL("../../migrations", import.meta.url).pathname,
    );
    await runMigrations(client, migrations, { schema });
  } finally {
    client.release();
  }
  return {
    schema,
    pool,
    drop: async () => {
      if (!pool.ended) await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    },
  };
}

export async function apiEnvironment(options: Partial<ApiOptions> = {}) {
  const db = await isolatedSchema("biz");
  let now = 1793000000;
  const app = await createApi({
    database: db.pool,
    auth: authConfig,
    clock: () => now,
    logger: false,
    ...options,
  });
  const login = async (account: PrivateKeyAccount) => {
    const challenge = await app.inject({
      method: "POST",
      url: "/v1/auth/challenge",
      payload: { ownerAddress: account.address, deviceId },
    });
    assert.equal(challenge.statusCode, 200, challenge.body);
    const data = AuthChallengeResponseSchema.parse(challenge.json());
    const signature = await account.signTypedData(
      buildTypedData("Login", data.typedData.message, data.typedData.domain),
    );
    const verify = await app.inject({
      method: "POST",
      url: "/v1/auth/verify",
      payload: { challengeId: data.challengeId, signature },
    });
    assert.equal(verify.statusCode, 200, verify.body);
    return "Bearer " + AuthTokensSchema.parse(verify.json()).accessToken;
  };
  const call = (
    method: "GET" | "POST" | "DELETE",
    path: string,
    authorization: string,
    payload?: unknown,
    key: string | null = randomUUID(),
  ) =>
    app.inject({
      method,
      url: path,
      headers: {
        authorization,
        ...(key && method !== "GET" ? { "idempotency-key": key } : {}),
      },
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  return {
    app,
    pool: db.pool,
    login,
    call,
    now: () => now,
    advance: (seconds: number) => {
      now += seconds;
    },
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
}

// Inserts a task row directly; task creation itself depends on Person4's prepareTask.
export async function insertTask(pool: Pool, walletId: string, now: number) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,runbook_state,created_at,updated_at) VALUES($1,$2,$3,'browser-check','fixture goal','{}','DRAFT','PENDING','{\"schemaVersion\":4}',$4,$4)",
    [id, "0x" + randomBytes(32).toString("hex"), walletId, now],
  );
  return id;
}
