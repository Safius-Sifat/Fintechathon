import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { canonicalJson } from "@mandate/schema";
import { transaction } from "./db.js";

export class IdempotencyConflict extends Error {
  constructor() {
    super("Idempotency key was used with a different body.");
  }
}

export const bodyHash = (body: unknown) =>
  createHash("sha256").update(canonicalJson(body)).digest("hex");

// Locks tenant+route+key, compares the canonical body hash, then applies the
// business change and stores its response in the same transaction.
export async function idempotentMutation<T extends Record<string, unknown>>(
  database: Pool,
  scope: { tenant: string; route: string; key: string; body: unknown },
  now: number,
  apply: (client: PoolClient) => Promise<{ status: number; response: T }>,
): Promise<{ status: number; response: T; replayed: boolean }> {
  const hash = bodyHash(scope.body);
  return transaction(database, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${scope.tenant}|${scope.route}|${scope.key}`,
    ]);
    const prior = (
      await client.query<{ body_hash: string; status: number; response: T }>(
        "SELECT body_hash,status,response FROM idempotency_keys WHERE tenant=$1 AND route=$2 AND key=$3",
        [scope.tenant, scope.route, scope.key],
      )
    ).rows[0];
    if (prior) {
      if (prior.body_hash !== hash) throw new IdempotencyConflict();
      return { status: prior.status, response: prior.response, replayed: true };
    }
    const { status, response } = await apply(client);
    await client.query(
      "INSERT INTO idempotency_keys(tenant,route,key,body_hash,status,response,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [scope.tenant, scope.route, scope.key, hash, status, response, now],
    );
    return { status, response, replayed: false };
  });
}
