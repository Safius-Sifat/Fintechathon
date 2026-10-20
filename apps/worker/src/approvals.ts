import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { appendEvent, notifyOwner, type PushSender } from "@mandate/platform";
import { settleReservation } from "./reservations.js";

// Effective review threshold: the lower of the Permit's and the confirmed WalletPolicy's.
export async function reviewThreshold(
  c: PoolClient,
  walletId: string,
  permitThreshold: bigint,
): Promise<bigint> {
  const policy = (
    await c.query<{ threshold: string }>(
      "SELECT policy->>'reviewThreshold' AS threshold FROM wallet_policies WHERE wallet_id=$1 ORDER BY version DESC LIMIT 1",
      [walletId],
    )
  ).rows[0];
  const p = policy ? BigInt(policy.threshold) : permitThreshold;
  return p < permitThreshold ? p : permitThreshold;
}

export type Gate = "PROCEED" | "WAIT" | "REJECTED";

// Runs after reservation and before any MPC request. Above-threshold Actions
// wait for the owner's co-signature; rejection or expiry releases the
// reservation because no executor signature exists.
export async function approvalGate(
  c: PoolClient,
  action: {
    id: string;
    walletId: string;
    taskId: string;
    owner: string;
    digest: string;
    amount: bigint;
    deadline: bigint;
    permitThreshold: bigint;
    requestId: string;
    permitId: string;
  },
  push: PushSender | null,
  now: number,
): Promise<Gate> {
  if (
    action.amount <=
    (await reviewThreshold(c, action.walletId, action.permitThreshold))
  )
    return "PROCEED";
  const approval = (
    await c.query<{ approval_id: string; state: string; expires_at: string }>(
      "SELECT approval_id,state,expires_at FROM approval_requests WHERE action_id=$1 FOR UPDATE",
      [action.id],
    )
  ).rows[0];
  if (!approval) {
    const approvalId = randomUUID();
    await c.query(
      "INSERT INTO approval_requests(approval_id,action_id,wallet_id,action_digest,expires_at,state,created_at) VALUES($1,$2,$3,$4,$5,'PENDING',$6)",
      [
        approvalId,
        action.id,
        action.walletId,
        action.digest,
        action.deadline.toString(),
        now,
      ],
    );
    await c.query(
      "UPDATE actions SET state='AWAITING_APPROVAL',updated_at=$2 WHERE id=$1 AND state='RESERVED'",
      [action.id, now],
    );
    await appendEvent(
      c,
      {
        taskId: action.taskId,
        type: "APPROVAL_REQUESTED",
        dedupeKey: "approval:" + approvalId,
        requestId: action.requestId,
        permitId: action.permitId,
        payload: { approvalId, actionDigest: action.digest },
      },
      now,
    );
    await notifyOwner(c, push, action.owner, "APPROVAL", approvalId, now);
    return "WAIT";
  }
  if (approval.state === "APPROVED") return "PROCEED";
  if (approval.state === "PENDING" && now < Number(approval.expires_at))
    return "WAIT";
  if (approval.state === "PENDING")
    await c.query(
      "UPDATE approval_requests SET state='EXPIRED',decided_at=$2 WHERE approval_id=$1",
      [approval.approval_id, now],
    );
  await c.query(
    "UPDATE actions SET state='REJECTED',denial_code='OWNER_REJECTED',updated_at=$2 WHERE id=$1 AND state IN ('RESERVED','AWAITING_APPROVAL')",
    [action.id, now],
  );
  await settleReservation(
    c,
    action.id,
    { state: "RELEASED", reason: "REJECTED" },
    now,
  );
  await appendEvent(
    c,
    {
      taskId: action.taskId,
      type: "OWNER_REJECTION",
      dedupeKey: "rejection:" + approval.approval_id,
      requestId: action.requestId,
      permitId: action.permitId,
      payload: {
        approvalId: approval.approval_id,
        expired: approval.state === "PENDING",
      },
    },
    now,
  );
  return "REJECTED";
}
