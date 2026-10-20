import type { Pool } from "pg";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { authorityTypes, mandateWalletAbi } from "@mandate/schema";
import { transaction, type Clock } from "@mandate/platform";
import type { Relayer } from "./relayer.js";

// ABI tuple values from the shared EIP-712 field list (uint8..uint48 are numbers).
const abiStruct = (
  fields: readonly { name: string; type: string }[],
  value: Record<string, string>,
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
            : BigInt(value[name]!),
      ];
    }),
  );

// Relays owner-signed transfers on the emergency lane, which is independent of
// agent fee budgets and needs no MPC signature.
export class OwnerTransferRelay {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly relayer: Relayer,
    readonly clock: Clock,
  ) {}

  async advance(draftId: string): Promise<string> {
    const draft = (
      await this.database.query<{
        wallet_id: string;
        wallet_address: string;
        transfer: Record<string, string>;
        owner_signature: Hex;
        state: string;
        tx_id: string | null;
      }>(
        "SELECT d.wallet_id,w.wallet_address,d.transfer,d.owner_signature,d.state,d.tx_id FROM owner_transfer_drafts d JOIN wallets w ON w.id=d.wallet_id WHERE d.id=$1",
        [draftId],
      )
    ).rows[0];
    if (!draft || draft.state !== "SUBMITTED") return draft?.state ?? "UNKNOWN";
    const wallet = getAddress(draft.wallet_address);
    if (!draft.tx_id) {
      const call = {
        to: wallet,
        data: encodeFunctionData({
          abi: mandateWalletAbi,
          functionName: "applyOwnerTransfer",
          args: [
            abiStruct(authorityTypes.OwnerTransfer, draft.transfer),
            draft.owner_signature,
          ] as never,
        }),
        value: 0n,
      };
      // A failing simulation is still journaled and sent: the owner's command is
      // theirs to execute, and the receipt is the only proof of its outcome.
      const quote = await this.relayer
        .quote("emergency", call)
        .catch(async () => ({
          ...(await this.relayer.quote("emergency", { ...call, data: "0x" })),
          gas: 300_000n,
        }));
      const tx = await transaction(this.database, async (c) => {
        const journaled = await this.relayer.journal(
          c,
          "emergency",
          call,
          quote,
          { purpose: "OWNER_TRANSFER", actionId: null, payload: { draftId } },
        );
        await c.query(
          "UPDATE owner_transfer_drafts SET tx_id=$2 WHERE id=$1 AND tx_id IS NULL",
          [draftId, journaled.id],
        );
        return journaled;
      });
      await this.relayer.broadcast(tx.id);
      return "SUBMITTED";
    }
    const { tx, receipt } = await this.relayer.reconcile(draft.tx_id);
    if (tx.state === "REVERTED") {
      // Not paused, no new epoch, inhibit stays until the owner clears it.
      await this.database.query(
        "UPDATE owner_transfer_drafts SET state='REVERTED' WHERE id=$1",
        [draftId],
      );
      return "REVERTED";
    }
    if ((tx.state !== "INCLUDED" && tx.state !== "FINALIZED") || !receipt)
      return "SUBMITTED";
    const executed = receipt.logs
      .filter((l) => l.address.toLowerCase() === wallet.toLowerCase())
      .map((l) => {
        try {
          return decodeEventLog({ abi: mandateWalletAbi, ...l });
        } catch {
          return null;
        }
      })
      .find(
        (e) =>
          e?.eventName === "OwnerTransferExecuted" &&
          e.args.transferId === draft.transfer.transferId,
      );
    if (!executed || executed.eventName !== "OwnerTransferExecuted")
      return "SUBMITTED";
    const newEpoch = executed.args.newEpoch.toString();
    await transaction(this.database, async (c) => {
      await c.query(
        "UPDATE owner_transfer_drafts SET state='INCLUDED' WHERE id=$1",
        [draftId],
      );
      await c.query(
        "UPDATE wallets SET paused=true,epoch=$2,updated_at=$3 WHERE id=$1",
        [draft.wallet_id, newEpoch, this.clock()],
      );
      // Old-epoch Permits can no longer execute; their reservations are released
      // only through chain proof, not here.
      await c.query(
        "UPDATE permits SET authority_state='INVALIDATED' WHERE wallet_id=$1 AND authority_state IN ('PENDING','ACTIVE','FROZEN') AND (permit->>'epoch')::numeric < $2",
        [draft.wallet_id, newEpoch],
      );
    });
    return "INCLUDED";
  }
}
