import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getAddress, type Hex, type PublicClient } from "viem";
import {
  CreateTaskRequestSchema,
  hashConditions,
  hashDigest,
  hashPermit,
  hashRecipients,
  hashRunbook,
  hashSchedule,
  hashTemplateIds,
  INITIAL_RUNBOOK_STATE,
  mandateWalletAbi,
  OwnerApprovalSchema,
  PermitDraftRequestSchema,
  PermitSchema,
  recoverSigner,
  SignedSubmitSchema,
  typedDataJson,
  walletDomain,
  ZERO_HASH,
  type Conditions,
  type DeploymentManifest,
  type Scope,
} from "@mandate/schema";
import { prepareTask } from "@mandate/runbooks";
import {
  appendEvent,
  idempotentMutation,
  IdempotencyConflict,
  transaction,
  type Clock,
} from "@mandate/platform";
import { AuthError } from "../auth/errors.js";
import {
  requireOwner,
  requireTaskAccess,
  requireWalletAccess,
  scopeDenied,
  type Principal,
} from "./access.js";

const DRAFT_SECONDS = 600;
const conflict = () =>
  new AuthError(
    409,
    "Idempotency key was used with a different body.",
    "DUPLICATE_REQUEST",
  );

type TaskRow = {
  id: string;
  chain_task_id: Hex;
  wallet_id: string;
  owner_address: string;
  runbook_id: Conditions["runbookId"];
  outcome_state: string;
  conditions: Conditions | null;
  scope: Scope | null;
  wallet_address: string | null;
  executor_address: string | null;
  provisioning_state: string;
};

// Task preparation, the owner's Permit approval and the run trigger (S4).
export class TaskService {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient | null,
    readonly manifest: DeploymentManifest | null,
    readonly clock: Clock,
  ) {}

  private async taskRow(taskId: string) {
    return (
      await this.database.query<TaskRow>(
        "SELECT t.id,t.chain_task_id,t.wallet_id,w.owner_address,t.runbook_id,t.outcome_state,t.conditions,t.scope,w.wallet_address,w.executor_address,w.provisioning_state FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1",
        [taskId],
      )
    ).rows[0];
  }

  // Interpretation is Person4's prepareTask; an uninterpretable input is never stored.
  async create(principal: Principal, key: string, input: unknown) {
    const body = CreateTaskRequestSchema.parse(input);
    const wallet = (
      await this.database.query<{
        id: string;
        owner_address: string;
        provisioning_state: string;
      }>(
        "SELECT id,owner_address,provisioning_state FROM wallets WHERE id=$1",
        [body.walletId],
      )
    ).rows[0];
    requireWalletAccess(principal, wallet, "prepare");
    if (wallet!.provisioning_state !== "READY")
      throw new AuthError(
        409,
        "Managed wallet is not ready.",
        "PERMIT_INACTIVE",
      );
    const prepared = prepareTask({
      runbookId: body.runbookId,
      goal: body.goal,
      input: body.input,
    });
    if (!prepared.conditions || !prepared.scope)
      throw new AuthError(
        422,
        prepared.needsOwnerReason ?? "Task input is invalid.",
        "INTENT_INVALID",
      );
    // Provider recipients come from the trusted manifest, never the preparer's defaults.
    const scope = this.manifest
      ? {
          ...prepared.scope,
          providerBindings: prepared.scope.providerBindings.flatMap((b) => {
            const trusted = this.manifest!.providers.find(
              (p) => p.providerId === b.providerId,
            );
            return trusted
              ? [{ providerId: b.providerId, recipient: trusted.recipient }]
              : [];
          }),
        }
      : prepared.scope;
    try {
      const result = await idempotentMutation(
        this.database,
        { tenant: principal.owner, route: "/v1/tasks", key, body },
        this.clock(),
        async (c) => {
          const taskId = randomUUID();
          const now = this.clock();
          await c.query(
            "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,current_step,runbook_state,conditions,scope,needs_owner_reason,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'AWAITING_OWNER','PENDING','prepared',$7,$8,$9,$10,$11,$11)",
            [
              taskId,
              "0x" + randomBytes(32).toString("hex"),
              body.walletId,
              body.runbookId,
              body.goal,
              body.input,
              INITIAL_RUNBOOK_STATE,
              prepared.conditions,
              scope,
              prepared.needsOwnerReason,
              now,
            ],
          );
          return { status: 200, response: { taskId } };
        },
      );
      return result.response.taskId;
    } catch (error) {
      if (error instanceof IdempotencyConflict) throw conflict();
      throw error;
    }
  }

  // The owner's Permit binds the trusted manifest's runbook, never the
  // preparer's placeholder; an unbuilt runbook cannot be approved.
  async draft(principal: Principal, input: unknown) {
    const owner = requireOwner(principal);
    const { taskId, terms } = PermitDraftRequestSchema.parse(input);
    const task = await this.taskRow(taskId);
    requireTaskAccess(owner, task, "prepare");
    const t = task!;
    if (t.outcome_state !== "AWAITING_OWNER" || !t.conditions || !t.scope)
      throw new AuthError(
        409,
        "Task is not awaiting the owner.",
        "PERMIT_INACTIVE",
      );
    if (!this.client || !t.wallet_address || !t.executor_address)
      throw new AuthError(
        503,
        "Chain state is unavailable.",
        "SETTLEMENT_UNKNOWN",
      );
    const runbook = this.manifest?.runbooks.find(
      (r) => r.runbookId === t.runbook_id,
    );
    if (!runbook || runbook.entryArtifactHash === ZERO_HASH)
      throw new AuthError(
        409,
        "The trusted manifest has no built runbook for this task.",
        "RUNBOOK_VERSION",
      );
    const recipients = [...terms.recipients].sort((a, b) =>
      a.toLowerCase() < b.toLowerCase() ? -1 : 1,
    );
    const bound = t.scope.providerBindings
      .map((b) => b.recipient.toLowerCase())
      .sort();
    // Runbooks that pay providers may only pay the providers bound to them.
    if (
      (t.runbook_id === "browser-check" || t.runbook_id === "commerce-buy") &&
      recipients.some((r) => !bound.includes(r.toLowerCase()))
    )
      throw new AuthError(
        422,
        "Recipients must be the task's bound providers.",
        "RECIPIENT_DENIED",
      );
    const wallet = getAddress(t.wallet_address);
    const read = <T>(functionName: string) =>
      this.client!.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName,
      } as Parameters<PublicClient["readContract"]>[0]) as Promise<T>;
    const [epoch, nonce, block] = await Promise.all([
      read<bigint>("authorityEpoch"),
      read<bigint>("permitNonce"),
      this.client.getBlock({ blockTag: "latest" }),
    ]);
    const issuedAt = Math.min(this.clock(), Number(block.timestamp));
    // The signed recipients set is exactly the approved provider bindings.
    const scope: Scope = {
      ...t.scope,
      runbookManifest: runbook,
      providerBindings: t.scope.providerBindings.filter((b) =>
        recipients.some((r) => r.toLowerCase() === b.recipient.toLowerCase()),
      ),
    };
    const permit = PermitSchema.safeParse({
      taskId: t.chain_task_id,
      executor: getAddress(t.executor_address),
      kind: runbook.kind,
      asset: terms.asset,
      runbookHash: hashRunbook(runbook),
      conditionsHash: hashConditions(t.conditions),
      recipientsHash: hashRecipients(recipients),
      scheduleHash: hashSchedule(terms.schedule),
      templatesHash: hashTemplateIds(terms.templateIds),
      issuedAt: String(issuedAt),
      startsAt: terms.startsAt,
      expiresAt: terms.expiresAt,
      epoch: epoch.toString(),
      nonce: nonce.toString(),
      maxActions: terms.maxActions,
      maxPayments: terms.maxPayments,
      maxPayment: terms.maxPayment,
      spendCap: terms.spendCap,
      liquidFloor: terms.liquidFloor,
      depositCap: terms.depositCap,
      withdrawCap: terms.withdrawCap,
      reviewThreshold: terms.reviewThreshold,
      periodCap: terms.periodCap,
      periodSeconds: terms.periodSeconds,
    });
    if (!permit.success)
      throw new AuthError(
        422,
        "Terms do not form a valid Permit.",
        "INTENT_INVALID",
      );
    const policy = (
      await this.database.query<{
        version: string;
        lists: {
          assetCaps: { asset: string; perTx: string }[];
          blocklist: string[];
        };
      }>(
        "SELECT version::text,lists FROM wallet_policies WHERE wallet_id=$1 ORDER BY version DESC LIMIT 1",
        [t.wallet_id],
      )
    ).rows[0];
    const cap = policy?.lists.assetCaps.find(
      (c) => c.asset.toLowerCase() === terms.asset.toLowerCase(),
    );
    if (
      !cap ||
      BigInt(terms.maxPayment) > BigInt(cap.perTx) ||
      recipients.some((r) =>
        policy!.lists.blocklist.some(
          (b) => b.toLowerCase() === r.toLowerCase(),
        ),
      )
    )
      throw new AuthError(
        422,
        "Terms exceed the confirmed wallet policy.",
        "POLICY_VIOLATION",
      );
    const domain = walletDomain(wallet);
    const typedData = typedDataJson("Permit", permit.data, domain);
    const digest = hashDigest("Permit", permit.data, domain);
    const draftId = randomUUID();
    const now = this.clock();
    await transaction(this.database, async (c) => {
      // One outstanding draft per wallet: a newer draft supersedes the old one.
      await c.query(
        "UPDATE permit_drafts SET state='SUPERSEDED' WHERE wallet_id=$1 AND state='PENDING'",
        [t.wallet_id],
      );
      await c.query(
        "INSERT INTO permit_drafts(id,wallet_id,task_id,typed_data,scope,digest,permit_id,nonce,epoch,state,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10,$11)",
        [
          draftId,
          t.wallet_id,
          taskId,
          typedData,
          scope,
          digest,
          hashPermit(permit.data),
          nonce.toString(),
          epoch.toString(),
          now + DRAFT_SECONDS,
          now,
        ],
      );
    });
    return OwnerApprovalSchema.parse({
      draftId,
      typedData,
      scope,
      recipients,
      schedule: terms.schedule,
      templateIds: terms.templateIds,
      digest,
      policyVersion: policy!.version,
      intentId: null,
    });
  }

  // Verifies the owner's Permit signature on the unchanged draft and queues the
  // sponsored activatePermit relay; authority is ACTIVE only after the receipt.
  async activate(principal: Principal, input: unknown) {
    const owner = requireOwner(principal);
    const body = SignedSubmitSchema.parse(input);
    const draft = (
      await this.database.query<{
        wallet_id: string;
        task_id: string;
        typed_data: { message: unknown; domain: unknown };
        permit_id: string;
        state: string;
        expires_at: string;
        owner_address: string;
      }>(
        "SELECT d.wallet_id,d.task_id,d.typed_data,d.permit_id,d.state,d.expires_at::text,w.owner_address FROM permit_drafts d JOIN wallets w ON w.id=d.wallet_id WHERE d.id=$1",
        [body.draftId],
      )
    ).rows[0];
    if (!draft || draft.owner_address !== owner.owner) throw scopeDenied();
    const existing = (
      await this.database.query<{
        owner_signature: string;
        authority_state: string;
        tx_hash: string | null;
      }>(
        "SELECT p.owner_signature,p.authority_state,t.tx_hash FROM permits p LEFT JOIN transactions t ON t.purpose='ACTIVATE' AND t.payload->>'draftId'=$2 WHERE p.permit_id=$1",
        [draft.permit_id, body.draftId],
      )
    ).rows[0];
    if (existing) {
      if (existing.owner_signature !== body.ownerSignature) throw conflict();
      return {
        permitId: draft.permit_id,
        activationTxHash: existing.tx_hash,
        authorityState: existing.authority_state,
      };
    }
    if (draft.state !== "PENDING" || this.clock() >= Number(draft.expires_at))
      throw new AuthError(
        409,
        "Draft is no longer pending.",
        "PERMIT_INACTIVE",
      );
    const permit = PermitSchema.parse(draft.typed_data.message);
    let signer: string;
    try {
      signer = (
        await recoverSigner(
          "Permit",
          permit,
          draft.typed_data.domain,
          body.ownerSignature as Hex,
        )
      ).toLowerCase();
    } catch {
      throw new AuthError(422, "Owner signature is invalid.", "INTENT_INVALID");
    }
    if (signer !== owner.owner || hashPermit(permit) !== draft.permit_id)
      throw new AuthError(
        422,
        "Signature is not the owner's over this draft.",
        "INTENT_INVALID",
      );
    const now = this.clock();
    await transaction(this.database, async (c) => {
      await c.query(
        "INSERT INTO permits(permit_id,wallet_id,task_id,draft_id,permit,owner_signature,authority_state,spend_cap,period_cap,period_seconds,max_payment,created_at) VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,$10,$11)",
        [
          draft.permit_id,
          draft.wallet_id,
          draft.task_id,
          body.draftId,
          permit,
          body.ownerSignature,
          permit.spendCap,
          permit.periodCap,
          permit.periodSeconds,
          permit.maxPayment,
          now,
        ],
      );
      await c.query(
        "INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at) VALUES($1,'permit.activate',$2,$3,'READY',$4,20,$4,$4)",
        [randomUUID(), body.draftId, { draftId: body.draftId }, now],
      );
    });
    return {
      permitId: draft.permit_id,
      activationTxHash: null,
      authorityState: "PENDING",
    };
  }

  async run(principal: Principal, taskId: string) {
    const task = await this.taskRow(taskId);
    requireTaskAccess(principal, task, "run");
    const now = this.clock();
    return transaction(this.database, async (c) => {
      const updated = await c.query(
        "UPDATE tasks SET outcome_state='RUNNING',updated_at=$2 WHERE id=$1 AND outcome_state='READY' AND authority_state='ACTIVE'",
        [taskId, now],
      );
      const state = (
        await c.query<{ outcome_state: string }>(
          "SELECT outcome_state FROM tasks WHERE id=$1",
          [taskId],
        )
      ).rows[0]!.outcome_state;
      if (
        !updated.rowCount &&
        state !== "RUNNING" &&
        state !== "AWAITING_AGENT"
      )
        throw new AuthError(
          409,
          "Task has no active Permit to run under.",
          "PERMIT_INACTIVE",
        );
      if (updated.rowCount) {
        await c.query(
          "INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at) VALUES($1,'task.advance',$2,$3,'READY',$4,100,$4,$4) ON CONFLICT DO NOTHING",
          [randomUUID(), "run:" + taskId, { taskId }, now],
        );
        await appendEvent(
          c,
          { taskId, type: "TASK_RUN", dedupeKey: "run", payload: {} },
          now,
        );
      }
      return taskId;
    });
  }
}
