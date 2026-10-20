import type { Pool } from "pg";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { evidenceAnchorAbi } from "@mandate/schema";
import {
  transaction,
  verifyCode,
  type Clock,
  type ContractRef,
} from "@mandate/platform";
import type { Relayer } from "./relayer.js";

export class AnchorUnavailable extends Error {}

// Publishes checkpoint digests through the dedicated anchor lane. The lane signer
// must be the publisher the deployed EvidenceAnchor accepts; otherwise nothing is
// submitted and the checkpoint stays UNANCHORED.
export class Anchorer {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly relayer: Relayer,
    readonly anchor: ContractRef,
    readonly clock: Clock,
  ) {}

  async submit(taskId: string, sequence: number): Promise<string> {
    const lane = this.relayer.lanes.anchor;
    if (!lane)
      throw new AnchorUnavailable("Anchor publisher lane is not configured");
    await verifyCode(this.client, this.anchor);
    const publisher = await this.client.readContract({
      address: this.anchor.address,
      abi: evidenceAnchorAbi,
      functionName: "publisher",
    });
    if (getAddress(publisher) !== getAddress(lane.account.address))
      throw new AnchorUnavailable(
        "Anchor lane signer is not the deployed publisher",
      );
    const row = (
      await this.database.query<{
        digest: Hex;
        chain_task_id: Hex;
        anchor_state: string;
        anchor_tx_id: string | null;
      }>(
        "SELECT c.digest,t.chain_task_id,c.anchor_state,c.anchor_tx_id FROM checkpoints c JOIN tasks t ON t.id=c.task_id WHERE c.task_id=$1 AND c.sequence=$2",
        [taskId, sequence],
      )
    ).rows[0];
    if (!row) throw new Error("Unknown checkpoint");
    if (row.anchor_tx_id) return row.anchor_tx_id;
    const call = {
      to: this.anchor.address,
      data: encodeFunctionData({
        abi: evidenceAnchorAbi,
        functionName: "anchor",
        args: [row.chain_task_id, row.digest, BigInt(sequence)],
      }),
      value: 0n,
    };
    const quote = await this.relayer.quote("anchor", call);
    const tx = await transaction(this.database, async (c) => {
      const journaled = await this.relayer.journal(c, "anchor", call, quote, {
        purpose: "ANCHOR",
        actionId: null,
        payload: { taskId, sequence },
      });
      await c.query(
        "UPDATE checkpoints SET anchor_tx_id=$3,anchor_state='SUBMITTED' WHERE task_id=$1 AND sequence=$2 AND anchor_tx_id IS NULL",
        [taskId, sequence, journaled.id],
      );
      return journaled;
    });
    await this.relayer.broadcast(tx.id);
    return tx.id;
  }

  // INCLUDED only when the receipt carries the matching Anchored event.
  async reconcile(taskId: string, sequence: number): Promise<string> {
    const row = (
      await this.database.query<{
        anchor_tx_id: string | null;
        digest: Hex;
        anchor_state: string;
      }>(
        "SELECT anchor_tx_id,digest,anchor_state FROM checkpoints WHERE task_id=$1 AND sequence=$2",
        [taskId, sequence],
      )
    ).rows[0];
    if (!row?.anchor_tx_id) return row?.anchor_state ?? "UNANCHORED";
    const { tx, receipt } = await this.relayer.reconcile(row.anchor_tx_id);
    let state = row.anchor_state;
    if (tx.state === "REVERTED") state = "FAILED";
    else if ((tx.state === "INCLUDED" || tx.state === "FINALIZED") && receipt) {
      const anchored = receipt.logs.some((log) => {
        try {
          const e = decodeEventLog({ abi: evidenceAnchorAbi, ...log });
          return (
            e.eventName === "Anchored" &&
            e.args.checkpointDigest === row.digest &&
            e.args.sequence === BigInt(sequence)
          );
        } catch {
          return false;
        }
      });
      if (anchored) state = tx.state;
    } else if (tx.state === "BROADCAST" || tx.state === "UNKNOWN")
      state = "SUBMITTED";
    await this.database.query(
      "UPDATE checkpoints SET anchor_state=$3 WHERE task_id=$1 AND sequence=$2",
      [taskId, sequence, state],
    );
    return state;
  }
}
