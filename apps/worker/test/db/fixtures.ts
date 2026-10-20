import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";

const hex32 = () => "0x" + randomBytes(32).toString("hex");
const address = () => "0x" + randomBytes(20).toString("hex");
export const DEMO_USD = "0xe030717a657e9194bc086a546fb59adbc631ad7a";

// Inserts a READY wallet with an owner; values are fixtures, not chain facts.
export async function seedWallet(
  pool: Pool,
  now: number,
  overrides: { walletAddress?: string; executor?: string } = {},
) {
  const owner = address();
  const id = randomUUID();
  await pool.query(
    "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
    [owner, now],
  );
  await pool.query(
    "INSERT INTO wallets(id,owner_address,provisioning_state,wallet_address,deployment_block,code_hash,mpc_wallet_id,executor_address,executor_public_key,key_version,created_at,updated_at) VALUES($1,$2,'READY',$3,1,$4,$5,$6,$7,1,$8,$8)",
    [
      id,
      owner,
      overrides.walletAddress ?? address(),
      hex32(),
      randomUUID(),
      overrides.executor ?? address(),
      "0x04" + randomBytes(64).toString("hex"),
      now,
    ],
  );
  return { walletId: id, owner };
}

export async function seedTaskWithPermit(
  pool: Pool,
  walletId: string,
  now: number,
  terms: { spendCap: bigint; maxPayment: bigint; liquidFloor?: bigint },
) {
  const taskId = randomUUID();
  const draftId = randomUUID();
  const permitId = hex32();
  await pool.query(
    "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,runbook_state,created_at,updated_at) VALUES($1,$2,$3,'browser-check','fixture','{}','RUNNING','ACTIVE','{\"schemaVersion\":4}',$4,$4)",
    [taskId, hex32(), walletId, now],
  );
  const permit = {
    asset: DEMO_USD,
    spendCap: terms.spendCap.toString(),
    maxPayment: terms.maxPayment.toString(),
    liquidFloor: (terms.liquidFloor ?? 0n).toString(),
  };
  await pool.query(
    "INSERT INTO permit_drafts(id,wallet_id,task_id,typed_data,scope,digest,permit_id,nonce,epoch,state,expires_at,created_at) VALUES($1,$2,$3,'{}','{\"providerBindings\":[]}',$4,$5,1,0,'ACTIVATED',$6,$6)",
    [draftId, walletId, taskId, hex32(), permitId, now],
  );
  await pool.query(
    "INSERT INTO permits(permit_id,wallet_id,task_id,draft_id,permit,owner_signature,authority_state,spend_cap,period_cap,period_seconds,max_payment,created_at) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,0,0,$8,$9)",
    [
      permitId,
      walletId,
      taskId,
      draftId,
      permit,
      "0x" + "11".repeat(65),
      terms.spendCap.toString(),
      terms.maxPayment.toString(),
      now,
    ],
  );
  return { taskId, permitId };
}

export async function seedAction(
  pool: Pool,
  ids: { walletId: string; taskId: string; permitId: string },
  amount: bigint,
  now: number,
) {
  const id = randomUUID();
  const requestId = hex32();
  const action = {
    permitId: ids.permitId,
    requestId,
    operation: 0,
    target: address(),
    amount: amount.toString(),
    minOutput: "0",
    invoiceId: hex32(),
    inputHash: hex32(),
    period: 0,
    issuedAt: String(now),
    deadline: String(now + 60),
  };
  await pool.query(
    "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,$10,$11,'PROPOSED',$12,$12)",
    [
      id,
      ids.taskId,
      ids.walletId,
      ids.permitId,
      "pay:" + id,
      requestId,
      action.invoiceId,
      DEMO_USD,
      amount.toString(),
      action,
      hex32(),
      now,
    ],
  );
  return id;
}
