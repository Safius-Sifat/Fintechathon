import type { PoolClient } from "pg";

// Chain-included spend read from the wallet contract at one block before locking.
export type ChainSpend = {
  day: bigint;
  permitGross: bigint;
  walletDayGross: bigint;
  liquid: bigint;
};
export type Limits = {
  maxPayment: bigint;
  spendCap: bigint;
  dailyCap: bigint | null;
  liquidFloor: bigint;
};
export type ReservationRequest = {
  actionId: string;
  walletId: string;
  permitId: string;
  asset: string;
  kind: "OUTFLOW" | "DEPOSIT" | "REDEEM";
  amount: bigint;
};
export type DenialCode =
  | "PAYMENT_CAP"
  | "DAILY_CAP"
  | "LIQUID_FLOOR"
  | "RESERVATION_CONFLICT";

export class ReservationDenied extends Error {
  constructor(readonly code: DenialCode) {
    super(`Reservation denied: ${code}`);
  }
}

const sum = async (c: PoolClient, sql: string, params: unknown[]) =>
  BigInt((await c.query<{ units: string }>(sql, params)).rows[0]!.units);

// Admits one reservation under wallet then permit row locks (stable order).
// Included spend comes only from the chain; unresolved (RESERVED/UNKNOWN)
// reservations are added on top and count against today's capacity whatever day
// they were created, because an UNKNOWN transaction may still land today.
export async function reserve(
  c: PoolClient,
  request: ReservationRequest,
  chain: ChainSpend,
  limits: Limits,
  now: number,
): Promise<void> {
  await c.query("SELECT id FROM wallets WHERE id=$1 FOR UPDATE", [
    request.walletId,
  ]);
  await c.query(
    "SELECT permit_id FROM permits WHERE permit_id=$1 AND wallet_id=$2 FOR UPDATE",
    [request.permitId, request.walletId],
  );
  const prior = await c.query("SELECT 1 FROM reservations WHERE action_id=$1", [
    request.actionId,
  ]);
  if (prior.rowCount) throw new ReservationDenied("RESERVATION_CONFLICT");
  const asset = request.asset.toLowerCase();
  if (request.kind === "OUTFLOW") {
    if (request.amount > limits.maxPayment)
      throw new ReservationDenied("PAYMENT_CAP");
    const permitUnresolved = await sum(
      c,
      "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE permit_id=$1 AND kind='OUTFLOW' AND state IN ('RESERVED','UNKNOWN')",
      [request.permitId],
    );
    if (chain.permitGross + permitUnresolved + request.amount > limits.spendCap)
      throw new ReservationDenied("PAYMENT_CAP");
    if (limits.dailyCap !== null) {
      const walletUnresolved = await sum(
        c,
        "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND asset=$2 AND kind='OUTFLOW' AND state IN ('RESERVED','UNKNOWN')",
        [request.walletId, asset],
      );
      if (
        chain.walletDayGross + walletUnresolved + request.amount >
        limits.dailyCap
      )
        throw new ReservationDenied("DAILY_CAP");
    }
  }
  if (request.kind !== "REDEEM") {
    // Liquid balance already reflects included outflows; only unincluded ones are subtracted.
    const unincluded = await sum(
      c,
      "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND asset=$2 AND kind IN ('OUTFLOW','DEPOSIT') AND state IN ('RESERVED','UNKNOWN')",
      [request.walletId, asset],
    );
    if (chain.liquid - limits.liquidFloor - unincluded - request.amount < 0n)
      throw new ReservationDenied("LIQUID_FLOOR");
  }
  await c.query(
    "INSERT INTO reservations(action_id,wallet_id,permit_id,asset,kind,amount,chain_day,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'RESERVED',$8,$8)",
    [
      request.actionId,
      request.walletId,
      request.permitId,
      asset,
      request.kind,
      request.amount.toString(),
      chain.day.toString(),
      now,
    ],
  );
}

export type ReservationOutcome =
  | { state: "UNKNOWN" }
  | { state: "INCLUDED"; chainDay: bigint }
  | {
      state: "RELEASED";
      reason:
        | "REVERTED"
        | "REJECTED"
        | "DENIED_UNSIGNED"
        | "INVALIDATED_RECONCILED";
    };

// RELEASED requires proof that the authority can no longer move funds; a deadline
// or RPC error alone never releases. RELEASED and INCLUDED are terminal except that a
// reorg can return INCLUDED to UNKNOWN.
export async function settleReservation(
  c: PoolClient,
  actionId: string,
  outcome: ReservationOutcome,
  now: number,
): Promise<void> {
  if (outcome.state === "RELEASED") {
    await c.query(
      "UPDATE reservations SET state='RELEASED',release_reason=$2,updated_at=$3 WHERE action_id=$1 AND state IN ('RESERVED','UNKNOWN')",
      [actionId, outcome.reason, now],
    );
    return;
  }
  if (outcome.state === "INCLUDED") {
    await c.query(
      "UPDATE reservations SET state='INCLUDED',chain_day=$2,updated_at=$3 WHERE action_id=$1 AND state IN ('RESERVED','UNKNOWN')",
      [actionId, outcome.chainDay.toString(), now],
    );
    return;
  }
  await c.query(
    "UPDATE reservations SET state='UNKNOWN',updated_at=$2 WHERE action_id=$1 AND state IN ('RESERVED','UNKNOWN','INCLUDED')",
    [actionId, now],
  );
}
