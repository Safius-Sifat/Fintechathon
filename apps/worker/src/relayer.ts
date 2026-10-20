import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import { estimateL1Fee } from "viem/op-stack";
import { transaction, type Clock } from "@mandate/platform";

export type LaneName = "normal" | "emergency" | "anchor";
export type LaneConfig = {
  account: LocalAccount;
  perTxBudgetWei: bigint;
  dailyBudgetWei: bigint;
};
// Admission budgets (P2-04): 0.0005 ETH per transaction and 0.02 ETH per day in
// total, of which 0.002 ETH is the emergency partition and 0.002 ETH anchoring.
export const DEFAULT_BUDGETS: Record<
  LaneName,
  { perTxBudgetWei: bigint; dailyBudgetWei: bigint }
> = {
  normal: {
    perTxBudgetWei: 500_000_000_000_000n,
    dailyBudgetWei: 16_000_000_000_000_000n,
  },
  emergency: {
    perTxBudgetWei: 500_000_000_000_000n,
    dailyBudgetWei: 2_000_000_000_000_000n,
  },
  anchor: {
    perTxBudgetWei: 500_000_000_000_000n,
    dailyBudgetWei: 2_000_000_000_000_000n,
  },
};
export const CONFIRMATIONS = 3n;
const UNKNOWN_AFTER_SECONDS = 60;

export type Call = { to: Address; data: Hex; value: bigint };
export type Quote = {
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  l1FeeWei: bigint;
  estimatedFeeWei: bigint;
};
export type Purpose =
  | "EXECUTE"
  | "ADMIN"
  | "OWNER_TRANSFER"
  | "POLICY"
  | "ACTIVATE"
  | "CREATE_WALLET"
  | "ANCHOR";
export type TxState =
  | "JOURNALED"
  | "BROADCAST"
  | "UNKNOWN"
  | "INCLUDED"
  | "FINALIZED"
  | "REVERTED"
  | "REPLACED"
  | "DROPPED";
export type TxRow = {
  id: string;
  lane: LaneName;
  sender: string;
  nonce: string;
  raw: Hex;
  tx_hash: Hex;
  state: TxState;
  purpose: Purpose;
  action_id: string | null;
  replaces: string | null;
  block_number: string | null;
  block_hash: string | null;
  actual_fee_wei: string | null;
  broadcast_at: string | null;
  payload: Record<string, unknown>;
};
export type Reconciled = {
  tx: TxRow;
  // A previously included receipt left the canonical chain.
  reorged: boolean;
  receipt: TransactionReceipt | null;
};

export class FeeBudgetExceeded extends Error {}
export class LaneUnavailable extends Error {}

export class Relayer {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly chainId: number,
    readonly lanes: Partial<Record<LaneName, LaneConfig>>,
    readonly clock: Clock,
  ) {}

  private lane(name: LaneName): LaneConfig {
    const lane = this.lanes[name];
    if (!lane)
      throw new LaneUnavailable(`Sender lane ${name} is not configured`);
    return lane;
  }

  // Registers configured lanes. An existing lane whose on-chain nonce moved past
  // the journal means another process used the sender; that needs reconciliation.
  async register(): Promise<void> {
    for (const [name, lane] of Object.entries(this.lanes) as [
      LaneName,
      LaneConfig,
    ][]) {
      const chainNonce = BigInt(
        await this.client.getTransactionCount({
          address: lane.account.address,
          blockTag: "pending",
        }),
      );
      await transaction(this.database, async (c) => {
        const row = (
          await c.query<{ sender: string; next_nonce: string }>(
            "SELECT sender,next_nonce FROM sender_lanes WHERE lane=$1 FOR UPDATE",
            [name],
          )
        ).rows[0];
        const sender = lane.account.address.toLowerCase();
        if (!row) {
          await c.query(
            "INSERT INTO sender_lanes(lane,sender,next_nonce,daily_budget_wei,per_tx_budget_wei) VALUES($1,$2,$3,$4,$5)",
            [
              name,
              sender,
              chainNonce.toString(),
              lane.dailyBudgetWei.toString(),
              lane.perTxBudgetWei.toString(),
            ],
          );
          return;
        }
        if (row.sender !== sender)
          throw new Error(`Lane ${name} is bound to another sender`);
        if (chainNonce > BigInt(row.next_nonce))
          throw new Error(
            `Lane ${name} sender nonce advanced outside the journal; reconcile before use`,
          );
      });
    }
  }

  async quote(name: LaneName, call: Call): Promise<Quote> {
    const lane = this.lane(name);
    const [gas, fees] = await Promise.all([
      this.client.estimateGas({
        account: lane.account.address,
        to: call.to,
        data: call.data,
        value: call.value,
      }),
      this.client.estimateFeesPerGas(),
    ]);
    let l1FeeWei = 0n;
    if (this.chainId === 84532)
      l1FeeWei = await estimateL1Fee(this.client, {
        account: lane.account.address,
        to: call.to,
        data: call.data,
        value: call.value,
        chain: null,
      });
    // Estimate is an admission bound, not a guarantee of the final L1 charge.
    const estimatedFeeWei =
      ((gas * fees.maxFeePerGas + l1FeeWei) * 120n) / 100n;
    return {
      gas: (gas * 120n) / 100n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      l1FeeWei,
      estimatedFeeWei,
    };
  }

  // Signs and journals inside the caller's transaction, before any broadcast, so a
  // crash after commit can only rebroadcast these exact bytes.
  async journal(
    c: PoolClient,
    name: LaneName,
    call: Call,
    quote: Quote,
    meta: {
      purpose: Purpose;
      actionId: string | null;
      payload: Record<string, unknown>;
    },
  ): Promise<TxRow> {
    const lane = this.lane(name);
    const now = this.clock();
    const row = (
      await c.query<{
        sender: string;
        next_nonce: string;
        daily_budget_wei: string;
        per_tx_budget_wei: string;
      }>(
        "SELECT sender,next_nonce,daily_budget_wei,per_tx_budget_wei FROM sender_lanes WHERE lane=$1 FOR UPDATE",
        [name],
      )
    ).rows[0];
    if (!row || row.sender !== lane.account.address.toLowerCase())
      throw new LaneUnavailable(`Sender lane ${name} is not registered`);
    await this.admitFee(
      c,
      name,
      quote.estimatedFeeWei,
      BigInt(row.per_tx_budget_wei),
      BigInt(row.daily_budget_wei),
      now,
    );
    const nonce = BigInt(row.next_nonce);
    const tx = await this.sign(lane, call, quote, nonce);
    const inserted = await this.insert(
      c,
      name,
      row.sender,
      nonce,
      tx,
      quote,
      meta,
      null,
      now,
    );
    await c.query(
      "UPDATE sender_lanes SET next_nonce=next_nonce+1 WHERE lane=$1",
      [name],
    );
    return inserted;
  }

  private async admitFee(
    c: PoolClient,
    name: LaneName,
    estimate: bigint,
    perTx: bigint,
    daily: bigint,
    now: number,
  ) {
    if (estimate > perTx)
      throw new FeeBudgetExceeded(
        `Estimated fee exceeds the ${name} per-transaction budget`,
      );
    const spent = (
      await c.query<{ wei: string }>(
        "SELECT COALESCE(sum(COALESCE(actual_fee_wei,estimated_fee_wei)),0)::text AS wei FROM transactions WHERE lane=$1 AND fee_day=$2 AND state NOT IN ('REPLACED','DROPPED')",
        [name, Math.floor(now / 86400)],
      )
    ).rows[0]!;
    if (BigInt(spent.wei) + estimate > daily)
      throw new FeeBudgetExceeded(
        `The ${name} lane daily fee budget is exhausted`,
      );
  }

  private async sign(
    lane: LaneConfig,
    call: Call,
    quote: Quote,
    nonce: bigint,
  ) {
    const raw = await lane.account.signTransaction({
      chainId: this.chainId,
      type: "eip1559",
      to: call.to,
      data: call.data,
      value: call.value,
      nonce: Number(nonce),
      gas: quote.gas,
      maxFeePerGas: quote.maxFeePerGas,
      maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
    });
    return { raw, hash: keccak256(raw) };
  }

  private async insert(
    c: PoolClient,
    lane: LaneName,
    sender: string,
    nonce: bigint,
    tx: { raw: Hex; hash: Hex },
    quote: Quote,
    meta: {
      purpose: Purpose;
      actionId: string | null;
      payload: Record<string, unknown>;
    },
    replaces: string | null,
    now: number,
  ): Promise<TxRow> {
    return (
      await c.query<TxRow>(
        "INSERT INTO transactions(id,lane,sender,nonce,chain_id,action_id,purpose,raw,tx_hash,payload,replaces,state,estimated_fee_wei,fee_day,journaled_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'JOURNALED',$12,$13,$14,$14) RETURNING *",
        [
          randomUUID(),
          lane,
          sender,
          nonce.toString(),
          this.chainId,
          meta.actionId,
          meta.purpose,
          tx.raw,
          tx.hash,
          meta.payload,
          replaces,
          quote.estimatedFeeWei.toString(),
          Math.floor(now / 86400),
          now,
        ],
      )
    ).rows[0]!;
  }

  // Broadcasts the journaled bytes. A lost response is UNKNOWN, never a reason to
  // sign a new transaction; retries resend identical bytes.
  async broadcast(txId: string): Promise<TxState> {
    const tx = await this.load(txId);
    if (!["JOURNALED", "BROADCAST", "UNKNOWN"].includes(tx.state))
      return tx.state;
    const now = this.clock();
    try {
      const hash = await this.client.sendRawTransaction({
        serializedTransaction: tx.raw,
      });
      if (hash.toLowerCase() !== tx.tx_hash)
        throw new Error("RPC returned a different transaction hash");
    } catch {
      // Error text varies by node; an earlier broadcast reached it if it knows the hash.
      const known = await this.client.getTransaction({ hash: tx.tx_hash }).then(
        () => true,
        () => false,
      );
      if (!known) {
        await this.database.query(
          "UPDATE transactions SET state='UNKNOWN',broadcast_at=COALESCE(broadcast_at,$2),updated_at=$2 WHERE id=$1 AND state IN ('JOURNALED','BROADCAST','UNKNOWN')",
          [txId, now],
        );
        return "UNKNOWN";
      }
    }
    await this.database.query(
      "UPDATE transactions SET state='BROADCAST',broadcast_at=COALESCE(broadcast_at,$2),updated_at=$2 WHERE id=$1 AND state IN ('JOURNALED','BROADCAST','UNKNOWN')",
      [txId, now],
    );
    return "BROADCAST";
  }

  // Fee replacement keeps the nonce and business calldata; both hashes stay in the lineage.
  async replace(txId: string, call: Call, bumpPercent = 25n): Promise<TxRow> {
    const original = await this.load(txId);
    const lane = this.lane(original.lane);
    return transaction(this.database, async (c) => {
      const prior = (
        await c.query<{ estimated_fee_wei: string }>(
          "SELECT estimated_fee_wei FROM transactions WHERE id=$1 FOR UPDATE",
          [txId],
        )
      ).rows[0]!;
      const parsed = await this.client
        .getTransaction({ hash: original.tx_hash })
        .catch(() => null);
      const base = await this.quote(original.lane, call);
      const bump = (v: bigint) => (v * (100n + bumpPercent)) / 100n;
      const quote: Quote = {
        ...base,
        gas: parsed?.gas ?? base.gas,
        maxFeePerGas: bump(parsed?.maxFeePerGas ?? base.maxFeePerGas),
        maxPriorityFeePerGas: bump(
          parsed?.maxPriorityFeePerGas ?? base.maxPriorityFeePerGas,
        ),
      };
      quote.estimatedFeeWei =
        ((quote.gas * quote.maxFeePerGas + quote.l1FeeWei) * 120n) / 100n;
      const now = this.clock();
      const row = (
        await c.query<{ daily_budget_wei: string; per_tx_budget_wei: string }>(
          "SELECT daily_budget_wei,per_tx_budget_wei FROM sender_lanes WHERE lane=$1 FOR UPDATE",
          [original.lane],
        )
      ).rows[0]!;
      // The replaced estimate stops counting once the replacement exists.
      await this.admitFee(
        c,
        original.lane,
        quote.estimatedFeeWei - BigInt(prior.estimated_fee_wei),
        BigInt(row.per_tx_budget_wei),
        BigInt(row.daily_budget_wei),
        now,
      );
      const tx = await this.sign(lane, call, quote, BigInt(original.nonce));
      const root = original.replaces ?? original.id;
      return this.insert(
        c,
        original.lane,
        original.sender,
        BigInt(original.nonce),
        tx,
        quote,
        {
          purpose: original.purpose,
          actionId: original.action_id,
          payload: original.payload,
        },
        root,
        now,
      );
    });
  }

  async load(txId: string): Promise<TxRow> {
    const row = (
      await this.database.query<TxRow>(
        "SELECT * FROM transactions WHERE id=$1",
        [txId],
      )
    ).rows[0];
    if (!row) throw new Error("Unknown transaction");
    return row;
  }

  // Reconciles one transaction against canonical receipts. INCLUDED needs three
  // canonical confirmations and FINALIZED the RPC finalized head; a vanished
  // receipt returns the transaction to BROADCAST and reports the reorg.
  async reconcile(txId: string): Promise<Reconciled> {
    const tx = await this.load(txId);
    if (["FINALIZED", "REPLACED", "DROPPED"].includes(tx.state))
      return { tx, reorged: false, receipt: null };
    const now = this.clock();
    const receipt = await this.client
      .getTransactionReceipt({ hash: tx.tx_hash })
      .catch(() => null);
    const head = await this.client.getBlockNumber({ cacheTime: 0 });
    const canonical =
      receipt &&
      (
        await this.client
          .getBlock({ blockNumber: receipt.blockNumber })
          .catch(() => null)
      )?.hash === receipt.blockHash;
    if (!receipt || !canonical) {
      const reorged = tx.block_hash !== null;
      const stale =
        tx.broadcast_at !== null &&
        now - Number(tx.broadcast_at) >= UNKNOWN_AFTER_SECONDS;
      const state: TxState = reorged
        ? "BROADCAST"
        : stale || tx.state === "UNKNOWN"
          ? "UNKNOWN"
          : tx.state;
      await this.database.query(
        "UPDATE transactions SET state=$2,block_number=NULL,block_hash=NULL,actual_fee_wei=NULL,updated_at=$3 WHERE id=$1",
        [txId, state, now],
      );
      if (reorged || state === "UNKNOWN") await this.broadcast(txId);
      return { tx: await this.load(txId), reorged, receipt: null };
    }
    const confirmations = head - receipt.blockNumber + 1n;
    let state: TxState =
      tx.state === "JOURNALED" || tx.state === "UNKNOWN"
        ? "BROADCAST"
        : tx.state;
    if (confirmations >= CONFIRMATIONS) {
      state = receipt.status === "success" ? "INCLUDED" : "REVERTED";
      if (receipt.status === "success") {
        const finalized = await this.client
          .getBlock({ blockTag: "finalized" })
          .catch(() => null);
        if (finalized && finalized.number >= receipt.blockNumber)
          state = "FINALIZED";
      }
    }
    const l1Fee =
      (receipt as TransactionReceipt & { l1Fee?: bigint }).l1Fee ?? 0n;
    const actual = receipt.gasUsed * receipt.effectiveGasPrice + l1Fee;
    const updated = (
      await this.database.query<TxRow>(
        "UPDATE transactions SET state=$2,block_number=$3,block_hash=$4,actual_fee_wei=$5,updated_at=$6 WHERE id=$1 RETURNING *",
        [
          txId,
          state,
          receipt.blockNumber.toString(),
          receipt.blockHash,
          actual.toString(),
          now,
        ],
      )
    ).rows[0]!;
    if (state === "INCLUDED" || state === "FINALIZED" || state === "REVERTED")
      await this.database.query(
        "UPDATE transactions SET state='REPLACED',updated_at=$3 WHERE sender=$1 AND nonce=$2 AND id<>$4 AND state IN ('JOURNALED','BROADCAST','UNKNOWN')",
        [tx.sender, tx.nonce, now, txId],
      );
    return { tx: updated, reorged: false, receipt };
  }
}
