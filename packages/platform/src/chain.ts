import {
  createPublicClient,
  http,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  demoUSDAbi,
  mandateWalletAbi,
  walletFactoryAbi,
} from "@mandate/schema";

export type ContractRef = {
  address: Address;
  deploymentBlock: string;
  codeHash: Hex;
};

export class ChainUnavailable extends Error {}

export async function connectChain(
  rpcUrl: string,
  chainId: number,
): Promise<PublicClient> {
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 10_000, retryCount: 0 }),
  });
  let actual: number;
  try {
    actual = await client.getChainId();
  } catch {
    throw new ChainUnavailable("RPC endpoint unavailable");
  }
  if (actual !== chainId)
    throw new Error(`RPC chain ${actual} is not ${chainId}`);
  return client;
}

export async function verifyCode(
  client: PublicClient,
  ref: ContractRef,
): Promise<void> {
  const code = await client.getCode({ address: ref.address });
  if (!code || code === "0x" || keccak256(code) !== ref.codeHash.toLowerCase())
    throw new Error(
      `Code at ${ref.address} does not match the deployment manifest`,
    );
}

export type WalletChainState = {
  blockNumber: bigint;
  owner: Address;
  paused: boolean;
  frozen: boolean;
  epoch: bigint;
  assets: {
    asset: Address;
    symbol: string;
    liquidUnits: bigint;
    dailyCap: bigint | null;
    walletGross: bigint;
    executorGross: bigint;
    day: bigint;
    vaultAssets: bigint;
  }[];
};

// All reads are pinned to one block so the view is internally consistent.
export async function readWallet(
  client: PublicClient,
  wallet: Address,
  executor: Address,
  assets: readonly { address: Address; symbol: string }[],
): Promise<WalletChainState> {
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const read = <T>(functionName: string, args: readonly unknown[] = []) =>
    client.readContract({
      address: wallet,
      abi: mandateWalletAbi,
      functionName,
      args,
      blockNumber,
    } as Parameters<PublicClient["readContract"]>[0]) as Promise<T>;
  const [owner, paused, frozen, epoch] = await Promise.all([
    read<Address>("owner"),
    read<boolean>("paused"),
    read<boolean>("frozen"),
    read<bigint>("authorityEpoch"),
  ]);
  const rows = await Promise.all(
    assets.map(async ({ address, symbol }) => {
      const [budget, cap] = await Promise.all([
        read<{
          day: bigint;
          walletGross: bigint;
          executorGross: bigint;
          liquidAssets: bigint;
          vaultAssets: bigint;
        }>("getBudget", [executor, address]),
        read<readonly [bigint, bigint, bigint, boolean]>("assetCap", [address]),
      ]);
      return {
        asset: address,
        symbol,
        liquidUnits: budget.liquidAssets,
        dailyCap: cap[3] ? cap[1] : null,
        walletGross: budget.walletGross,
        executorGross: budget.executorGross,
        day: budget.day,
        vaultAssets: budget.vaultAssets,
      };
    }),
  );
  return { blockNumber, owner, paused, frozen, epoch, assets: rows };
}

export async function walletForOwner(
  client: PublicClient,
  factory: Address,
  owner: Address,
): Promise<Address | null> {
  const wallet = await client.readContract({
    address: factory,
    abi: walletFactoryAbi,
    functionName: "walletForOwner",
    args: [owner],
  });
  return /^0x0{40}$/i.test(wallet) ? null : wallet;
}

export async function tokenBalance(
  client: PublicClient,
  token: Address,
  holder: Address,
  blockNumber?: bigint,
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: demoUSDAbi,
    functionName: "balanceOf",
    args: [holder],
    ...(blockNumber === undefined ? {} : { blockNumber }),
  });
}
