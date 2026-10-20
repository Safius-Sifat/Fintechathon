// Reads balances and sends transactions through a public Base Sepolia RPC,
// so personal send, receive and owner stop work without the Mandate service.
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  http,
  zeroAddress,
  type Address,
  type Hash,
  bytesToHex,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { publicActionsL2 } from "viem/op-stack";
import {
  ADMIN_TYPES,
  buildAdmin,
  walletDomain,
  type AdminCommandName,
} from "./core";
import {
  AGENT_ASSETS,
  CHAIN_ID,
  RPC_URL,
  TOKENS,
  WALLET_FACTORY,
  type Token,
} from "./config";
import { addSent, writeSignedLists } from "./local";
import {
  buildOwnerTransfer,
  buildPolicy,
  checkPolicy,
  OWNER_TRANSFER_TYPES,
  WALLET_POLICY_TYPES,
  type AssetCap,
  type PolicyLists,
} from "./typed";
import { signerForCurrent } from "./session";

export const client = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
}).extend(publicActionsL2());

import {
  applyAdminAbi,
  factoryAbi,
  ownerAbi,
  walletAbi,
  walletEvents,
} from "./chain-abi";

export async function balanceOf(token: Token, owner: Address): Promise<bigint> {
  if (!token.address) return client.getBalance({ address: owner });
  return client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function balances(owner: Address) {
  const values = await Promise.all(TOKENS.map((t) => balanceOf(t, owner)));
  return { values, block: await client.getBlockNumber() };
}

export interface PreparedSend {
  token: Token;
  from: Address;
  to: Address;
  amount: bigint;
  tx: { to: Address; data?: Hex; value: bigint; gas: bigint };
  // Upper bound in ETH wei: L2 gas at the max fee plus the L1 data fee.
  fee: bigint;
}

export async function prepareSend(
  token: Token,
  from: Address,
  to: Address,
  amount: bigint,
): Promise<PreparedSend> {
  const tx = token.address
    ? {
        to: token.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, amount],
        }),
        value: 0n,
      }
    : { to, value: amount };
  const [gas, fees] = await Promise.all([
    client.estimateGas({ account: from, ...tx }),
    client.estimateFeesPerGas(),
  ]);
  const l1 = await client.estimateL1Fee({ account: from, ...tx, gas });
  return {
    token,
    from,
    to,
    amount,
    tx: { ...tx, gas },
    fee: gas * fees.maxFeePerGas + l1,
  };
}

async function sendAs(
  reason: string,
  tx: { to: Address; data?: Hex; value?: bigint; gas?: bigint },
): Promise<Hash> {
  const account = await signerForCurrent(reason);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });
  if ((await wallet.getChainId()) !== CHAIN_ID)
    throw new Error("The network is not Base Sepolia. Nothing was sent.");
  return wallet.sendTransaction(tx);
}

// Signs and broadcasts exactly the transfer the review screen showed.
export async function send(p: PreparedSend, amountText: string): Promise<Hash> {
  const hash = await sendAs(`Send ${amountText} ${p.token.symbol}`, p.tx);
  await addSent({
    hash,
    from: p.from,
    to: p.to,
    symbol: p.token.symbol,
    amount: amountText,
    kind: "send",
    label: `Sent ${p.token.name}`,
    createdAt: Date.now(),
  });
  return hash;
}

export async function receipt(hash: Hash) {
  return client.getTransactionReceipt({ hash }).catch(() => null);
}

export async function transaction(hash: Hash) {
  return client.getTransaction({ hash }).catch(() => null);
}

export interface AgentWallet {
  address: Address;
  paused: boolean;
  frozen: boolean;
  nonce: bigint;
  epoch: bigint;
  balances: bigint[];
}

// The managed wallet the factory recorded for this owner, read from the
// chain. null when the owner has none.
export async function agentWallet(owner: Address): Promise<AgentWallet | null> {
  const address = await client.readContract({
    address: WALLET_FACTORY,
    abi: factoryAbi,
    functionName: "walletForOwner",
    args: [owner],
  });
  if (address === zeroAddress) return null;
  const read = <
    F extends "paused" | "frozen" | "adminNonce" | "authorityEpoch",
  >(
    functionName: F,
  ) => client.readContract({ address, abi: walletAbi, functionName });
  const [walletOwner, paused, frozen, nonce, epoch, values] = await Promise.all(
    [
      client.readContract({ address, abi: walletAbi, functionName: "owner" }),
      read("paused"),
      read("frozen"),
      read("adminNonce"),
      read("authorityEpoch"),
      Promise.all(TOKENS.map((t) => balanceOf(t, address))),
    ],
  );
  if (walletOwner.toLowerCase() !== owner.toLowerCase())
    throw new Error("The agent wallet's owner does not match this account.");
  return {
    address,
    paused: paused as boolean,
    frozen: frozen as boolean,
    nonce: nonce as bigint,
    epoch: BigInt(epoch as bigint),
    balances: values,
  };
}

export const ADMIN_LABELS: Record<AdminCommandName, string> = {
  PAUSE: "Paused all agents",
  UNPAUSE: "Resumed agents",
  FREEZE: "Froze the agent wallet",
  UNFREEZE: "Unfroze the agent wallet",
};

// Signs one owner command and submits it from the personal account, which
// pays the fee. Works without the Mandate service.
export async function applyAdmin(
  wallet: Address,
  command: AdminCommandName,
  owner: Address,
): Promise<Hash> {
  const nonce = await client.readContract({
    address: wallet,
    abi: walletAbi,
    functionName: "adminNonce",
  });
  const message = buildAdmin(
    command,
    nonce,
    BigInt(Math.floor(Date.now() / 1000)),
  );
  const account = await signerForCurrent(ADMIN_LABELS[command]);
  if (account.address !== owner)
    throw new Error("The account changed. Nothing was signed.");
  const signature = await account.signTypedData({
    domain: walletDomain(wallet),
    types: ADMIN_TYPES,
    primaryType: "Admin",
    message,
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });
  const hash = await walletClient.sendTransaction({
    to: wallet,
    data: encodeFunctionData({
      abi: applyAdminAbi,
      functionName: "applyAdmin",
      args: [message, signature],
    }),
  });
  await addSent({
    hash,
    from: owner,
    to: wallet,
    symbol: "",
    amount: "",
    kind: "admin",
    label: ADMIN_LABELS[command],
    createdAt: Date.now(),
  });
  return hash;
}

export const explorerTx = (hash: Hash) =>
  `https://sepolia.basescan.org/tx/${hash}`;

const now = () => BigInt(Math.floor(Date.now() / 1000));

// Deploys this account's agent wallet through the factory. Anyone may call
// the factory; the wallet's owner is fixed to this account.
export async function createAgentWallet(owner: Address): Promise<Hash> {
  const hash = await sendAs("Create your agent wallet", {
    to: WALLET_FACTORY,
    data: encodeFunctionData({
      abi: factoryAbi,
      functionName: "createWallet",
      args: [owner],
    }),
  });
  await addSent({
    hash,
    from: owner,
    to: WALLET_FACTORY,
    symbol: "",
    amount: "",
    kind: "owner",
    label: "Created the agent wallet",
    createdAt: Date.now(),
  });
  return hash;
}

// Moves funds out of the agent wallet with a signed OwnerTransfer. On success
// the contract pauses the wallet and ends every earlier permission.
export async function ownerTransfer(input: {
  wallet: Address;
  token: Token;
  recipient: Address;
  amount: bigint;
  amountText: string;
  owner: Address;
}): Promise<Hash> {
  const [epoch, nonce] = await Promise.all([
    client.readContract({
      address: input.wallet,
      abi: walletAbi,
      functionName: "authorityEpoch",
    }),
    client.readContract({
      address: input.wallet,
      abi: walletAbi,
      functionName: "ownerTransferNonce",
    }),
  ]);
  const id = new Uint8Array(32);
  crypto.getRandomValues(id);
  const message = buildOwnerTransfer({
    transferId: bytesToHex(id),
    asset: input.token.address,
    recipient: input.recipient,
    amount: input.amount,
    epoch: BigInt(epoch),
    nonce,
    nowSeconds: now(),
  });
  const account = await signerForCurrent(
    `Move ${input.amountText} ${input.token.symbol} out of the agent wallet`,
  );
  if (account.address !== input.owner)
    throw new Error("The account changed. Nothing was signed.");
  const signature = await account.signTypedData({
    domain: walletDomain(input.wallet),
    types: OWNER_TRANSFER_TYPES,
    primaryType: "OwnerTransfer",
    message,
  });
  const hash = await createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  }).sendTransaction({
    to: input.wallet,
    data: encodeFunctionData({
      abi: ownerAbi,
      functionName: "applyOwnerTransfer",
      args: [message, signature],
    }),
  });
  await addSent({
    hash,
    from: input.owner,
    to: input.wallet,
    symbol: input.token.symbol,
    amount: input.amountText,
    kind: "owner",
    label: "Moved out of the agent wallet",
    createdAt: Date.now(),
  });
  return hash;
}

export interface WalletPolicyView {
  version: bigint;
  reviewThreshold: bigint;
  nonce: bigint;
  caps: (AssetCap & { set: boolean })[];
}

export async function readPolicy(wallet: Address): Promise<WalletPolicyView> {
  const [policy, nonce, caps] = await Promise.all([
    client.readContract({
      address: wallet,
      abi: ownerAbi,
      functionName: "walletPolicy",
    }),
    client.readContract({
      address: wallet,
      abi: walletAbi,
      functionName: "policyNonce",
    }),
    Promise.all(
      AGENT_ASSETS.map((t) =>
        client.readContract({
          address: wallet,
          abi: walletAbi,
          functionName: "assetCap",
          args: [t.address!],
        }),
      ),
    ),
  ]);
  return {
    version: BigInt(policy.version),
    reviewThreshold: policy.reviewThreshold,
    nonce,
    caps: caps.map(([perTx, daily, weekly, set], i) => ({
      asset: AGENT_ASSETS[i]!.address!,
      perTx,
      daily,
      weekly,
      set,
    })),
  };
}

// Signs a new WalletPolicy (valid 30 minutes) and submits it from the
// personal account. This phone never adds call templates.
export async function applyPolicy(input: {
  wallet: Address;
  owner: Address;
  lists: PolicyLists;
  reviewThreshold: bigint;
}): Promise<Hash> {
  const problem = checkPolicy(input.lists, input.reviewThreshold);
  if (problem) throw new Error(problem);
  const current = await readPolicy(input.wallet);
  const { lists, message } = buildPolicy(
    input.lists,
    input.reviewThreshold,
    current.version + 1n,
    current.nonce,
    now(),
  );
  const account = await signerForCurrent("Sign new wallet limits");
  if (account.address !== input.owner)
    throw new Error("The account changed. Nothing was signed.");
  const signature = await account.signTypedData({
    domain: walletDomain(input.wallet),
    types: WALLET_POLICY_TYPES,
    primaryType: "WalletPolicy",
    message,
  });
  const hash = await createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  }).sendTransaction({
    to: input.wallet,
    data: encodeFunctionData({
      abi: ownerAbi,
      functionName: "applyWalletPolicy",
      args: [
        message,
        lists.assetCaps,
        lists.allowlist,
        lists.blocklist,
        [],
        signature,
      ],
    }),
  });
  await writeSignedLists(input.wallet, {
    version: message.version.toString(),
    allowlist: lists.allowlist,
    blocklist: lists.blocklist,
  });
  await addSent({
    hash,
    from: input.owner,
    to: input.wallet,
    symbol: "",
    amount: "",
    kind: "owner",
    label: `Signed wallet limits v${message.version}`,
    createdAt: Date.now(),
  });
  return hash;
}

// The public RPC answers log queries over at most 200 blocks, so recent
// history covers about the last hour (1,800 blocks at 2 seconds each).
export const HISTORY_BLOCKS = 1800n;
const LOG_RANGE = 200n;

export interface AgentEvent {
  name: string;
  block: bigint;
  hash: Hash;
  args: Record<string, unknown>;
}

export async function recentAgentEvents(
  wallet: Address,
): Promise<AgentEvent[]> {
  const latest = await client.getBlockNumber();
  const ranges: [bigint, bigint][] = [];
  for (
    let to = latest;
    to > latest - HISTORY_BLOCKS && to > 0n;
    to -= LOG_RANGE
  )
    ranges.push([to - LOG_RANGE + 1n > 0n ? to - LOG_RANGE + 1n : 0n, to]);
  const chunks = await Promise.all(
    ranges.map(([fromBlock, toBlock]) =>
      client.getLogs({
        address: wallet,
        events: walletEvents,
        fromBlock,
        toBlock,
      }),
    ),
  );
  return chunks
    .flat()
    .map((l) => ({
      name: l.eventName,
      block: l.blockNumber,
      hash: l.transactionHash,
      args: l.args as Record<string, unknown>,
    }))
    .sort((a, b) => (a.block > b.block ? -1 : 1));
}
