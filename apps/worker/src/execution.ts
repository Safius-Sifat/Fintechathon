import type { Pool, PoolClient } from "pg";
import {
  BaseError,
  decodeEventLog,
  ExecutionRevertedError,
  RawContractError,
  encodeFunctionData,
  getAddress,
  recoverAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  ActionSchema,
  hashAction,
  InvoiceSchema,
  mandateWalletAbi,
  walletDomain,
  ZERO_HASH,
  type Action,
  type Invoice,
} from "@mandate/schema";
import { transaction, type Clock, type PushSender } from "@mandate/platform";
import { approvalGate } from "./approvals.js";
import type { Relayer } from "./relayer.js";
import {
  reserve,
  ReservationDenied,
  settleReservation,
} from "./reservations.js";

export type AttemptView = {
  actionId: string;
  attemptId: string;
  keyVersion: string;
  executorAddress: string;
  signature: Hex | null;
  state: "PREPARED" | "SIGNING_UNKNOWN" | "SIGNED" | "DENIED" | "ABORTED";
};
export type SigningClient = {
  start(actionId: string): Promise<AttemptView | "BUSY">;
  status(actionId: string): Promise<AttemptView | null>;
};

// Worker-only client for the loopback MPC adapter.
export function adapterClient(url: string, token: string): SigningClient {
  const call = async (method: "GET" | "POST", path: string, body?: unknown) => {
    const response = await fetch(url + path, {
      method,
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    return {
      status: response.status,
      body: response.status < 500 ? await response.json() : null,
    };
  };
  return {
    async start(actionId) {
      const r = await call("POST", "/internal/sign-actions", { actionId });
      if (
        r.status === 409 &&
        (r.body as { reason?: string })?.reason === "executor busy"
      )
        return "BUSY";
      if (r.status !== 202)
        throw new Error(`MPC adapter refused signing (${r.status})`);
      return r.body as AttemptView;
    },
    async status(actionId) {
      const r = await call("GET", `/internal/sign-actions/${actionId}`);
      if (r.status === 404) return null;
      if (r.status !== 200)
        throw new Error(`MPC adapter status unavailable (${r.status})`);
      return r.body as AttemptView;
    },
  };
}

type Row = {
  id: string;
  wallet_id: string;
  permit_id: string;
  state: string;
  action: Action;
  digest: Hex;
  invoice: Invoice | null;
  provider_signature: Hex | null;
  tx_hash: Hex | null;
  amount: string;
  asset: string;
  wallet_address: Address;
  executor_address: Address;
  permit: {
    maxPayment: string;
    spendCap: string;
    liquidFloor: string;
    reviewThreshold: string;
  };
  reservation_state: string | null;
  task_id: string;
  owner_address: string;
  approval_state: string | null;
  approval_expires_at: string | null;
  approval_signature: Hex | null;
};

const APPROVAL_NONE = { actionDigest: ZERO_HASH, expiresAt: 0n };
const EMPTY_INVOICE = {
  invoiceId: ZERO_HASH,
  taskId: ZERO_HASH,
  wallet: "0x0000000000000000000000000000000000000000",
  asset: "0x0000000000000000000000000000000000000000",
  recipient: "0x0000000000000000000000000000000000000000",
  amount: 0n,
  inputHash: ZERO_HASH,
  issuedAt: 0n,
  expiresAt: 0n,
} as const;

// ABI values for the wallet's execute call (uint8/uint32 are numbers in viem).
function executeArgs(row: Row, signature: Hex) {
  const a = ActionSchema.parse(row.action);
  const invoice = row.invoice ? InvoiceSchema.parse(row.invoice) : null;
  return [
    {
      ...a,
      amount: BigInt(a.amount),
      minOutput: BigInt(a.minOutput),
      issuedAt: BigInt(a.issuedAt),
      deadline: BigInt(a.deadline),
    },
    signature,
    invoice
      ? {
          ...invoice,
          amount: BigInt(invoice.amount),
          issuedAt: BigInt(invoice.issuedAt),
          expiresAt: BigInt(invoice.expiresAt),
        }
      : EMPTY_INVOICE,
    row.provider_signature ?? "0x",
    row.approval_state === "APPROVED"
      ? {
          actionDigest: row.digest,
          expiresAt: BigInt(row.approval_expires_at!),
        }
      : APPROVAL_NONE,
    row.approval_state === "APPROVED" ? row.approval_signature! : "0x",
    "0x",
  ] as const;
}

export class Executor {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly relayer: Relayer,
    readonly signing: SigningClient,
    readonly clock: Clock,
    readonly push: PushSender | null = null,
  ) {}

  // Fresh chain state and the owner's co-signature gate every MPC request.
  private async beforeSigning(row: Row) {
    const wallet = getAddress(row.wallet_address);
    const [frozen, paused, inhibited] = await Promise.all([
      this.client.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName: "frozen",
      }),
      this.client.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName: "paused",
      }),
      this.database
        .query<{
          inhibited: boolean;
        }>("SELECT inhibited FROM wallets WHERE id=$1", [row.wallet_id])
        .then((r) => r.rows[0]!.inhibited),
    ]);
    if (frozen || paused) {
      // Nothing is signed yet, so the reservation is released.
      await transaction(this.database, async (c) => {
        await this.setState(
          c,
          row.id,
          ["RESERVED", "AWAITING_APPROVAL"],
          "DENIED",
          { denial: frozen ? "WALLET_FROZEN" : "PERMIT_INACTIVE" },
        );
        await settleReservation(
          c,
          row.id,
          { state: "RELEASED", reason: "DENIED_UNSIGNED" },
          this.clock(),
        );
      });
      return;
    }
    // An off-chain inhibit holds new signing until the owner clears it.
    if (inhibited) return;
    const gate = await transaction(this.database, (c) =>
      approvalGate(
        c,
        {
          id: row.id,
          walletId: row.wallet_id,
          taskId: row.task_id,
          owner: row.owner_address,
          digest: row.digest,
          amount: BigInt(row.amount),
          deadline: BigInt(row.action.deadline),
          permitThreshold: BigInt(row.permit.reviewThreshold),
          requestId: row.action.requestId,
          permitId: row.permit_id,
        },
        this.push,
        this.clock(),
      ),
    );
    if (gate === "PROCEED")
      await this.setState(
        this.database,
        row.id,
        ["RESERVED", "AWAITING_APPROVAL"],
        "SIGNING",
      );
  }

  private async load(actionId: string): Promise<Row> {
    const row = (
      await this.database.query<Row>(
        "SELECT a.id,a.wallet_id,a.permit_id,a.state,a.action,a.digest,a.invoice,a.provider_signature,a.tx_hash,a.amount::text,a.asset,a.task_id,w.wallet_address,w.executor_address,w.owner_address,p.permit,r.state AS reservation_state,q.state AS approval_state,q.expires_at::text AS approval_expires_at,q.owner_signature AS approval_signature FROM actions a JOIN wallets w ON w.id=a.wallet_id JOIN permits p ON p.permit_id=a.permit_id LEFT JOIN reservations r ON r.action_id=a.id LEFT JOIN approval_requests q ON q.action_id=a.id WHERE a.id=$1",
        [actionId],
      )
    ).rows[0];
    if (!row) throw new Error("Unknown action");
    return row;
  }

  private async setState(
    c: PoolClient | Pool,
    actionId: string,
    from: string[],
    to: string,
    extra: { denial?: string; txHash?: Hex } = {},
  ) {
    await c.query(
      "UPDATE actions SET state=$3,denial_code=COALESCE($4,denial_code),tx_hash=COALESCE($5,tx_hash),updated_at=$6 WHERE id=$1 AND state=ANY($2)",
      [
        actionId,
        from,
        to,
        extra.denial ?? null,
        extra.txHash ?? null,
        this.clock(),
      ],
    );
  }

  // One idempotent step; callers repeat it until a terminal or waiting state.
  async advance(actionId: string): Promise<string> {
    const row = await this.load(actionId);
    switch (row.state) {
      case "PROPOSED":
        await this.admit(row);
        break;
      case "RESERVED":
      case "AWAITING_APPROVAL":
        await this.beforeSigning(row);
        break;
      case "SIGNING":
        await this.sign(row);
        break;
      case "SIGNED":
        await this.submit(row);
        break;
      case "SUBMITTED":
      case "INCLUDED":
      case "UNKNOWN":
        await this.reconcile(row);
        break;
      case "DENIED":
      case "REVERTED":
        await this.releaseIfProvenUnusable(row);
        break;
    }
    return (await this.load(actionId)).state;
  }

  private async admit(row: Row) {
    const wallet = getAddress(row.wallet_address);
    const asset = getAddress(row.asset);
    const read = <T>(functionName: string, args: readonly unknown[]) =>
      this.client.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName,
        args,
      } as Parameters<PublicClient["readContract"]>[0]) as Promise<T>;
    const [budget, permit, cap] = await Promise.all([
      read<{ day: bigint; walletGross: bigint; liquidAssets: bigint }>(
        "getBudget",
        [getAddress(row.executor_address), asset],
      ),
      read<{ grossSpend: bigint }>("getPermit", [row.permit_id]),
      read<readonly [bigint, bigint, bigint, boolean]>("assetCap", [asset]),
    ]);
    try {
      await transaction(this.database, async (c) => {
        await reserve(
          c,
          {
            actionId: row.id,
            walletId: row.wallet_id,
            permitId: row.permit_id,
            asset,
            kind: "OUTFLOW",
            amount: BigInt(row.amount),
          },
          {
            day: budget.day,
            permitGross: permit.grossSpend,
            walletDayGross: budget.walletGross,
            liquid: budget.liquidAssets,
          },
          {
            maxPayment: BigInt(row.permit.maxPayment),
            spendCap: BigInt(row.permit.spendCap),
            dailyCap: cap[3] ? cap[1] : 0n,
            liquidFloor: BigInt(row.permit.liquidFloor),
          },
          this.clock(),
        );
        await this.setState(c, row.id, ["PROPOSED"], "RESERVED");
      });
    } catch (error) {
      if (!(error instanceof ReservationDenied)) throw error;
      await this.setState(this.database, row.id, ["PROPOSED"], "DENIED", {
        denial: error.code,
      });
    }
  }

  private async sign(row: Row) {
    let attempt = await this.signing.status(row.id);
    if (!attempt || attempt.state === "ABORTED") {
      const started = await this.signing.start(row.id);
      if (started === "BUSY") return;
      attempt = started;
    }
    if (attempt.state === "DENIED") {
      // No signature exists, so the reservation can be released.
      await transaction(this.database, async (c) => {
        await this.setState(c, row.id, ["SIGNING"], "DENIED", {
          denial: "POLICY_VIOLATION",
        });
        await settleReservation(
          c,
          row.id,
          { state: "RELEASED", reason: "DENIED_UNSIGNED" },
          this.clock(),
        );
      });
      return;
    }
    if (attempt.state !== "SIGNED" || !attempt.signature) return;
    // Recovered independently on the recomputed digest before anything is relayed.
    const digest = hashAction(
      row.action,
      walletDomain(getAddress(row.wallet_address)),
    );
    const signer =
      digest === row.digest
        ? await recoverAddress({ hash: digest, signature: attempt.signature })
        : null;
    if (signer !== getAddress(row.executor_address)) {
      await this.setState(this.database, row.id, ["SIGNING"], "DENIED", {
        denial: "SIGNING_UNKNOWN",
      });
      return;
    }
    await this.setState(this.database, row.id, ["SIGNING"], "SIGNED");
  }

  private async submit(row: Row) {
    const attempt = await this.signing.status(row.id);
    if (attempt?.state !== "SIGNED" || !attempt.signature)
      throw new Error("Signed action lost its signature");
    const call = {
      to: getAddress(row.wallet_address),
      data: encodeFunctionData({
        abi: mandateWalletAbi,
        functionName: "execute",
        args: executeArgs(row, attempt.signature) as never,
      }),
      value: 0n,
    };
    const sender = this.relayer.lanes.normal?.account.address;
    // Exactly one post-sign simulation per attempt, against fresh state.
    try {
      await this.client.call({ account: sender, ...call });
    } catch (error) {
      const reverted =
        error instanceof BaseError &&
        !!error.walk(
          (e) =>
            e instanceof ExecutionRevertedError ||
            e instanceof RawContractError,
        );
      if (!reverted) {
        // RPC unavailable: keep the signed Action and reservation, retry later.
        await this.database.query(
          "UPDATE actions SET denial_code='SIMULATION_UNAVAILABLE',updated_at=$2 WHERE id=$1 AND state='SIGNED'",
          [row.id, this.clock()],
        );
        return;
      }
      // A usable signature exists, so the reservation is kept until chain history
      // proves the Action can no longer execute.
      await this.setState(this.database, row.id, ["SIGNED"], "DENIED", {
        denial: "SIMULATION_REVERT",
      });
      return;
    }
    const quote = await this.relayer.quote("normal", call);
    const tx = await transaction(this.database, async (c) => {
      const journaled = await this.relayer.journal(c, "normal", call, quote, {
        purpose: "EXECUTE",
        actionId: row.id,
        payload: { actionId: row.id, requestId: row.action.requestId },
      });
      await this.setState(c, row.id, ["SIGNED"], "SUBMITTED", {
        txHash: journaled.tx_hash,
      });
      return journaled;
    });
    await this.relayer.broadcast(tx.id);
  }

  private async reconcile(row: Row) {
    const txs = await this.database.query<{ id: string }>(
      "SELECT id FROM transactions WHERE action_id=$1 AND state NOT IN ('REPLACED','DROPPED') ORDER BY journaled_at,id",
      [row.id],
    );
    for (const { id } of txs.rows) {
      const result = await this.relayer.reconcile(id);
      const now = this.clock();
      if (result.reorged) {
        await transaction(this.database, async (c) => {
          await this.setState(
            c,
            row.id,
            ["INCLUDED", "FINALIZED"],
            "SUBMITTED",
          );
          await settleReservation(c, row.id, { state: "UNKNOWN" }, now);
        });
        return;
      }
      const state = result.tx.state;
      if ((state === "INCLUDED" || state === "FINALIZED") && result.receipt) {
        const executed = result.receipt.logs.some((log) => {
          if (log.address.toLowerCase() !== row.wallet_address.toLowerCase())
            return false;
          try {
            const event = decodeEventLog({ abi: mandateWalletAbi, ...log });
            return (
              event.eventName === "ActionExecuted" &&
              (event.args as { requestId: Hex }).requestId ===
                row.action.requestId
            );
          } catch {
            return false;
          }
        });
        if (!executed) continue;
        const block = await this.client.getBlock({
          blockNumber: result.receipt.blockNumber,
        });
        await transaction(this.database, async (c) => {
          await this.setState(
            c,
            row.id,
            ["SUBMITTED", "UNKNOWN", "INCLUDED"],
            state,
            { txHash: result.tx.tx_hash },
          );
          await settleReservation(
            c,
            row.id,
            { state: "INCLUDED", chainDay: block.timestamp / 86400n },
            now,
          );
        });
        return;
      }
      if (state === "REVERTED") {
        await this.setState(
          this.database,
          row.id,
          ["SUBMITTED", "UNKNOWN"],
          "REVERTED",
        );
        return;
      }
      if (state === "UNKNOWN") {
        await transaction(this.database, async (c) => {
          await this.setState(c, row.id, ["SUBMITTED"], "UNKNOWN");
          await settleReservation(c, row.id, { state: "UNKNOWN" }, now);
        });
      }
    }
  }

  // Release needs chain proof: the Action's deadline has passed in a block where
  // its request is still unused, so no copy of the signature can execute.
  private async releaseIfProvenUnusable(row: Row) {
    if (
      row.reservation_state !== "RESERVED" &&
      row.reservation_state !== "UNKNOWN"
    )
      return;
    const block = await this.client.getBlock({ blockTag: "latest" });
    if (block.timestamp <= BigInt(row.action.deadline)) return;
    const used = await this.client.readContract({
      address: getAddress(row.wallet_address),
      abi: mandateWalletAbi,
      functionName: "usedRequest",
      args: [row.action.requestId],
      blockNumber: block.number,
    });
    if (used) return;
    await transaction(this.database, (c) =>
      settleReservation(
        c,
        row.id,
        {
          state: "RELEASED",
          reason:
            row.state === "REVERTED" ? "REVERTED" : "INVALIDATED_RECONCILED",
        },
        this.clock(),
      ),
    );
  }
}

// Advanced effect simulation needs eth_simulateV1; ordinary payments need only eth_call.
export async function simulationCapabilities(
  client: PublicClient,
): Promise<{ ethCall: boolean; simulateV1: boolean }> {
  const probe = (method: string, params: unknown[]) =>
    client.request({ method: method as never, params: params as never }).then(
      () => true,
      (e: { code?: number }) => e?.code !== -32601 && e?.code !== -32602,
    );
  const block = { blockStateCalls: [{ calls: [] }] };
  return {
    ethCall: await probe("eth_call", [
      { to: "0x0000000000000000000000000000000000000000", data: "0x" },
      "latest",
    ]),
    simulateV1: await probe("eth_simulateV1", [block, "latest"]),
  };
}
