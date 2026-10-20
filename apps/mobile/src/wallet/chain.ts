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
  CHAIN_ID,
  RPC_URL,
  TOKENS,
  WALLET_FACTORY,
  type Token,
} from "./config";
import { addSent } from "./local";
import { signerForCurrent } from "./session";

export const client = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
}).extend(publicActionsL2());

import { applyAdminAbi, factoryAbi, walletAbi } from "./chain-abi";

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
