import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  decodeEventLog,
  getAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { demoUSDAbi, mandateWalletAbi } from "@mandate/schema";
import type { Clock } from "@mandate/platform";
import {
  EtherscanClient,
  IndexerUnavailable,
  PAGE_SIZE,
  type IndexerAction,
  type IndexerItem,
} from "./etherscan.js";

// Etherscan caps page*offset at 10000; a longer window must be split.
const MAX_PAGES = 10;

export type Account = {
  owner: Address;
  source: "PERSONAL" | "MANAGED";
  address: Address;
  // The owner's other account, so transfers between them are FUNDING.
  counterpart: Address | null;
};

type Activity = {
  activityId: string;
  category: string;
  txHash: Hex;
  logIndex: number | null;
  traceId: string | null;
  blockHash: Hex | null;
  blockNumber: bigint | null;
  nonce: bigint | null;
  asset: Address;
  from: Address;
  to: Address;
  amount: bigint;
  feeWei: bigint | null;
  feePayer: Address | null;
  state: "INCLUDED" | "REVERTED" | "UNKNOWN";
  taskId: string | null;
  transferId: Hex | null;
  provenance: "RPC_VERIFIED" | "INDEXER_ASSERTION";
};

const lower = (a: string) => a.toLowerCase();

export class HistoryIndexer {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly indexer: EtherscanClient,
    readonly clock: Clock,
  ) {}

  private async canonicalReceipt(
    hash: Hex,
  ): Promise<TransactionReceipt | null> {
    const receipt = await this.client
      .getTransactionReceipt({ hash })
      .catch(() => null);
    if (!receipt) return null;
    const block = await this.client
      .getBlock({ blockNumber: receipt.blockNumber })
      .catch(() => null);
    return block?.hash === receipt.blockHash ? receipt : null;
  }

  // Managed-wallet events in the receipt decide AGENT/OWNER_CONTROL/ADMIN/VAULT.
  private async classify(
    account: Account,
    receipt: TransactionReceipt,
    from: Address,
    to: Address,
  ) {
    if (
      account.counterpart &&
      (lower(from) === lower(account.counterpart) ||
        lower(to) === lower(account.counterpart))
    )
      return {
        category: "FUNDING",
        taskId: null,
        transferId: null,
        unmatched: false,
      };
    if (account.source === "MANAGED") {
      for (const log of receipt.logs) {
        if (lower(log.address) !== lower(account.address)) continue;
        let event: { eventName: string; args: Record<string, unknown> };
        try {
          event = decodeEventLog({
            abi: mandateWalletAbi,
            ...log,
          }) as typeof event;
        } catch {
          continue;
        }
        if (event.eventName === "ActionExecuted") {
          const task = (
            await this.database.query<{ task_id: string }>(
              "SELECT a.task_id FROM actions a JOIN wallets w ON w.id=a.wallet_id WHERE w.wallet_address=$1 AND a.request_id=$2",
              [lower(account.address), event.args.requestId],
            )
          ).rows[0];
          return {
            category: task ? "AGENT" : "OUTGOING",
            taskId: task?.task_id ?? null,
            transferId: null,
            unmatched: !task,
          };
        }
        if (event.eventName === "OwnerTransferExecuted")
          return {
            category: "OWNER_CONTROL",
            taskId: null,
            transferId: event.args.transferId as Hex,
            unmatched: false,
          };
        if (
          [
            "WalletPaused",
            "WalletFrozen",
            "PermitRevoked",
            "Recovered",
            "WalletPolicyUpdated",
          ].includes(event.eventName)
        )
          return {
            category: "ADMIN",
            taskId: null,
            transferId: null,
            unmatched: false,
          };
      }
    }
    const outgoing = lower(from) === lower(account.address);
    // A managed-wallet outflow with no stored Action or owner transfer is unexplained.
    return {
      category: outgoing ? "OUTGOING" : "INCOMING",
      taskId: null,
      transferId: null,
      unmatched: outgoing && account.source === "MANAGED",
    };
  }

  // Indexer claims become RPC_VERIFIED only when the canonical receipt matches.
  async verify(
    account: Account,
    action: IndexerAction,
    item: IndexerItem,
  ): Promise<Activity & { unmatched: boolean }> {
    const txHash = lower(item.hash) as Hex;
    const from = getAddress(item.from);
    const to = /^0x[0-9a-fA-F]{40}$/.test(item.to)
      ? getAddress(item.to)
      : zeroAddress;
    const base = {
      txHash,
      from,
      to,
      amount: BigInt(item.value),
      blockHash: null,
      blockNumber: BigInt(item.blockNumber),
      nonce: null,
      feeWei: null,
      feePayer: null,
      taskId: null,
      transferId: null,
    };
    const assertion = (
      logIndex: number | null,
      traceId: string | null,
      asset: Address,
    ) => ({
      ...base,
      activityId: `${txHash}:${traceId ?? logIndex ?? "tx"}`.slice(0, 128),
      category:
        lower(from) === lower(account.address) ? "OUTGOING" : "INCOMING",
      logIndex,
      traceId,
      asset,
      state: "UNKNOWN" as const,
      provenance: "INDEXER_ASSERTION" as const,
      unmatched: false,
    });
    if (action === "txlistinternal")
      return assertion(null, item.traceId ?? "internal", zeroAddress);
    const receipt = await this.canonicalReceipt(txHash);
    if (action === "tokentx") {
      const logIndex = Number(item.logIndex ?? -1);
      const asset = getAddress(item.contractAddress ?? zeroAddress);
      const log = receipt?.logs.find(
        (l) => l.logIndex === logIndex && lower(l.address) === lower(asset),
      );
      let matches = false;
      if (log)
        try {
          const e = decodeEventLog({ abi: demoUSDAbi, ...log });
          matches =
            e.eventName === "Transfer" &&
            lower(e.args.from) === lower(from) &&
            lower(e.args.to) === lower(to) &&
            e.args.value === base.amount;
        } catch {
          matches = false;
        }
      if (!receipt || !matches) return assertion(logIndex, null, asset);
      const c = await this.classify(account, receipt, from, to);
      return {
        ...base,
        ...c,
        activityId: `${txHash}:${logIndex}`,
        logIndex,
        traceId: null,
        asset,
        blockHash: receipt.blockHash,
        blockNumber: receipt.blockNumber,
        state: receipt.status === "success" ? "INCLUDED" : "REVERTED",
        provenance: "RPC_VERIFIED",
      };
    }
    const tx = await this.client
      .getTransaction({ hash: txHash })
      .catch(() => null);
    if (
      !receipt ||
      !tx ||
      lower(tx.from) !== lower(from) ||
      lower(tx.to ?? zeroAddress) !== lower(to) ||
      tx.value !== base.amount
    )
      return assertion(null, null, zeroAddress);
    const c = await this.classify(account, receipt, from, to);
    const paidByAccount = lower(tx.from) === lower(account.address);
    const l1 = BigInt(
      (receipt as TransactionReceipt & { l1Fee?: bigint | Hex }).l1Fee ?? 0n,
    );
    return {
      ...base,
      ...c,
      activityId: `${txHash}:tx`,
      logIndex: null,
      traceId: null,
      asset: zeroAddress,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      nonce: BigInt(tx.nonce),
      feeWei: paidByAccount
        ? receipt.gasUsed * receipt.effectiveGasPrice + l1
        : null,
      feePayer: paidByAccount ? from : null,
      state: receipt.status === "success" ? "INCLUDED" : "REVERTED",
      provenance: "RPC_VERIFIED",
    };
  }

  async record(
    account: Account,
    activity: Activity & { unmatched: boolean },
  ): Promise<void> {
    const now = this.clock();
    await this.database.query(
      "INSERT INTO activity_events(activity_id,owner_address,source,category,tx_hash,log_index,trace_id,block_hash,block_number,nonce,asset,from_address,to_address,amount,fee_wei,fee_payer,state,task_id,transfer_id,provenance,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT DO NOTHING",
      [
        `${account.source.toLowerCase()}:${activity.activityId}`.slice(0, 128),
        lower(account.owner),
        account.source,
        activity.category,
        activity.txHash,
        activity.logIndex,
        activity.traceId,
        activity.blockHash,
        activity.blockNumber?.toString() ?? null,
        activity.nonce?.toString() ?? null,
        lower(activity.asset),
        lower(activity.from),
        lower(activity.to),
        activity.amount.toString(),
        activity.feeWei?.toString() ?? null,
        activity.feePayer ? lower(activity.feePayer) : null,
        activity.state,
        activity.taskId,
        activity.transferId,
        activity.provenance,
        now,
      ],
    );
    // Unexplained verified outflow: alert and inhibit new signing; no Action is invented.
    if (activity.unmatched && activity.provenance === "RPC_VERIFIED") {
      const wallet = (
        await this.database.query<{ id: string }>(
          "SELECT id FROM wallets WHERE wallet_address=$1",
          [lower(account.address)],
        )
      ).rows[0];
      if (!wallet) return;
      await this.database.query(
        "INSERT INTO financial_alerts(id,wallet_id,kind,tx_hash,log_index,details,created_at) VALUES($1,$2,'UNMATCHED_OUTFLOW',$3,$4,$5,$6) ON CONFLICT DO NOTHING",
        [
          randomUUID(),
          wallet.id,
          activity.txHash,
          activity.logIndex ?? -1,
          {
            asset: lower(activity.asset),
            amount: activity.amount.toString(),
            to: lower(activity.to),
          },
          now,
        ],
      );
      await this.database.query(
        "UPDATE wallets SET inhibited=true,updated_at=$2 WHERE id=$1",
        [wallet.id, now],
      );
    }
  }

  // Backfills one account range. Any indexer failure leaves the coverage FAILED
  // with an explicit gap; an empty result is COMPLETE only after every list succeeded.
  async backfill(
    account: Account,
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<string> {
    const owner = lower(account.owner);
    const now = this.clock();
    await this.database.query(
      "INSERT INTO history_coverage(owner_address,source,account,from_block,to_block,backfill_state,gaps,updated_at) VALUES($1,$2,$3,$4,$5,'RUNNING','[]',$6) ON CONFLICT(owner_address,source) DO UPDATE SET account=EXCLUDED.account,from_block=EXCLUDED.from_block,to_block=EXCLUDED.to_block,backfill_state='RUNNING',updated_at=EXCLUDED.updated_at",
      [
        owner,
        account.source,
        lower(account.address),
        fromBlock.toString(),
        toBlock.toString(),
        now,
      ],
    );
    try {
      for (const action of ["txlist", "tokentx", "txlistinternal"] as const) {
        for (let page = 1; ; page++) {
          if (page > MAX_PAGES)
            throw new IndexerUnavailable(
              "ERROR",
              "range exceeds the indexer page window; split it",
            );
          const items = await this.indexer.page(
            action,
            account.address,
            fromBlock,
            toBlock,
            page,
          );
          for (const item of items)
            await this.record(
              account,
              await this.verify(account, action, item),
            );
          if (items.length < PAGE_SIZE) break;
        }
      }
    } catch (error) {
      if (!(error instanceof IndexerUnavailable)) throw error;
      await this.database.query(
        "UPDATE history_coverage SET backfill_state='FAILED',indexed_through=NULL,gaps=$3,failure=$4,updated_at=$5 WHERE owner_address=$1 AND source=$2",
        [
          owner,
          account.source,
          JSON.stringify([
            { fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
          ]),
          error.reason,
          this.clock(),
        ],
      );
      return "FAILED";
    }
    await this.database.query(
      "UPDATE history_coverage SET backfill_state='COMPLETE',indexed_through=to_block,gaps='[]',failure=NULL,updated_at=$3 WHERE owner_address=$1 AND source=$2",
      [owner, account.source, this.clock()],
    );
    return "COMPLETE";
  }
}
