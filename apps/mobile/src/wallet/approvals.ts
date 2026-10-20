// Checks for the task approval (Permit) and payment co-signature (Approval)
// the Mandate service will ask this phone to sign. Pure TypeScript; the
// service does not exist yet, so nothing calls these from a screen today.
import type { Address, Hex } from "viem";
import { POLICY_CEILINGS } from "./config";
import type { Checked } from "./core";

export const PERMIT_KINDS = [
  "BROWSER",
  "LIQUIDITY",
  "SCHEDULE",
  "ALLOWANCE",
] as const;
const DAY = 86_400n;
const MAX_TASK_SPEND = 2_000_000n;
const MAX_ACTION_SECONDS = 900n;

export interface PermitMessage {
  taskId: Hex;
  executor: Address;
  kind: number;
  asset: Address;
  issuedAt: string | bigint;
  startsAt: string | bigint;
  expiresAt: string | bigint;
  epoch: string | bigint;
  maxActions: number;
  maxPayments: number;
  maxPayment: string | bigint;
  spendCap: string | bigint;
  reviewThreshold: string | bigint;
  periodCap: string | bigint;
  periodSeconds: number;
  [key: string]: unknown;
}

// Refuses a Permit the contract would reject or that does not belong to this
// wallet's current epoch, before the owner is ever asked to sign it.
export function checkPermit(
  p: PermitMessage,
  expected: {
    epoch: bigint;
    nowSeconds: bigint;
    agentAssets: readonly Address[];
  },
): Checked<PermitMessage> {
  const n = (v: string | bigint) => BigInt(v);
  const kind = PERMIT_KINDS[p.kind];
  if (!kind) return { ok: false, error: "Unknown task kind." };
  if (
    !expected.agentAssets.some((a) => a.toLowerCase() === p.asset.toLowerCase())
  )
    return { ok: false, error: "The task pays in an asset agents cannot use." };
  if (n(p.epoch) !== expected.epoch)
    return {
      ok: false,
      error: "The task was drafted before the last pause. Ask for a new draft.",
    };
  const life = n(p.expiresAt) - n(p.startsAt);
  const maxLife = kind === "ALLOWANCE" ? 30n * DAY : DAY;
  if (n(p.startsAt) < n(p.issuedAt) || life <= 0n || life > maxLife)
    return { ok: false, error: "The task lasts longer than allowed." };
  if (n(p.expiresAt) <= expected.nowSeconds)
    return { ok: false, error: "The task has already expired." };
  if (n(p.maxPayment) > POLICY_CEILINGS.perTx)
    return { ok: false, error: "A single payment is above the 0.50 ceiling." };
  if (kind !== "ALLOWANCE" && n(p.spendCap) > MAX_TASK_SPEND)
    return {
      ok: false,
      error: "The task can spend more than the 2.00 ceiling.",
    };
  if (p.maxPayments > p.maxActions)
    return { ok: false, error: "The task allows more payments than actions." };
  if (kind === "BROWSER" && p.maxPayments > 3)
    return { ok: false, error: "A page check allows at most 3 payments." };
  if (
    kind === "ALLOWANCE" &&
    (n(p.periodCap) === 0n || ![86_400, 604_800].includes(p.periodSeconds))
  )
    return { ok: false, error: "An allowance needs a daily or weekly cap." };
  if (kind !== "ALLOWANCE" && (n(p.periodCap) !== 0n || p.periodSeconds !== 0))
    return { ok: false, error: "Only an allowance has a period cap." };
  return { ok: true, value: p };
}

// A payment co-signature lasts at most 15 minutes from now.
export function checkApproval(
  a: { actionDigest: Hex; expiresAt: string | bigint },
  nowSeconds: bigint,
): Checked<{ actionDigest: Hex; expiresAt: bigint }> {
  const expiresAt = BigInt(a.expiresAt);
  if (!/^0x[0-9a-fA-F]{64}$/.test(a.actionDigest))
    return { ok: false, error: "The payment to approve is malformed." };
  if (expiresAt <= nowSeconds)
    return { ok: false, error: "The request has expired." };
  if (expiresAt - nowSeconds > MAX_ACTION_SECONDS)
    return { ok: false, error: "The approval would last too long." };
  return { ok: true, value: { actionDigest: a.actionDigest, expiresAt } };
}
