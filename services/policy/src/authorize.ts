import type { Pool } from "pg";
import { getAddress, type Address, type Hex, type PublicClient } from "viem";
import { z } from "zod";
import {
  mandateWalletAbi,
  UuidSchema,
  type DeploymentManifest,
} from "@mandate/schema";
import type { Clock } from "@mandate/platform";
import { loadAction, loadKeygenWallet, recentProposals } from "./load.js";
import { evaluate, NETWORK, type ChainSnapshot } from "./rules.js";

// The upstream SignTxMessage JSON as forwarded by the Go authorizer; bytes are base64.
export const SignTxMessageSchema = z
  .object({
    key_type: z.string(),
    wallet_id: z.string(),
    network_internal_code: z.string(),
    tx_id: z.string(),
    tx: z.string(),
    signature: z.string().nullable(),
    derivation_path: z.array(z.number()).nullable(),
    authorizer_signatures: z.array(z.unknown()).optional(),
  })
  .strict();
export const PolicyCheckRequestSchema = z
  .object({
    actionId: UuidSchema,
    attemptId: UuidSchema,
    message: SignTxMessageSchema,
  })
  .strict();
export const KeygenCheckRequestSchema = z
  .object({ mpcWalletId: UuidSchema })
  .strict();

export type PolicyDecision = {
  allowed: boolean;
  ruleIds: string[];
  expectedDigest: Hex | null;
  expectedMpcWalletId: string | null;
  expectedNetwork: typeof NETWORK;
  expectedTxId: string;
  expectedDerivationPath: null;
  expectedKeyVersion: number | null;
  expectedExecutor: Address | null;
  chainBlock: string | null;
};

export type ChainReader = (
  wallet: Address,
  requestId: Hex,
) => Promise<ChainSnapshot>;

// The policy service's own RPC view at one recent block.
export function rpcChainReader(client: PublicClient): ChainReader {
  return async (wallet, requestId) => {
    const block = await client.getBlock({ blockTag: "latest" });
    const read = <T>(functionName: string, args: readonly unknown[] = []) =>
      client.readContract({
        address: wallet,
        abi: mandateWalletAbi,
        functionName,
        args,
        blockNumber: block.number,
      } as Parameters<PublicClient["readContract"]>[0]) as Promise<T>;
    const [paused, frozen, epoch, requestUsed] = await Promise.all([
      read<boolean>("paused"),
      read<boolean>("frozen"),
      read<bigint>("authorityEpoch"),
      read<boolean>("usedRequest", [requestId]),
    ]);
    return {
      blockNumber: block.number,
      timestamp: block.timestamp,
      paused,
      frozen,
      epoch,
      requestUsed,
    };
  };
}

export class PolicyService {
  constructor(
    readonly database: Pool,
    readonly manifest: DeploymentManifest | null,
    readonly chain: ChainReader | null,
    readonly clock: Clock,
    readonly screening: ReadonlySet<string> = new Set(),
  ) {}

  async check(
    input: z.infer<typeof PolicyCheckRequestSchema>,
  ): Promise<PolicyDecision> {
    const now = this.clock();
    const denied = (ruleIds: string[]): PolicyDecision => ({
      allowed: false,
      ruleIds,
      expectedDigest: null,
      expectedMpcWalletId: null,
      expectedNetwork: NETWORK,
      expectedTxId: input.attemptId,
      expectedDerivationPath: null,
      expectedKeyVersion: null,
      expectedExecutor: null,
      chainBlock: null,
    });
    const record = await loadAction(
      this.database,
      input.actionId,
      input.attemptId,
    );
    if (!record) return denied(["ACTION_UNKNOWN"]);
    let chain: ChainSnapshot | null = null;
    if (this.chain && record.wallet_address) {
      const requestId =
        (record.action as { requestId?: Hex }).requestId ?? record.request_id;
      chain = await this.chain(
        getAddress(record.wallet_address),
        requestId as Hex,
      ).catch(() => null);
    }
    const ruleIds = await evaluate({
      record,
      attemptId: input.attemptId,
      manifest: this.manifest,
      chain,
      recentProposals: record.executor_address
        ? await recentProposals(this.database, record.executor_address, now)
        : 0,
      now: BigInt(now),
      screening: this.screening,
    });
    // The forwarded message is compared too; it is never a source of expected values.
    const m = input.message;
    const tx = Buffer.from(m.tx, "base64");
    if (
      m.key_type !== "secp256k1" ||
      m.wallet_id !== record.mpc_wallet_id ||
      m.network_internal_code !== NETWORK ||
      m.tx_id !== input.attemptId ||
      m.derivation_path !== null ||
      "0x" + tx.toString("hex") !== record.digest
    )
      ruleIds.push("MESSAGE_MISMATCH");
    if (ruleIds.length) return denied(ruleIds);
    return {
      allowed: true,
      ruleIds: [],
      expectedDigest: record.digest as Hex,
      expectedMpcWalletId: record.mpc_wallet_id,
      expectedNetwork: NETWORK,
      expectedTxId: input.attemptId,
      expectedDerivationPath: null,
      expectedKeyVersion: record.key_version,
      expectedExecutor: getAddress(record.executor_address!),
      chainBlock: chain!.blockNumber.toString(),
    };
  }

  // Keygen is authorized only for a wallet that provisioning moved to KEYGEN.
  async keygen(
    mpcWalletId: string,
  ): Promise<{ allowed: boolean; ruleIds: string[] }> {
    const wallet = await loadKeygenWallet(this.database, mpcWalletId);
    if (!wallet) return { allowed: false, ruleIds: ["WALLET_UNKNOWN"] };
    if (wallet.provisioning_state !== "KEYGEN")
      return { allowed: false, ruleIds: ["WALLET_NOT_KEYGEN"] };
    return { allowed: true, ruleIds: [] };
  }
}
