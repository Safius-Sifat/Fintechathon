import { randomBytes } from "node:crypto";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import type { Pool } from "pg";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  type PublicClient,
} from "viem";
import {
  ActionSchema,
  authorityTypes,
  CHAIN_ID,
  checkX402Settlement,
  DeliveryEnvelopeSchema,
  hashAction,
  mandateWalletAbi,
  QuoteEnvelopeSchema,
  RunbookSnapshotSchema,
  walletDomain,
  x402Authorization,
  x402Signature,
  ZERO_HASH,
  type SettlementReader,
  type RunbookDecision,
  type RunbookSnapshot,
} from "@mandate/schema";
import type { RunbookDeps } from "@mandate/runbooks";
import {
  appendEvent,
  readWallet,
  transaction,
  type Clock,
} from "@mandate/platform";
import { answersFor, recordQuestion } from "./agent-questions.js";
import { CONFIRMATIONS, type Relayer } from "./relayer.js";

export type Advance = (
  snapshot: RunbookSnapshot,
  deps: RunbookDeps,
) => Promise<RunbookDecision>;
// Unapproved Actions live at most 60s on chain (MAX_ACTION_SECONDS).
const ACTION_SECONDS = 50;

// Provider quote/retrieve over the provider service's HTTP routes (S6).
// With `x402`, USDC quotes are paid by x402 (S9.10): the worker sends the
// wallet's registered authorization and checks the settlement on chain itself.
export function providerDeps(
  baseUrl: string,
  workerToken: string,
  context: () => { taskId: Hex; wallet: Hex; asset: Hex },
  x402?: { chain: SettlementReader },
): RunbookDeps {
  const post = async (
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) => {
    const r = await fetch(baseUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + workerToken,
        ...headers,
      },
      body: JSON.stringify(body),
      // A first x402 retrieval waits for the facilitator's settlement.
      signal: AbortSignal.timeout(45_000),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return {
    ...(x402
      ? {
          x402: {
            async pay(providerId, quote, action) {
              const wallet = context().wallet;
              const accepts = quote.x402!;
              const payload: PaymentPayload = {
                x402Version: 2,
                accepted: {
                  scheme: accepts.scheme,
                  network: accepts.network,
                  asset: accepts.asset,
                  amount: accepts.amount,
                  payTo: accepts.payTo,
                  maxTimeoutSeconds: accepts.maxTimeoutSeconds,
                  extra: { ...accepts.extra },
                },
                payload: {
                  authorization: x402Authorization(action, wallet),
                  signature: x402Signature(action.requestId, action.permitId),
                },
              };
              const r = await post(
                `/providers/${providerId}/result`,
                { invoiceId: action.invoiceId, requestId: action.requestId },
                { "payment-signature": encodePaymentSignatureHeader(payload) },
              );
              if (r.status === 202 || r.status === 402)
                return {
                  state: "PENDING" as const,
                  reason: String(
                    (r.body as { reason?: string; error?: string } | null)
                      ?.reason ??
                      (r.body as { error?: string } | null)?.error ??
                      "Waiting for settlement",
                  ),
                };
              if (r.status !== 200)
                throw new Error(
                  `Provider ${providerId} x402 payment failed (${r.status})`,
                );
              const delivery = DeliveryEnvelopeSchema.parse(r.body);
              const settlementTxHash = delivery.receipt.paymentTxHash;
              // Independent of the provider: the settlement must be on chain.
              const settled = await checkX402Settlement(
                x402.chain,
                {
                  wallet,
                  asset: quote.invoice.asset,
                  recipient: quote.invoice.recipient,
                  amount: quote.invoice.amount,
                },
                action.requestId,
                settlementTxHash,
                CONFIRMATIONS,
              );
              if (settled.state !== "PAID")
                return { state: "PENDING" as const, reason: settled.reason };
              return {
                state: "DELIVERED" as const,
                delivery,
                settlementTxHash,
              };
            },
          },
        }
      : {}),
    async quote(providerId, input) {
      const r = await post(`/providers/${providerId}/check`, {
        ...context(),
        ...(input as object),
      });
      if (r.status !== 402)
        throw new Error(`Provider ${providerId} did not quote (${r.status})`);
      return QuoteEnvelopeSchema.parse(r.body);
    },
    async retrieve(providerId, invoiceId, requestId, paymentTxHash) {
      const r = await post(`/providers/${providerId}/result`, {
        invoiceId,
        requestId,
        paymentTxHash,
      });
      if (r.status === 202) return { state: "PENDING" };
      if (r.status !== 200)
        throw new Error(
          `Provider ${providerId} result unavailable (${r.status})`,
        );
      return DeliveryEnvelopeSchema.parse(r.body);
    },
  };
}

const abiStruct = (
  fields: readonly { name: string; type: string }[],
  value: Record<string, unknown>,
) =>
  Object.fromEntries(
    fields.map(({ name, type }) => {
      const bits = type.startsWith("uint") ? Number(type.slice(4)) : 0;
      return [
        name,
        bits === 0
          ? value[name]
          : bits <= 48
            ? Number(value[name])
            : BigInt(value[name] as string),
      ];
    }),
  );

// Relays the owner-signed Permit; the task becomes READY only on PermitActivated.
export async function activatePermit(
  database: Pool,
  relayer: Relayer,
  clock: Clock,
  draftId: string,
): Promise<boolean> {
  const row = (
    await database.query<{
      permit_id: string;
      task_id: string;
      wallet_address: string;
      permit: Record<string, unknown>;
      owner_signature: Hex;
      scope: { providerBindings: { recipient: string }[] };
      typed_data: { message: Record<string, unknown> };
      authority_state: string;
    }>(
      "SELECT p.permit_id,p.task_id,w.wallet_address,p.permit,p.owner_signature,d.scope,d.typed_data,p.authority_state FROM permits p JOIN permit_drafts d ON d.id=p.draft_id JOIN wallets w ON w.id=p.wallet_id WHERE p.draft_id=$1",
      [draftId],
    )
  ).rows[0];
  if (!row || row.authority_state !== "PENDING") return true;
  const wallet = getAddress(row.wallet_address);
  const tx = (
    await database.query<{ id: string }>(
      "SELECT id FROM transactions WHERE purpose='ACTIVATE' AND payload->>'draftId'=$1 AND state NOT IN ('REPLACED','DROPPED')",
      [draftId],
    )
  ).rows[0];
  if (!tx) {
    const recipients = row.scope.providerBindings
      .map((b) => getAddress(b.recipient))
      .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    const call = {
      to: wallet,
      data: encodeFunctionData({
        abi: mandateWalletAbi,
        functionName: "activatePermit",
        args: [
          abiStruct(authorityTypes.Permit, row.permit),
          recipients,
          abiStruct(authorityTypes.Schedule, {
            recipient: "0x0000000000000000000000000000000000000000",
            amount: "0",
            start: "0",
            interval: 0,
            window: 0,
            periods: 0,
          }),
          [],
          row.owner_signature,
        ] as never,
      }),
      value: 0n,
    };
    const quote = await relayer.quote("normal", call);
    const journaled = await transaction(database, (c) =>
      relayer.journal(c, "normal", call, quote, {
        purpose: "ACTIVATE",
        actionId: null,
        payload: { draftId },
      }),
    );
    await relayer.broadcast(journaled.id);
    return false;
  }
  const { tx: state, receipt } = await relayer.reconcile(tx.id);
  const now = clock();
  if (state.state === "REVERTED") {
    await database.query(
      "UPDATE permits SET authority_state='INVALIDATED' WHERE permit_id=$1",
      [row.permit_id],
    );
    await database.query(
      "UPDATE tasks SET outcome_state='NEEDS_OWNER',updated_at=$2 WHERE id=$1",
      [row.task_id, now],
    );
    return true;
  }
  const activated = receipt?.logs.some((l) => {
    if (l.address.toLowerCase() !== wallet.toLowerCase()) return false;
    try {
      const e = decodeEventLog({ abi: mandateWalletAbi, ...l });
      return (
        e.eventName === "PermitActivated" && e.args.permitId === row.permit_id
      );
    } catch {
      return false;
    }
  });
  if (!activated || (state.state !== "INCLUDED" && state.state !== "FINALIZED"))
    return false;
  await transaction(database, async (c) => {
    await c.query(
      "UPDATE permits SET authority_state='ACTIVE',activation_tx_hash=$2 WHERE permit_id=$1",
      [row.permit_id, state.tx_hash],
    );
    await c.query("UPDATE permit_drafts SET state='ACTIVATED' WHERE id=$1", [
      draftId,
    ]);
    await c.query(
      "UPDATE tasks SET outcome_state='READY',authority_state='ACTIVE',updated_at=$2 WHERE id=$1",
      [row.task_id, now],
    );
    await appendEvent(
      c,
      {
        taskId: row.task_id,
        type: "PERMIT_ACTIVATED",
        dedupeKey: "permit:" + row.permit_id,
        permitId: row.permit_id,
        payload: { permitId: row.permit_id, txHash: state.tx_hash },
      },
      now,
    );
  });
  return true;
}

type TaskRow = {
  id: string;
  chain_task_id: Hex;
  wallet_id: string;
  outcome_state: string;
  runbook_state: RunbookSnapshot["runbookState"];
  conditions: RunbookSnapshot["conditions"];
  wallet_address: string;
  executor_address: string;
  owner_address: string;
  permit_id: string;
  permit: RunbookSnapshot["permit"];
  scope: RunbookSnapshot["scope"];
  epoch: string;
  policy_version: string;
  inhibited: boolean;
};

// One runbook step under the task's job lease. PROPOSE commits one Action per
// (task, decisionKey); the worker, not the runbook, owns IDs and times.
export async function advanceTask(
  database: Pool,
  client: PublicClient,
  advance: Advance,
  deps: (task: { chainTaskId: Hex; wallet: Hex; asset: Hex }) => RunbookDeps,
  clock: Clock,
  taskId: string,
): Promise<{ done: boolean; runAt?: number }> {
  const t = (
    await database.query<TaskRow>(
      "SELECT t.id,t.chain_task_id,t.wallet_id,t.outcome_state,t.runbook_state,t.conditions,w.wallet_address,w.executor_address,w.owner_address,p.permit_id,p.permit,d.scope,w.epoch::text,w.policy_version::text,w.inhibited FROM tasks t JOIN wallets w ON w.id=t.wallet_id JOIN permits p ON p.task_id=t.id AND p.authority_state='ACTIVE' JOIN permit_drafts d ON d.id=p.draft_id WHERE t.id=$1",
      [taskId],
    )
  ).rows[0];
  if (!t || t.outcome_state !== "RUNNING") return { done: true };
  const policy = (
    await database.query<{
      policy: RunbookSnapshot["walletPolicy"]["policy"];
      lists: RunbookSnapshot["walletPolicy"]["lists"];
    }>(
      "SELECT policy,lists FROM wallet_policies WHERE wallet_id=$1 ORDER BY version DESC LIMIT 1",
      [t.wallet_id],
    )
  ).rows[0];
  const now = clock();
  if (!policy) {
    await database.query(
      "UPDATE tasks SET outcome_state='NEEDS_OWNER',current_step='no confirmed wallet policy',updated_at=$2 WHERE id=$1",
      [taskId, now],
    );
    return { done: true };
  }
  const wallet = getAddress(t.wallet_address);
  const asset = getAddress(t.permit.asset);
  const chain = await readWallet(
    client,
    wallet,
    getAddress(t.executor_address),
    [{ address: asset, symbol: "DUSD" }],
  );
  const primary = chain.assets[0]!;
  const actions = await database.query<{
    decision_key: string;
    action: RunbookSnapshot["actions"][number]["action"];
    state: RunbookSnapshot["actions"][number]["state"];
    tx_hash: Hex | null;
    invoice: RunbookSnapshot["actions"][number]["invoice"];
  }>(
    "SELECT decision_key,action,state,tx_hash,invoice FROM actions WHERE task_id=$1 ORDER BY created_at,id",
    [taskId],
  );
  const approvals = await database.query<{
    approval_id: string;
    action_digest: Hex;
    state: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  }>(
    "SELECT q.approval_id,q.action_digest,q.state FROM approval_requests q JOIN actions a ON a.id=q.action_id WHERE a.task_id=$1",
    [taskId],
  );
  const reserved = (
    await database.query<{ units: string }>(
      "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND state IN ('RESERVED','UNKNOWN') AND kind IN ('OUTFLOW','DEPOSIT')",
      [t.wallet_id],
    )
  ).rows[0]!.units;
  const cap = policy.lists.assetCaps.find((c) => c.asset === asset);
  const remaining =
    (cap ? BigInt(cap.daily) : 0n) - primary.walletGross - BigInt(reserved);
  const floor = BigInt(t.permit.liquidFloor);
  const spendable = primary.liquidUnits - floor - BigInt(reserved);
  const snapshot = RunbookSnapshotSchema.parse({
    taskId,
    chainTaskId: t.chain_task_id,
    walletId: t.wallet_id,
    walletAddress: wallet,
    permitId: t.permit_id,
    conditions: t.conditions,
    scope: t.scope,
    permit: t.permit,
    walletPolicy: policy,
    now: String(now),
    chainBlock: chain.blockNumber.toString(),
    wallet: {
      walletId: t.wallet_id,
      owner: t.owner_address,
      address: wallet,
      chainId: CHAIN_ID,
      provisioningState: "READY",
      executorAddress: t.executor_address,
      paused: chain.paused,
      frozen: chain.frozen,
      epoch: chain.epoch.toString(),
      policyVersion: t.policy_version,
      inhibited: t.inhibited,
      assets: [
        {
          asset,
          symbol: "DUSD",
          liquidUnits: primary.liquidUnits.toString(),
          reservedUnits: reserved,
        },
      ],
      liquidUnits: primary.liquidUnits.toString(),
      floorUnits: floor.toString(),
      reservedUnits: reserved,
      vaultAssetsUnits: primary.vaultAssets.toString(),
      spendableUnits: (spendable > 0n ? spendable : 0n).toString(),
      budgets: {
        day: primary.day.toString(),
        walletSpentUnits: primary.walletGross.toString(),
        executorSpentUnits: primary.executorGross.toString(),
        walletRemainingUnits: (remaining > 0n ? remaining : 0n).toString(),
        executorRemainingUnits: (remaining > 0n ? remaining : 0n).toString(),
      },
      asOfBlock: chain.blockNumber.toString(),
    },
    actions: actions.rows.map((a) => ({
      decisionKey: a.decision_key,
      action: a.action,
      state: a.state,
      txHash: a.tx_hash,
      invoice: a.invoice,
    })),
    observations: [],
    agentAnswers: await answersFor(database, taskId),
    approvals: approvals.rows.map((a) => ({
      approvalId: a.approval_id,
      actionDigest: a.action_digest,
      state: a.state,
    })),
    runbookState: t.runbook_state,
  });
  const decision = await advance(
    snapshot,
    deps({ chainTaskId: t.chain_task_id, wallet, asset }),
  );
  return transaction(database, async (c) => {
    await c.query("SELECT id FROM tasks WHERE id=$1 FOR UPDATE", [taskId]);
    await c.query(
      "UPDATE tasks SET runbook_state=$2,current_step=$3,updated_at=$4 WHERE id=$1",
      [taskId, decision.nextState, decision.type.toLowerCase(), now],
    );
    if ("evidence" in decision)
      for (const [i, payload] of decision.evidence.entries())
        await appendEvent(
          c,
          {
            taskId,
            type: "RUNBOOK_EVIDENCE",
            dedupeKey: `evidence:${decision.nextState.step}:${decision.type}:${i}`,
            payload,
          },
          now,
        );
    switch (decision.type) {
      case "PROPOSE": {
        const intent = decision.intent;
        const deadline = Math.min(
          now + ACTION_SECONDS,
          intent.invoice ? Number(intent.invoice.expiresAt) : Infinity,
        );
        const action = ActionSchema.parse({
          permitId: t.permit_id,
          requestId: "0x" + randomBytes(32).toString("hex"),
          operation: intent.operation,
          target: intent.target,
          amount: intent.amount,
          minOutput: intent.minOutput,
          invoiceId: intent.invoice?.invoiceId ?? ZERO_HASH,
          inputHash: intent.inputHash,
          period: intent.period,
          issuedAt: String(now),
          deadline: String(deadline),
        });
        await c.query(
          "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,invoice,provider_signature,state,created_at,updated_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PROPOSED',$15,$15) ON CONFLICT (task_id,decision_key) DO NOTHING",
          [
            taskId,
            t.wallet_id,
            t.permit_id,
            decision.decisionKey,
            action.requestId,
            action.invoiceId,
            action.operation,
            asset.toLowerCase(),
            action.amount,
            action.period,
            action,
            hashAction(action, walletDomain(wallet)),
            intent.invoice,
            intent.providerSignature,
            now,
          ],
        );
        return { done: true };
      }
      case "WAIT":
        return { done: false, runAt: Number(decision.dueAt) };
      case "AWAIT_AGENT":
        await recordQuestion(
          c,
          { taskId, permitId: t.permit_id, question: decision.question },
          now,
        );
        return { done: true };
      case "COMPLETE":
        await c.query(
          "UPDATE tasks SET outcome_state='COMPLETED',result=$2 WHERE id=$1",
          [taskId, decision.result],
        );
        await appendEvent(
          c,
          {
            taskId,
            type: "TASK_COMPLETED",
            dedupeKey: "complete",
            payload: decision.result,
          },
          now,
        );
        return { done: true };
      case "NEEDS_OWNER":
      case "FAILED":
        await c.query(
          "UPDATE tasks SET outcome_state=$2,current_step=$3 WHERE id=$1",
          [
            taskId,
            decision.type === "FAILED" ? "DELIVERY_FAILED" : "NEEDS_OWNER",
            decision.reason.slice(0, 64),
          ],
        );
        return { done: true };
    }
  });
}

// Re-advances running tasks whose last Action settled or whose question was answered.
export async function scheduleAdvances(
  database: Pool,
  now: number,
): Promise<void> {
  await database.query(
    `INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at)
     SELECT gen_random_uuid(),'task.advance',t.id||':'||(SELECT count(*) FROM actions a WHERE a.task_id=t.id AND a.state IN ('INCLUDED','FINALIZED','DENIED','REJECTED','REVERTED'))||':'||(SELECT count(*) FROM agent_questions q WHERE q.task_id=t.id AND q.state<>'OPEN'),
       jsonb_build_object('taskId',t.id),'READY',$1,100,$1,$1
     FROM tasks t WHERE t.outcome_state='RUNNING'
       AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.task_id=t.id AND a.state IN ('PROPOSED','RESERVED','AWAITING_APPROVAL','SIGNING','SIGNED','SUBMITTED','UNKNOWN'))
       AND NOT EXISTS (SELECT 1 FROM agent_questions q WHERE q.task_id=t.id AND q.state='OPEN')
     ON CONFLICT DO NOTHING`,
    [now],
  );
}
