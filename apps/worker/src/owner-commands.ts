import type { Pool } from "pg";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Hex,
  type PublicClient,
} from "viem";
import {
  AdminCommand,
  authorityTypes,
  mandateWalletAbi,
  policyTypes,
} from "@mandate/schema";
import { transaction, type Clock } from "@mandate/platform";
import type { Relayer } from "./relayer.js";

type Field = { name: string; type: string };
const abiStruct = (fields: readonly Field[], value: Record<string, unknown>) =>
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

type Lists = {
  assetCaps: Record<string, string>[];
  allowlist: string[];
  blocklist: string[];
  templates: Record<string, unknown>[];
};

// Relays owner-signed WalletPolicy and Admin commands on the emergency lane and
// records their effect only from the receipt.
export class OwnerCommandRelay {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly relayer: Relayer,
    readonly clock: Clock,
  ) {}

  async advance(draftId: string): Promise<string> {
    const row = (
      await this.database.query<{
        wallet_id: string;
        wallet_address: string;
        kind: "POLICY" | "ADMIN";
        message: Record<string, unknown>;
        lists: Lists | null;
        owner_signature: Hex;
        state: string;
        tx_id: string | null;
      }>(
        "SELECT c.wallet_id,w.wallet_address,c.kind,c.message,c.lists,c.owner_signature,c.state,c.tx_id FROM owner_commands c JOIN wallets w ON w.id=c.wallet_id WHERE c.draft_id=$1",
        [draftId],
      )
    ).rows[0];
    if (!row || row.state !== "SUBMITTED") return row?.state ?? "UNKNOWN";
    const wallet = getAddress(row.wallet_address);
    if (!row.tx_id) {
      const data =
        row.kind === "POLICY"
          ? encodeFunctionData({
              abi: mandateWalletAbi,
              functionName: "applyWalletPolicy",
              args: [
                abiStruct(policyTypes.WalletPolicy, row.message),
                row.lists!.assetCaps.map((c) =>
                  abiStruct(policyTypes.AssetCap, c),
                ),
                row.lists!.allowlist,
                row.lists!.blocklist,
                row.lists!.templates.map((t) =>
                  abiStruct(policyTypes.CallTemplate, t),
                ),
                row.owner_signature,
              ] as never,
            })
          : encodeFunctionData({
              abi: mandateWalletAbi,
              functionName: "applyAdmin",
              args: [
                abiStruct(authorityTypes.Admin, row.message),
                row.owner_signature,
              ] as never,
            });
      const call = { to: wallet, data, value: 0n };
      // The owner's command is relayed even if it would revert; only the receipt decides.
      const quote = await this.relayer
        .quote("emergency", call)
        .catch(async () => ({
          ...(await this.relayer.quote("emergency", { ...call, data: "0x" })),
          gas: 1_000_000n,
        }));
      const tx = await transaction(this.database, async (c) => {
        const journaled = await this.relayer.journal(
          c,
          "emergency",
          call,
          quote,
          {
            purpose: row.kind === "POLICY" ? "POLICY" : "ADMIN",
            actionId: null,
            payload: { draftId },
          },
        );
        await c.query(
          "UPDATE owner_commands SET tx_id=$2 WHERE draft_id=$1 AND tx_id IS NULL",
          [draftId, journaled.id],
        );
        return journaled;
      });
      await this.relayer.broadcast(tx.id);
      return "SUBMITTED";
    }
    const { tx, receipt } = await this.relayer.reconcile(row.tx_id);
    if (tx.state === "REVERTED") {
      await this.database.query(
        "UPDATE owner_commands SET state='REVERTED' WHERE draft_id=$1",
        [draftId],
      );
      return "REVERTED";
    }
    if ((tx.state !== "INCLUDED" && tx.state !== "FINALIZED") || !receipt)
      return "SUBMITTED";
    const now = this.clock();
    if (row.kind === "POLICY") {
      const updated = receipt.logs.some((l) => {
        try {
          const e = decodeEventLog({ abi: mandateWalletAbi, ...l });
          return (
            l.address.toLowerCase() === wallet.toLowerCase() &&
            e.eventName === "WalletPolicyUpdated" &&
            e.args.version.toString() === String(row.message.version)
          );
        } catch {
          return false;
        }
      });
      if (!updated) return "SUBMITTED";
      await transaction(this.database, async (c) => {
        await c.query(
          "UPDATE owner_commands SET state='INCLUDED' WHERE draft_id=$1",
          [draftId],
        );
        await c.query(
          "INSERT INTO wallet_policies(wallet_id,version,policy,lists,tx_hash,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
          [
            row.wallet_id,
            String(row.message.version),
            row.message,
            row.lists,
            tx.tx_hash,
            now,
          ],
        );
        await c.query(
          "UPDATE wallets SET policy_version=$2,updated_at=$3 WHERE id=$1",
          [row.wallet_id, String(row.message.version), now],
        );
      });
      return "INCLUDED";
    }
    const read = <T>(functionName: "paused" | "frozen" | "authorityEpoch") =>
      this.client.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName,
        blockNumber: receipt.blockNumber,
      }) as Promise<T>;
    const [paused, frozen, epoch] = await Promise.all([
      read<boolean>("paused"),
      read<boolean>("frozen"),
      read<bigint>("authorityEpoch"),
    ]);
    await transaction(this.database, async (c) => {
      await c.query(
        "UPDATE owner_commands SET state='INCLUDED' WHERE draft_id=$1",
        [draftId],
      );
      await c.query(
        "UPDATE wallets SET paused=$2,frozen=$3,epoch=$4,updated_at=$5 WHERE id=$1",
        [row.wallet_id, paused, frozen, epoch.toString(), now],
      );
      if (Number(row.message.command) === AdminCommand.REVOKE)
        await c.query(
          "UPDATE permits SET authority_state='REVOKED' WHERE permit_id=$1 AND wallet_id=$2",
          [row.message.permitId, row.wallet_id],
        );
    });
    return "INCLUDED";
  }
}
