import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { transaction } from "@mandate/platform";
import {
  reserve,
  ReservationDenied,
  settleReservation,
  type ChainSpend,
  type Limits,
} from "../../src/reservations.js";
import { admin, isolatedSchema } from "./support.js";
import {
  DEMO_USD,
  seedAction,
  seedTaskWithPermit,
  seedWallet,
} from "./fixtures.js";

after(() => admin.end());

const now = 1793000000;
const day = BigInt(Math.floor(now / 86400));

async function withDb(run: (pool: Pool) => Promise<void>) {
  const db = await isolatedSchema("resv");
  try {
    await run(db.pool);
  } finally {
    await db.drop();
  }
}

const attempt = (
  pool: Pool,
  ids: { walletId: string; permitId: string },
  actionId: string,
  amount: bigint,
  chain: ChainSpend,
  limits: Limits,
) =>
  transaction(pool, (c) =>
    reserve(
      c,
      {
        actionId,
        walletId: ids.walletId,
        permitId: ids.permitId,
        asset: DEMO_USD,
        kind: "OUTFLOW",
        amount,
      },
      chain,
      limits,
      now,
    ),
  ).then(
    () => "ADMITTED" as const,
    (error) => {
      if (error instanceof ReservationDenied) return error.code;
      throw error;
    },
  );

const openTotal = async (pool: Pool, walletId: string) =>
  BigInt(
    (
      await pool.query<{ units: string }>(
        "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND state IN ('RESERVED','UNKNOWN','INCLUDED')",
        [walletId],
      )
    ).rows[0]!.units,
  );

test("P2-04.T01 two tasks race for the last 500000 daily allowance with 350000 each; exactly one is admitted", () =>
  withDb(async (pool) => {
    for (let round = 0; round < 10; round++) {
      const { walletId } = await seedWallet(pool, now);
      const a = await seedTaskWithPermit(pool, walletId, now, {
        spendCap: 1_000_000n,
        maxPayment: 400_000n,
      });
      const b = await seedTaskWithPermit(pool, walletId, now, {
        spendCap: 1_000_000n,
        maxPayment: 400_000n,
      });
      const actionA = await seedAction(pool, { walletId, ...a }, 350_000n, now);
      const actionB = await seedAction(pool, { walletId, ...b }, 350_000n, now);
      // 1000000 daily cap with 500000 already included on chain leaves 500000.
      const chain = {
        day,
        permitGross: 0n,
        walletDayGross: 500_000n,
        liquid: 10_000_000n,
      };
      const limits = {
        maxPayment: 400_000n,
        spendCap: 1_000_000n,
        dailyCap: 1_000_000n,
        liquidFloor: 0n,
      };
      const results = await Promise.all([
        attempt(
          pool,
          { walletId, permitId: a.permitId },
          actionA,
          350_000n,
          chain,
          limits,
        ),
        attempt(
          pool,
          { walletId, permitId: b.permitId },
          actionB,
          350_000n,
          chain,
          limits,
        ),
      ]);
      assert.deepEqual([...results].sort(), ["ADMITTED", "DAILY_CAP"]);
      assert.ok(
        chain.walletDayGross + (await openTotal(pool, walletId)) <=
          limits.dailyCap,
      );
    }
  }));

test("P2-04.T05 an UNKNOWN reservation from yesterday still consumes today's capacity", () =>
  withDb(async (pool) => {
    const { walletId } = await seedWallet(pool, now);
    const ids = await seedTaskWithPermit(pool, walletId, now, {
      spendCap: 2_000_000n,
      maxPayment: 400_000n,
    });
    const limits = {
      maxPayment: 400_000n,
      spendCap: 2_000_000n,
      dailyCap: 500_000n,
      liquidFloor: 0n,
    };
    const old = await seedAction(pool, { walletId, ...ids }, 350_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        old,
        350_000n,
        { day, permitGross: 0n, walletDayGross: 0n, liquid: 5_000_000n },
        limits,
      ),
      "ADMITTED",
    );
    await transaction(pool, (c) =>
      settleReservation(c, old, { state: "UNKNOWN" }, now + 60),
    );
    // UTC midnight passes: the chain's day gross resets, the unknown risk does not.
    const tomorrow = {
      day: day + 1n,
      permitGross: 0n,
      walletDayGross: 0n,
      liquid: 5_000_000n,
    };
    const big = await seedAction(pool, { walletId, ...ids }, 350_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        big,
        350_000n,
        tomorrow,
        limits,
      ),
      "DAILY_CAP",
    );
    const small = await seedAction(pool, { walletId, ...ids }, 150_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        small,
        150_000n,
        tomorrow,
        limits,
      ),
      "ADMITTED",
    );
    // Time passing never releases UNKNOWN.
    const row = await pool.query(
      "SELECT state,chain_day::text FROM reservations WHERE action_id=$1",
      [old],
    );
    assert.deepEqual(row.rows[0], {
      state: "UNKNOWN",
      chain_day: day.toString(),
    });
    // When it is later found included on its actual chain day it stops counting as unresolved
    // (the chain gross for that day now includes it) and is not added twice.
    await transaction(pool, (c) =>
      settleReservation(
        c,
        old,
        { state: "INCLUDED", chainDay: day },
        now + 90000,
      ),
    );
    const third = await seedAction(pool, { walletId, ...ids }, 350_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        third,
        350_000n,
        tomorrow,
        limits,
      ),
      "ADMITTED",
    );
  }));

test("P2-04.T06 a refund raises liquidity but does not replenish the permit's gross spend cap", () =>
  withDb(async (pool) => {
    const { walletId } = await seedWallet(pool, now);
    const ids = await seedTaskWithPermit(pool, walletId, now, {
      spendCap: 500_000n,
      maxPayment: 400_000n,
    });
    const limits = {
      maxPayment: 400_000n,
      spendCap: 500_000n,
      dailyCap: null,
      liquidFloor: 0n,
    };
    const paid = await seedAction(pool, { walletId, ...ids }, 350_000n, now);
    const before = {
      day,
      permitGross: 0n,
      walletDayGross: 0n,
      liquid: 400_000n,
    };
    assert.equal(
      await attempt(pool, { walletId, ...ids }, paid, 350_000n, before, limits),
      "ADMITTED",
    );
    await transaction(pool, (c) =>
      settleReservation(c, paid, { state: "INCLUDED", chainDay: day }, now),
    );
    // The provider refunds 350000: chain liquidity is back, contract gross stays 350000.
    const afterRefund = {
      day,
      permitGross: 350_000n,
      walletDayGross: 350_000n,
      liquid: 400_000n,
    };
    const retry = await seedAction(pool, { walletId, ...ids }, 350_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        retry,
        350_000n,
        afterRefund,
        limits,
      ),
      "PAYMENT_CAP",
    );
    const fits = await seedAction(pool, { walletId, ...ids }, 150_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        fits,
        150_000n,
        afterRefund,
        limits,
      ),
      "ADMITTED",
    );
  }));

test("P2-04 liquid floor subtracts unincluded outflows; release requires an explicit proven reason", () =>
  withDb(async (pool) => {
    const { walletId } = await seedWallet(pool, now);
    const ids = await seedTaskWithPermit(pool, walletId, now, {
      spendCap: 5_000_000n,
      maxPayment: 1_000_000n,
      liquidFloor: 200_000n,
    });
    const limits = {
      maxPayment: 1_000_000n,
      spendCap: 5_000_000n,
      dailyCap: null,
      liquidFloor: 200_000n,
    };
    const chain = {
      day,
      permitGross: 0n,
      walletDayGross: 0n,
      liquid: 1_000_000n,
    };
    const first = await seedAction(pool, { walletId, ...ids }, 500_000n, now);
    assert.equal(
      await attempt(pool, { walletId, ...ids }, first, 500_000n, chain, limits),
      "ADMITTED",
    );
    const second = await seedAction(pool, { walletId, ...ids }, 400_000n, now);
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        second,
        400_000n,
        chain,
        limits,
      ),
      "LIQUID_FLOOR",
    );
    assert.equal(
      await attempt(pool, { walletId, ...ids }, first, 1n, chain, limits),
      "RESERVATION_CONFLICT",
    );
    await transaction(pool, (c) =>
      settleReservation(
        c,
        first,
        { state: "RELEASED", reason: "REVERTED" },
        now,
      ),
    );
    assert.equal(
      await attempt(
        pool,
        { walletId, ...ids },
        second,
        400_000n,
        chain,
        limits,
      ),
      "ADMITTED",
    );
    await assert.rejects(
      pool.query(
        "UPDATE reservations SET state='RELEASED' WHERE action_id=$1",
        [second],
      ),
      (error: { code?: string }) => error.code === "23514",
    );
  }));
