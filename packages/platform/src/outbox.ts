import type { Pool, PoolClient } from "pg";
import type { Clock } from "./db.js";
import { transaction } from "./db.js";

export async function appendOutbox(
  client: PoolClient,
  message: {
    topic: string;
    aggregateId: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
  },
  now: number,
): Promise<boolean> {
  const result = await client.query(
    "INSERT INTO outbox(topic,aggregate_id,dedupe_key,payload,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
    [
      message.topic,
      message.aggregateId,
      message.dedupeKey,
      message.payload,
      now,
    ],
  );
  return result.rowCount === 1;
}

export type OutboxMessage = {
  id: string;
  topic: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

// Each message is claimed under a row lock; publish failure leaves it unpublished.
export async function drainOutbox(
  database: Pool,
  clock: Clock,
  publish: (message: OutboxMessage) => Promise<void>,
  limit = 50,
): Promise<number> {
  let published = 0;
  for (let i = 0; i < limit; i++) {
    const done = await transaction(database, async (client) => {
      const row = (
        await client.query<{
          id: string;
          topic: string;
          aggregate_id: string;
          payload: Record<string, unknown>;
        }>(
          "SELECT id,topic,aggregate_id,payload FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
        )
      ).rows[0];
      if (!row) return false;
      await publish({
        id: row.id,
        topic: row.topic,
        aggregateId: row.aggregate_id,
        payload: row.payload,
      });
      await client.query("UPDATE outbox SET published_at=$2 WHERE id=$1", [
        row.id,
        clock(),
      ]);
      return true;
    });
    if (!done) break;
    published++;
  }
  return published;
}
