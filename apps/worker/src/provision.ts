import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  encodeFunctionData,
  getAddress,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { publicKeyToAddress } from "viem/utils";
import { mandateWalletAbi, walletFactoryAbi } from "@mandate/schema";
import {
  transaction,
  verifyCode,
  walletForOwner,
  type Clock,
  type ContractRef,
} from "@mandate/platform";
import type { Relayer } from "./relayer.js";

// Per-wallet DKG through the MPC adapter's administrative ceremony.
export type Keygen = {
  generate(
    mpcWalletId: string,
  ): Promise<
    | { state: "PENDING" }
    | { state: "DONE"; publicKey: Hex }
    | { state: "FAILED"; reason: string }
  >;
};

export type ProvisionState = "DEPLOYING" | "KEYGEN" | "READY" | "FAILED";
export type StepResult = { state: ProvisionState; waiting: string | null };

type WalletRow = {
  id: string;
  owner_address: Address;
  provisioning_state: ProvisionState;
  wallet_address: Address | null;
  mpc_wallet_id: string | null;
  executor_address: string | null;
  executor_public_key: string | null;
};

export class Provisioner {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient,
    readonly relayer: Relayer,
    readonly factory: ContractRef,
    readonly keygen: Keygen | null,
    readonly clock: Clock,
  ) {}

  private async load(walletId: string): Promise<WalletRow> {
    const row = (
      await this.database.query<WalletRow>(
        "SELECT * FROM wallets WHERE id=$1",
        [walletId],
      )
    ).rows[0];
    if (!row) throw new Error("Unknown wallet");
    return row;
  }

  private async fail(walletId: string, reason: string): Promise<StepResult> {
    await this.database.query(
      "UPDATE wallets SET provisioning_state='FAILED',failure_reason=$2,updated_at=$3 WHERE id=$1 AND provisioning_state<>'READY'",
      [walletId, reason, this.clock()],
    );
    return { state: "FAILED", waiting: null };
  }

  // One idempotent step. Every transition is derived from chain facts or the
  // keygen result, so a retry after any crash resumes the same wallet.
  async step(walletId: string): Promise<StepResult> {
    const wallet = await this.load(walletId);
    if (
      wallet.provisioning_state === "READY" ||
      wallet.provisioning_state === "FAILED"
    )
      return { state: wallet.provisioning_state, waiting: null };
    if (wallet.provisioning_state === "DEPLOYING") return this.deploy(wallet);
    return this.generate(wallet);
  }

  private async deploy(wallet: WalletRow): Promise<StepResult> {
    try {
      await verifyCode(this.client, this.factory);
    } catch {
      return this.fail(
        wallet.id,
        "Factory code does not match the deployment manifest",
      );
    }
    const owner = getAddress(wallet.owner_address);
    const existing = await walletForOwner(
      this.client,
      this.factory.address,
      owner,
    );
    if (existing) return this.adopt(wallet, existing);
    const pending = (
      await this.database.query<{ id: string }>(
        "SELECT id FROM transactions WHERE purpose='CREATE_WALLET' AND payload->>'walletId'=$1 AND state NOT IN ('REPLACED','DROPPED') ORDER BY journaled_at DESC LIMIT 1",
        [wallet.id],
      )
    ).rows[0];
    if (pending) {
      const { tx } = await this.relayer.reconcile(pending.id);
      if (tx.state === "REVERTED")
        return this.fail(wallet.id, "Factory deployment reverted");
      return { state: "DEPLOYING", waiting: "factory deployment confirmation" };
    }
    const call = {
      to: this.factory.address,
      data: encodeFunctionData({
        abi: walletFactoryAbi,
        functionName: "createWallet",
        args: [owner],
      }),
      value: 0n,
    };
    const quote = await this.relayer.quote("normal", call);
    const tx = await transaction(this.database, (c) =>
      this.relayer.journal(c, "normal", call, quote, {
        purpose: "CREATE_WALLET",
        actionId: null,
        payload: { walletId: wallet.id, owner },
      }),
    );
    await this.relayer.broadcast(tx.id);
    return { state: "DEPLOYING", waiting: "factory deployment confirmation" };
  }

  // First block containing code at the address; bounded RPC calls on any range.
  private async deploymentBlock(
    address: Address,
    head: bigint,
  ): Promise<bigint> {
    let low = BigInt(this.factory.deploymentBlock);
    let high = head;
    while (low < high) {
      const mid = (low + high) / 2n;
      const code = await this.client.getCode({ address, blockNumber: mid });
      if (code && code !== "0x") high = mid;
      else low = mid + 1n;
    }
    return low;
  }

  // Adopts the factory's canonical wallet only after its owner and factory read back.
  private async adopt(
    wallet: WalletRow,
    address: Address,
  ): Promise<StepResult> {
    const head = await this.client.getBlockNumber({ cacheTime: 0 });
    const [code, owner, factory] = await Promise.all([
      this.client.getCode({ address }),
      this.client.readContract({
        address,
        abi: mandateWalletAbi,
        functionName: "owner",
      }),
      this.client.readContract({
        address,
        abi: mandateWalletAbi,
        functionName: "factory",
      }),
    ]);
    if (!code || code === "0x")
      return this.fail(
        wallet.id,
        "Factory mapping has no deployed wallet code",
      );
    if (
      owner.toLowerCase() !== wallet.owner_address ||
      factory !== this.factory.address
    )
      return this.fail(
        wallet.id,
        "Wallet owner or factory does not match the mapping",
      );
    const block = await this.deploymentBlock(address, head);
    const created = (
      await this.client.getContractEvents({
        address: this.factory.address,
        abi: walletFactoryAbi,
        eventName: "WalletCreated",
        args: { owner: getAddress(wallet.owner_address), wallet: address },
        fromBlock: block,
        toBlock: block,
      })
    )[0];
    if (!created)
      return this.fail(
        wallet.id,
        "Factory did not emit WalletCreated for this wallet",
      );
    // Confirmations are required before a wallet is adopted.
    if (head - created.blockNumber + 1n < 3n)
      return { state: "DEPLOYING", waiting: "factory deployment confirmation" };
    await this.database.query(
      "UPDATE wallets SET provisioning_state='KEYGEN',wallet_address=$2,deployment_block=$3,code_hash=$4,deployment_tx_hash=$5,mpc_wallet_id=COALESCE(mpc_wallet_id,$6),updated_at=$7 WHERE id=$1 AND provisioning_state='DEPLOYING'",
      [
        wallet.id,
        address.toLowerCase(),
        created.blockNumber.toString(),
        keccak256(code),
        created.transactionHash,
        randomUUID(),
        this.clock(),
      ],
    );
    return this.step(wallet.id);
  }

  private async generate(wallet: WalletRow): Promise<StepResult> {
    if (!this.keygen)
      return {
        state: "KEYGEN",
        waiting: "MPC keygen ceremony is not configured",
      };
    const result = await this.keygen.generate(wallet.mpc_wallet_id!);
    if (result.state === "PENDING")
      return { state: "KEYGEN", waiting: "MPC keygen in progress" };
    if (result.state === "FAILED")
      return this.fail(
        wallet.id,
        "MPC keygen failed: " + result.reason.slice(0, 200),
      );
    if (!/^0x04[0-9a-fA-F]{128}$/.test(result.publicKey))
      return this.fail(wallet.id, "MPC keygen returned a malformed public key");
    const executor = publicKeyToAddress(result.publicKey).toLowerCase();
    if (wallet.executor_address && wallet.executor_address !== executor)
      return this.fail(
        wallet.id,
        "MPC executor does not match the recorded executor",
      );
    await this.database.query(
      "UPDATE wallets SET provisioning_state='READY',executor_address=$2,executor_public_key=$3,key_version=1,updated_at=$4 WHERE id=$1 AND provisioning_state='KEYGEN'",
      [wallet.id, executor, result.publicKey.toLowerCase(), this.clock()],
    );
    return { state: "READY", waiting: null };
  }
}

// Worker-only client for the MPC adapter's keygen ceremony.
export function adapterKeygen(url: string, token: string): Keygen {
  const headers = {
    authorization: "Bearer " + token,
    "content-type": "application/json",
  };
  return {
    async generate(mpcWalletId) {
      const status = await fetch(`${url}/internal/keygen/${mpcWalletId}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      let body: { state: string; publicKey?: Hex; reason?: string };
      if (status.status === 404) {
        const started = await fetch(`${url}/internal/keygen`, {
          method: "POST",
          headers,
          body: JSON.stringify({ mpcWalletId }),
          signal: AbortSignal.timeout(15_000),
        });
        if (started.status === 409) return { state: "PENDING" };
        if (started.status !== 202)
          throw new Error(`MPC keygen refused (${started.status})`);
        body = await started.json();
      } else if (status.status === 200) body = await status.json();
      else throw new Error(`MPC keygen status unavailable (${status.status})`);
      if (body.state === "DONE" && body.publicKey)
        return { state: "DONE", publicKey: body.publicKey };
      if (body.state === "FAILED")
        return { state: "FAILED", reason: body.reason ?? "keygen failed" };
      return { state: "PENDING" };
    },
  };
}
