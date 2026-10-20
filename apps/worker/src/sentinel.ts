import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import {
  appendEvent,
  notifyOwner,
  transaction,
  type PushSender,
} from "@mandate/platform";

export const RiskRulesSchema = z
  .object({
    version: z.literal("risk-rules-v1"),
    velocity: z
      .object({
        deniedActionsWindowSeconds: z.number().int().positive(),
        deniedActionsThreshold: z.number().int().positive(),
      })
      .strict(),
    recommendation: z.literal("FREEZE"),
  })
  .strict();
export type RiskRules = z.infer<typeof RiskRulesSchema>;

// Deterministic velocity rule; no model takes part. A trigger inhibits new
// signing off chain, records RISK_ALERT and pushes an alert recommending FREEZE.
export async function runSentinel(
  database: Pool,
  rules: RiskRules,
  rulesHash: string,
  push: PushSender | null,
  now: number,
): Promise<string[]> {
  const window = rules.velocity.deniedActionsWindowSeconds;
  const triggered = await database.query<{
    wallet_id: string;
    owner_address: string;
    denials: string;
    task_id: string;
  }>(
    `SELECT a.wallet_id,w.owner_address,count(*)::text AS denials,max(a.task_id::text) AS task_id FROM actions a JOIN wallets w ON w.id=a.wallet_id
      WHERE a.state='DENIED' AND a.updated_at>$1
        AND NOT EXISTS (SELECT 1 FROM financial_alerts f WHERE f.wallet_id=a.wallet_id AND f.kind='RISK' AND f.created_at>$1)
      GROUP BY a.wallet_id,w.owner_address HAVING count(*)>=$2`,
    [now - window, rules.velocity.deniedActionsThreshold],
  );
  const alerts: string[] = [];
  for (const t of triggered.rows) {
    const alertId = randomUUID();
    await transaction(database, async (c) => {
      await c.query(
        "INSERT INTO financial_alerts(id,wallet_id,kind,details,created_at) VALUES($1,$2,'RISK',$3,$4)",
        [
          alertId,
          t.wallet_id,
          {
            rule: "velocity.deniedActions",
            rulesVersion: rules.version,
            rulesHash,
            denials: Number(t.denials),
            windowSeconds: window,
            recommendation: rules.recommendation,
          },
          now,
        ],
      );
      await c.query(
        "UPDATE wallets SET inhibited=true,updated_at=$2 WHERE id=$1",
        [t.wallet_id, now],
      );
      await appendEvent(
        c,
        {
          taskId: t.task_id,
          type: "RISK_ALERT",
          dedupeKey: "risk:" + alertId,
          payload: {
            alertId,
            rulesVersion: rules.version,
            rulesHash,
            denials: Number(t.denials),
            recommendation: rules.recommendation,
          },
        },
        now,
      );
      await notifyOwner(c, push, t.owner_address, "ALERT", alertId, now);
    });
    alerts.push(alertId);
  }
  return alerts;
}
