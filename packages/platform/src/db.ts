import type { Pool, PoolClient } from "pg";

export type Clock = () => number;
export const systemClock: Clock = () => Math.floor(Date.now() / 1000);

// SERIALIZABLE conflicts and deadlocks are retried; every other error propagates.
const RETRYABLE = new Set(["40001", "40P01"]);

export async function transaction<T>(
  database: Pool,
  run: (client: PoolClient) => Promise<T>,
  options: {
    isolation?: "READ COMMITTED" | "SERIALIZABLE";
    retries?: number;
  } = {},
): Promise<T> {
  const retries = options.retries ?? 5;
  for (let attempt = 0; ; attempt++) {
    const client = await database.connect();
    let discard = false;
    try {
      await client.query(
        `BEGIN ISOLATION LEVEL ${options.isolation ?? "READ COMMITTED"}`,
      );
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (typeof code === "string" && RETRYABLE.has(code) && attempt < retries)
        continue;
      throw error;
    } finally {
      client.release(discard);
    }
  }
}

export const isUniqueViolation = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === "23505";
