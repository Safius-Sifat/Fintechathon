import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  appendOutbox,
  drainOutbox,
  enqueueJob,
  idempotentMutation,
  JobQueue,
  transaction,
} from "@mandate/platform";
import { admin, isolatedSchema } from "./support.js";

after(() => admin.end());

async function withSchema(
  run: (db: Awaited<ReturnType<typeof isolatedSchema>>) => Promise<void>,
) {
  const db = await isolatedSchema("store");
  try {
    await run(db);
  } finally {
    await db.drop();
  }
}

test("P2-03.T07 racing workers lease one job once; an expired lease cannot apply a stale transition", () =>
  withSchema(async ({ pool }) => {
    let now = 1793000000;
    const clock = () => now;
    await transaction(pool, (c) =>
      enqueueJob(
        c,
        {
          kind: "action.sign",
          dedupeKey: "action-1",
          payload: { actionId: "action-1" },
          runAt: now,
        },
        now,
      ),
    );
    // Re-enqueueing the same logical job is a no-op.
    await transaction(pool, (c) =>
      enqueueJob(
        c,
        {
          kind: "action.sign",
          dedupeKey: "action-1",
          payload: { actionId: "other" },
          runAt: now,
        },
        now,
      ),
    );
    assert.equal((await pool.query("SELECT 1 FROM jobs")).rowCount, 1);

    const w1 = new JobQueue(pool, "worker-1", clock, 30);
    const w2 = new JobQueue(pool, "worker-2", clock, 30);
    const leases = (
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? w1 : w2).lease(["action.sign"]),
        ),
      )
    ).flat();
    assert.equal(leases.length, 1);
    const first = leases[0]!;
    assert.equal(first.payload.actionId, "action-1");

    // The lease expires; another worker takes over.
    now += 31;
    assert.equal(await w1.heartbeat(first), false);
    const [second] = await w2.lease(["action.sign"]);
    assert.ok(second);
    assert.notEqual(second.leaseToken, first.leaseToken);
    assert.equal(second.attempts, 2);

    const transition =
      (label: string) =>
      async (c: Parameters<Parameters<typeof transaction>[1]>[0]) => {
        await appendOutbox(
          c,
          {
            topic: "action.signed",
            aggregateId: "action-1",
            dedupeKey: "action-1:signed",
            payload: { by: label },
          },
          now,
        );
        return label;
      };
    const stale = await w1.complete(first, transition("stale"));
    assert.deepEqual(stale, { applied: false });
    const fresh = await w2.complete(second, transition("fresh"));
    assert.deepEqual(fresh, { applied: true, value: "fresh" });
    const outbox = await pool.query<{ payload: { by: string } }>(
      "SELECT payload FROM outbox",
    );
    assert.deepEqual(
      outbox.rows.map((r) => r.payload.by),
      ["fresh"],
    );
    assert.equal(
      (await pool.query("SELECT state FROM jobs")).rows[0].state,
      "DONE",
    );
    assert.deepEqual(await w1.lease(["action.sign"]), []);
  }));

test("P2-03.T07 heartbeat keeps a lease; bounded retries end FAILED instead of looping", () =>
  withSchema(async ({ pool }) => {
    let now = 1793000000;
    const clock = () => now;
    await transaction(pool, (c) =>
      enqueueJob(
        c,
        {
          kind: "wallet.provision",
          dedupeKey: "w",
          payload: {},
          runAt: now,
          maxAttempts: 2,
        },
        now,
      ),
    );
    const q = new JobQueue(pool, "worker", clock, 30);
    const other = new JobQueue(pool, "other", clock, 30);
    const [job] = await q.lease(["wallet.provision"]);
    now += 20;
    assert.equal(await q.heartbeat(job!), true);
    now += 20;
    assert.deepEqual(await other.lease(["wallet.provision"]), []);
    await q.retry(job!, "factory RPC unavailable", 5);
    now += 5;
    const [again] = await other.lease(["wallet.provision"]);
    assert.equal(again!.attempts, 2);
    await other.retry(again!, "factory RPC unavailable", 5);
    now += 5;
    assert.deepEqual(await q.lease(["wallet.provision"]), []);
    const row = (await pool.query("SELECT state,last_error FROM jobs")).rows[0];
    assert.equal(row.state, "FAILED");
    assert.equal(row.last_error, "factory RPC unavailable");
  }));

test("P2-03.T07 concurrent outbox consumers publish each message exactly once; failed publish stays pending", () =>
  withSchema(async ({ pool }) => {
    const now = 1793000000;
    await transaction(pool, async (c) => {
      for (let i = 0; i < 30; i++)
        await appendOutbox(
          c,
          {
            topic: "task.event",
            aggregateId: "t",
            dedupeKey: "m" + i,
            payload: { i },
          },
          now,
        );
      assert.equal(
        await appendOutbox(
          c,
          {
            topic: "task.event",
            aggregateId: "t",
            dedupeKey: "m0",
            payload: { i: 99 },
          },
          now,
        ),
        false,
      );
    });
    const seen: number[] = [];
    let failOnce = true;
    const publish = async (m: { payload: Record<string, unknown> }) => {
      if (m.payload.i === 7 && failOnce) {
        failOnce = false;
        throw new Error("broker unavailable");
      }
      seen.push(m.payload.i as number);
    };
    const drain = () => drainOutbox(pool, () => now, publish).catch(() => 0);
    await Promise.all([drain(), drain(), drain()]);
    await Promise.all([drain(), drain()]);
    assert.deepEqual(
      [...seen].sort((a, b) => a - b),
      Array.from({ length: 30 }, (_, i) => i),
    );
    assert.equal(
      (await pool.query("SELECT 1 FROM outbox WHERE published_at IS NULL"))
        .rowCount,
      0,
    );
  }));

test("P2-03.T07 idempotency rows survive lease recovery and changed bodies conflict", () =>
  withSchema(async ({ pool }) => {
    const now = 1793000000;
    const tenant = "0x" + "11".repeat(20);
    await pool.query(
      "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
      [tenant, now],
    );
    const key = randomUUID();
    let applied = 0;
    const run = (body: unknown) =>
      idempotentMutation(
        pool,
        { tenant, route: "/v1/tasks/:taskId/run", key, body },
        now,
        async () => {
          applied++;
          return { status: 200, response: { started: true } };
        },
      );
    const results = await Promise.all(
      Array.from({ length: 10 }, () => run({})),
    );
    assert.equal(applied, 1);
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    await assert.rejects(run({ changed: true }), /different body/);
  }));
