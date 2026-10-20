import type { Pool } from "pg";

export type ActionRecord = {
  action_id: string;
  task_id: string;
  wallet_id: string;
  permit_id: string;
  request_id: string;
  operation: number;
  amount: string;
  action: unknown;
  digest: string;
  invoice: unknown;
  provider_signature: string | null;
  action_state: string;
  action_created_at: string;
  wallet_address: string | null;
  owner_address: string;
  provisioning_state: string;
  mpc_wallet_id: string | null;
  executor_address: string | null;
  key_version: number | null;
  paused: boolean;
  frozen: boolean;
  inhibited: boolean;
  runbook_id: string;
  permit: unknown;
  owner_signature: string;
  authority_state: string;
  scope: unknown;
  reservation_state: string | null;
  reservation_amount: string | null;
  attempt_state: string | null;
  attempt_digest: string | null;
};

// Reads only immutable owner-signed and journaled records selected by ID; the
// caller's message never supplies any value used for the decision.
export async function loadAction(
  database: Pool,
  actionId: string,
  attemptId: string,
): Promise<ActionRecord | undefined> {
  return (
    await database.query<ActionRecord>(
      `SELECT a.id AS action_id,a.task_id,a.wallet_id,a.permit_id,a.request_id,a.operation,a.amount::text,a.action,a.digest,a.invoice,a.provider_signature,a.state AS action_state,a.created_at::text AS action_created_at,
        w.wallet_address,w.owner_address,w.provisioning_state,w.mpc_wallet_id,w.executor_address,w.key_version,w.paused,w.frozen,w.inhibited,
        t.runbook_id,p.permit,p.owner_signature,p.authority_state,d.scope,
        r.state AS reservation_state,r.amount::text AS reservation_amount,
        s.state AS attempt_state,s.digest AS attempt_digest
       FROM actions a
       JOIN wallets w ON w.id=a.wallet_id
       JOIN tasks t ON t.id=a.task_id
       JOIN permits p ON p.permit_id=a.permit_id AND p.wallet_id=a.wallet_id
       JOIN permit_drafts d ON d.id=p.draft_id
       LEFT JOIN reservations r ON r.action_id=a.id
       LEFT JOIN signing_attempts s ON s.id=$2 AND s.action_id=a.id
       WHERE a.id=$1`,
      [actionId, attemptId],
    )
  ).rows[0];
}

// Proposals admitted for this executor within the last minute, across wallets.
export async function recentProposals(
  database: Pool,
  executor: string,
  now: number,
): Promise<number> {
  const result = await database.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM actions a JOIN wallets w ON w.id=a.wallet_id WHERE w.executor_address=$1 AND a.created_at>$2",
    [executor, now - 60],
  );
  return Number(result.rows[0]!.n);
}

export async function loadKeygenWallet(database: Pool, mpcWalletId: string) {
  return (
    await database.query<{ id: string; provisioning_state: string }>(
      "SELECT id,provisioning_state FROM wallets WHERE mpc_wallet_id=$1",
      [mpcWalletId],
    )
  ).rows[0];
}
