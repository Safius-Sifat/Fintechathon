import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Clock } from "./db.js";
import { transaction } from "./db.js";

export type Job = {
  id: string;
  kind: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
};

type JobRow = {
  id: string;
  kind: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  attempts: number;
  lease_token: string;
};

// Enqueue inside the caller's business transaction so the job commits with it.
export async function enqueueJob(
  client: PoolClient,
  job: {
    kind: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    runAt: number;
    maxAttempts?: number;
  },
  now: number,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    "INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at) VALUES($1,$2,$3,$4,'READY',$5,$6,$7,$7) ON CONFLICT(kind,dedupe_key) DO UPDATE SET kind=EXCLUDED.kind RETURNING id",
    [
      randomUUID(),
      job.kind,
      job.dedupeKey,
      job.payload,
      job.runAt,
      job.maxAttempts ?? 10,
      now,
    ],
  );
  return result.rows[0]!.id;
}

export class JobQueue {
  constructor(
    readonly database: Pool,
    readonly owner: string,
    readonly clock: Clock,
    readonly leaseSeconds = 30,
  ) {}

  // Expired leases become claimable again; attempts count every lease.
  async lease(kinds: readonly string[], limit = 1): Promise<Job[]> {
    const now = this.clock();
    const rows = await transaction(this.database, async (client) => {
      // A lease that expired on its final attempt can never run again.
      await client.query(
        "UPDATE jobs SET state='FAILED',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,last_error=COALESCE(last_error,'lease expired on final attempt'),updated_at=$2 WHERE kind=ANY($1) AND state='LEASED' AND lease_expires_at<=$2 AND attempts>=max_attempts",
        [kinds, now],
      );
      const due = await client.query<{ id: string }>(
        "SELECT id FROM jobs WHERE kind=ANY($1) AND run_at<=$2 AND attempts<max_attempts AND (state='READY' OR (state='LEASED' AND lease_expires_at<=$2)) ORDER BY run_at,id LIMIT $3 FOR UPDATE SKIP LOCKED",
        [kinds, now, limit],
      );
      const leased: JobRow[] = [];
      for (const { id } of due.rows) {
        const row = await client.query<JobRow>(
          "UPDATE jobs SET state='LEASED',lease_owner=$2,lease_token=$3,lease_expires_at=$4,attempts=attempts+1,updated_at=$5 WHERE id=$1 RETURNING id,kind,dedupe_key,payload,attempts,lease_token",
          [id, this.owner, randomUUID(), now + this.leaseSeconds, now],
        );
        leased.push(row.rows[0]!);
      }
      return leased;
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      dedupeKey: r.dedupe_key,
      payload: r.payload,
      attempts: r.attempts,
      leaseToken: r.lease_token,
    }));
  }

  async heartbeat(job: Job): Promise<boolean> {
    const now = this.clock();
    const result = await this.database.query(
      "UPDATE jobs SET lease_expires_at=$3,updated_at=$4 WHERE id=$1 AND lease_token=$2 AND state='LEASED' AND lease_expires_at>$4",
      [job.id, job.leaseToken, now + this.leaseSeconds, now],
    );
    return result.rowCount === 1;
  }

  // Completion and its business writes commit together, fenced by the lease token,
  // so a worker whose lease expired cannot apply a stale transition.
  async complete<T>(
    job: Job,
    apply: (client: PoolClient) => Promise<T>,
  ): Promise<{ applied: true; value: T } | { applied: false }> {
    return transaction(this.database, async (client) => {
      const now = this.clock();
      const fence = await client.query(
        "UPDATE jobs SET state='DONE',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=$3 WHERE id=$1 AND lease_token=$2 AND state='LEASED' AND lease_expires_at>$3",
        [job.id, job.leaseToken, now],
      );
      if (fence.rowCount !== 1) return { applied: false };
      return { applied: true, value: await apply(client) };
    });
  }

  async retry(job: Job, error: string, delaySeconds: number): Promise<void> {
    const now = this.clock();
    await this.database.query(
      "UPDATE jobs SET state=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'READY' END,lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,run_at=$3,last_error=$4,updated_at=$5 WHERE id=$1 AND lease_token=$2 AND state='LEASED'",
      [job.id, job.leaseToken, now + delaySeconds, error.slice(0, 500), now],
    );
  }

  // Reschedules without consuming the result (e.g. waiting for confirmations).
  async defer(job: Job, runAt: number): Promise<void> {
    const now = this.clock();
    await this.database.query(
      "UPDATE jobs SET state='READY',attempts=GREATEST(attempts-1,0),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,run_at=$3,updated_at=$4 WHERE id=$1 AND lease_token=$2 AND state='LEASED'",
      [job.id, job.leaseToken, runAt, now],
    );
  }
}
