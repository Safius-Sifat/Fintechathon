import { randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Address, PublicClient } from "viem";
import {
  AgentTokenRequestSchema,
  CHAIN_ID,
  TaskViewSchema,
  WalletViewSchema,
  type TaskView,
  type WalletView,
} from "@mandate/schema";
import {
  enqueueJob,
  exportBundle,
  type EvidenceKey,
  idempotentMutation,
  IdempotencyConflict,
  readWallet,
  type Clock,
} from "@mandate/platform";
import { AuthError } from "../auth/errors.js";
import type { AuthService } from "../auth/service.js";
import {
  AGENT_TOKEN_PREFIX,
  authenticate,
  hashToken,
  requireOwner,
  requireTaskAccess,
  requireWalletAccess,
  scopeDenied,
  type Principal,
} from "./access.js";

export type ChainDependency = {
  client: PublicClient;
  // Agent assets from the trusted deployment manifest; the first is DemoUSD.
  assets: readonly { address: Address; symbol: string }[];
};
export type EvidenceDependency = {
  artifactKey: Buffer;
  key: EvidenceKey;
};
export type BusinessDependencies = {
  chain: ChainDependency | null;
  evidence?: EvidenceDependency | null;
};

type WalletRow = {
  id: string;
  owner_address: string;
  provisioning_state: WalletView["provisioningState"];
  wallet_address: string | null;
  executor_address: string | null;
  paused: boolean;
  frozen: boolean;
  inhibited: boolean;
  epoch: string;
  policy_version: string;
};
type TaskRow = {
  id: string;
  chain_task_id: string;
  wallet_id: string;
  owner_address: string;
  runbook_id: TaskView["runbookId"];
  outcome_state: TaskView["outcomeState"];
  authority_state: TaskView["authorityState"];
  current_step: string;
  runbook_state: { delivery?: unknown };
  result: TaskView["result"];
};

const MAX_AGENT_TOKEN_SECONDS = 30 * 86400;
const ZERO = "0";
const max0 = (v: bigint) => (v > 0n ? v : 0n);

export const conflict = () =>
  new AuthError(
    409,
    "Idempotency key was used with a different body.",
    "DUPLICATE_REQUEST",
  );

export class BusinessService {
  constructor(
    readonly database: Pool,
    readonly auth: AuthService,
    readonly deps: BusinessDependencies,
    readonly clock: Clock,
  ) {}

  principal(authorization: string | undefined): Promise<Principal> {
    return authenticate(this.database, this.auth, authorization, this.clock());
  }

  private async mutate<T extends Record<string, unknown>>(
    principal: Principal,
    route: string,
    key: string,
    body: unknown,
    apply: (client: PoolClient) => Promise<{ status: number; response: T }>,
  ) {
    try {
      return await idempotentMutation(
        this.database,
        { tenant: principal.owner, route, key, body },
        this.clock(),
        apply,
      );
    } catch (error) {
      if (error instanceof IdempotencyConflict) throw conflict();
      throw error;
    }
  }

  // One managed wallet per owner. Provisioning runs as a durable job; the API
  // never returns an address before the factory deployment is verified.
  async createWallet(principal: Principal, key: string) {
    const owner = requireOwner(principal);
    const result = await this.mutate(
      owner,
      "/v1/wallets",
      key,
      {},
      async (client) => {
        const now = this.clock();
        await client.query(
          "SELECT owner_address FROM owner_identities WHERE owner_address=$1 FOR UPDATE",
          [owner.owner],
        );
        let wallet = (
          await client.query<WalletRow>(
            "SELECT * FROM wallets WHERE owner_address=$1",
            [owner.owner],
          )
        ).rows[0];
        if (!wallet) {
          wallet = (
            await client.query<WalletRow>(
              "INSERT INTO wallets(id,owner_address,provisioning_state,created_at,updated_at) VALUES($1,$2,'DEPLOYING',$3,$3) RETURNING *",
              [randomUUID(), owner.owner, now],
            )
          ).rows[0]!;
          await enqueueJob(
            client,
            {
              kind: "wallet.provision",
              dedupeKey: wallet.id,
              payload: { walletId: wallet.id },
              runAt: now,
            },
            now,
          );
        }
        return { status: 200, response: { walletId: wallet.id } };
      },
    );
    return this.wallet(principal, result.response.walletId);
  }

  async wallet(principal: Principal, walletId: string): Promise<WalletView> {
    const row = (
      await this.database.query<WalletRow>(
        "SELECT * FROM wallets WHERE id=$1",
        [walletId],
      )
    ).rows[0];
    return this.walletView(
      requireWalletAccess(principal, row, "read") as WalletRow,
    );
  }

  private async walletView(row: WalletRow): Promise<WalletView> {
    const base = {
      walletId: row.id,
      owner: row.owner_address,
      address: row.wallet_address,
      chainId: CHAIN_ID,
      provisioningState: row.provisioning_state,
      executorAddress: row.executor_address,
      epoch: row.epoch,
      policyVersion: row.policy_version,
      inhibited: row.inhibited,
    };
    if (row.provisioning_state !== "READY")
      return WalletViewSchema.parse({
        ...base,
        paused: row.paused,
        frozen: row.frozen,
        assets: [],
        liquidUnits: ZERO,
        floorUnits: ZERO,
        reservedUnits: ZERO,
        vaultAssetsUnits: ZERO,
        spendableUnits: ZERO,
        budgets: {
          day: ZERO,
          walletSpentUnits: ZERO,
          executorSpentUnits: ZERO,
          walletRemainingUnits: ZERO,
          executorRemainingUnits: ZERO,
        },
        asOfBlock: ZERO,
      });
    const chain = this.deps.chain;
    if (!chain)
      throw new AuthError(
        503,
        "Chain state is unavailable; balances are not shown.",
        "SETTLEMENT_UNKNOWN",
      );
    const state = await readWallet(
      chain.client,
      row.wallet_address as Address,
      row.executor_address as Address,
      chain.assets,
    ).catch(() => {
      throw new AuthError(
        503,
        "Chain state is unavailable; balances are not shown.",
        "SETTLEMENT_UNKNOWN",
      );
    });
    if (state.owner.toLowerCase() !== row.owner_address)
      throw new AuthError(
        503,
        "On-chain owner does not match the registered wallet.",
        "SETTLEMENT_UNKNOWN",
      );
    const reserved = await this.database.query<{
      asset: string;
      units: string;
    }>(
      "SELECT asset,COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND state IN ('RESERVED','UNKNOWN') AND kind IN ('OUTFLOW','DEPOSIT') GROUP BY asset",
      [row.id],
    );
    const reservedBy = new Map(
      reserved.rows.map((r) => [r.asset, BigInt(r.units)]),
    );
    const primary = state.assets[0]!;
    const unincluded = await this.database.query<{ units: string }>(
      "SELECT COALESCE(sum(amount),0)::text AS units FROM reservations WHERE wallet_id=$1 AND asset=$2 AND kind='OUTFLOW' AND state IN ('RESERVED','UNKNOWN') AND chain_day=$3",
      [row.id, primary.asset.toLowerCase(), primary.day.toString()],
    );
    const floor = await this.database.query<{ units: string }>(
      "SELECT COALESCE(max((permit->>'liquidFloor')::numeric),0)::text AS units FROM permits WHERE wallet_id=$1 AND authority_state='ACTIVE' AND lower(permit->>'asset')=$2",
      [row.id, primary.asset.toLowerCase()],
    );
    const pending = BigInt(unincluded.rows[0]!.units);
    const reservedUnits = reservedBy.get(primary.asset.toLowerCase()) ?? 0n;
    const floorUnits = BigInt(floor.rows[0]!.units);
    const walletSpent = primary.walletGross + pending;
    const executorSpent = primary.executorGross + pending;
    const cap = primary.dailyCap ?? 0n;
    return WalletViewSchema.parse({
      ...base,
      paused: state.paused,
      frozen: state.frozen,
      epoch: state.epoch.toString(),
      assets: state.assets.map((a) => ({
        asset: a.asset,
        symbol: a.symbol,
        liquidUnits: a.liquidUnits.toString(),
        reservedUnits: (reservedBy.get(a.asset.toLowerCase()) ?? 0n).toString(),
      })),
      liquidUnits: primary.liquidUnits.toString(),
      floorUnits: floorUnits.toString(),
      reservedUnits: reservedUnits.toString(),
      vaultAssetsUnits: primary.vaultAssets.toString(),
      spendableUnits: max0(
        primary.liquidUnits - floorUnits - reservedUnits,
      ).toString(),
      budgets: {
        day: primary.day.toString(),
        walletSpentUnits: walletSpent.toString(),
        executorSpentUnits: executorSpent.toString(),
        walletRemainingUnits: max0(cap - walletSpent).toString(),
        executorRemainingUnits: max0(cap - executorSpent).toString(),
      },
      asOfBlock: state.blockNumber.toString(),
    });
  }

  // The 32-byte token is revealed once; only its SHA-256 is stored, so a replayed
  // idempotency key cannot return it again.
  async createAgentToken(principal: Principal, key: string, input: unknown) {
    const owner = requireOwner(principal);
    const body = AgentTokenRequestSchema.parse(input);
    let token: string | null = null;
    const result = await this.mutate(
      owner,
      "/v1/agent-tokens",
      key,
      body,
      async (client) => {
        const now = this.clock();
        const expiresAt = Number(body.expiresAt);
        if (expiresAt <= now || expiresAt > now + MAX_AGENT_TOKEN_SECONDS)
          throw new AuthError(
            422,
            "Agent token expiry must be within 30 days.",
            "AUTH_SCOPE",
          );
        const wallet = (
          await client.query<{ id: string; owner_address: string }>(
            "SELECT id,owner_address FROM wallets WHERE id=$1",
            [body.walletId],
          )
        ).rows[0];
        requireWalletAccess(owner, wallet, "read");
        if (body.taskId !== null) {
          const task = await client.query(
            "SELECT 1 FROM tasks WHERE id=$1 AND wallet_id=$2",
            [body.taskId, body.walletId],
          );
          if (task.rowCount !== 1) throw scopeDenied();
        }
        const id = randomUUID();
        token = AGENT_TOKEN_PREFIX + randomBytes(32).toString("base64url");
        await client.query(
          "INSERT INTO agent_tokens(id,token_hash,owner_address,wallet_id,task_id,scopes,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            hashToken(token),
            owner.owner,
            body.walletId,
            body.taskId,
            body.scopes,
            expiresAt,
            now,
          ],
        );
        return { status: 200, response: { id } };
      },
    );
    if (result.replayed || token === null)
      throw new AuthError(
        409,
        "This agent token was already issued and is revealed only once; revoke it and create another.",
        "DUPLICATE_REQUEST",
      );
    return { id: result.response.id, token };
  }

  async revokeAgentToken(principal: Principal, key: string, tokenId: string) {
    const owner = requireOwner(principal);
    const result = await this.mutate(
      owner,
      "/v1/agent-tokens/:tokenId",
      key,
      { tokenId },
      async (client) => {
        const revoked = await client.query(
          "UPDATE agent_tokens SET revoked_at=COALESCE(revoked_at,$3) WHERE id=$1 AND owner_address=$2",
          [tokenId, owner.owner, this.clock()],
        );
        if (revoked.rowCount !== 1) throw scopeDenied();
        return { status: 200, response: { revoked: true } };
      },
    );
    return result.response;
  }

  async task(principal: Principal, taskId: string): Promise<TaskView> {
    const row = (
      await this.database.query<TaskRow>(
        "SELECT t.*,w.owner_address FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1",
        [taskId],
      )
    ).rows[0];
    const task = requireTaskAccess(principal, row, "read") as TaskRow;
    const payments = await this.database.query<{
      id: string;
      request_id: string;
      provider_id: string | null;
      amount: string;
      tx_hash: string | null;
      state: TaskView["payments"][number]["chainState"];
    }>(
      "SELECT a.id,a.request_id,b.value->>'providerId' AS provider_id,a.amount::text,a.tx_hash,a.state FROM actions a JOIN permit_drafts d ON d.task_id=a.task_id AND d.state='ACTIVATED' LEFT JOIN LATERAL jsonb_array_elements(d.scope->'providerBindings') b ON lower(b.value->>'recipient')=lower(a.invoice->>'recipient') WHERE a.task_id=$1 AND a.operation IN (0,6) ORDER BY a.created_at,a.id",
      [task.id],
    );
    const gross = await this.database.query<{ units: string }>(
      "SELECT COALESCE(sum(r.amount),0)::text AS units FROM reservations r JOIN actions a ON a.id=r.action_id WHERE a.task_id=$1 AND r.kind='OUTFLOW' AND r.state IN ('RESERVED','UNKNOWN','INCLUDED')",
      [task.id],
    );
    return TaskViewSchema.parse({
      taskId: task.id,
      chainTaskId: task.chain_task_id,
      walletId: task.wallet_id,
      runbookId: task.runbook_id,
      outcomeState: task.outcome_state,
      authorityState: task.authority_state,
      currentStep: task.current_step,
      grossSpendUnits: gross.rows[0]!.units,
      payments: payments.rows.map((p) => ({
        actionId: p.id,
        requestId: p.request_id,
        providerId: p.provider_id,
        amountUnits: p.amount,
        txHash: p.tx_hash,
        chainState: p.state,
      })),
      // Delivery is VALID only after worker verification of the signed receipt.
      delivery: {
        state: task.runbook_state.delivery ? "PENDING" : "NONE",
        result: null,
      },
      result: task.result,
      // Backend findings are assertions; the independent verifier decides PASS.
      findings: [],
      nextPollMs: 2000,
    });
  }

  // Authenticated export only; requires the explicit evidence scope.
  async evidence(principal: Principal, taskId: string) {
    const row = (
      await this.database.query<{
        id: string;
        wallet_id: string;
        owner_address: string;
      }>(
        "SELECT t.id,t.wallet_id,w.owner_address FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1",
        [taskId],
      )
    ).rows[0];
    requireTaskAccess(principal, row, "evidence");
    const evidence = this.deps.evidence;
    if (!evidence)
      throw new AuthError(
        503,
        "Evidence keys are not configured.",
        "EVIDENCE_UNAVAILABLE",
      );
    try {
      return await exportBundle(
        this.database,
        evidence.artifactKey,
        evidence.key,
        taskId,
      );
    } catch {
      throw new AuthError(
        503,
        "Evidence export is unavailable for this task.",
        "EVIDENCE_UNAVAILABLE",
      );
    }
  }
}
