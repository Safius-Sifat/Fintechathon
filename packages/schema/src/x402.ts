import {
  concat,
  decodeEventLog,
  domainSeparator,
  erc20Abi,
  hashStruct,
  hashTypedData,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { ActionSchema, Operation } from "./authority.js";
import { AddressSchema, Hex32Schema } from "./primitives.js";
import { CHAIN_ID } from "./runtime.js";

// Architecture S9.10. The EIP-3009 authorization is derived from the
// executor-signed Action, never from free input.
export const BASE_SEPOLIA_USDC =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
// Verified on chain 2026-10-18: name() = "USDC", version() = "2", and this
// domain reproduces USDC.DOMAIN_SEPARATOR().
export const USDC_DOMAIN_SEPARATOR =
  "0x71f17a3b2ff373b803d70a5a07c046c1a2bc8e89c09ef722fcb047abe94c9818" as Hex;
export const X402_NETWORK = `eip155:${CHAIN_ID}` as const;

export const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export type X402Authorization = {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
};

export const usdcDomain = (token: Address = BASE_SEPOLIA_USDC) => ({
  name: "USDC",
  version: "2",
  chainId: CHAIN_ID,
  verifyingContract: AddressSchema.parse(token),
});

/** The only authorization an X402 Action can produce (from = wallet). */
export function x402Authorization(
  action: unknown,
  wallet: string,
): X402Authorization {
  const a = ActionSchema.parse(action);
  if (a.operation !== Operation.X402)
    throw new Error("Action is not an X402 operation");
  return {
    from: AddressSchema.parse(wallet),
    to: a.target,
    value: a.amount,
    validAfter: "0",
    validBefore: a.deadline,
    nonce: a.requestId,
  };
}

const message = (auth: X402Authorization) => ({
  from: auth.from,
  to: auth.to,
  value: BigInt(auth.value),
  validAfter: BigInt(auth.validAfter),
  validBefore: BigInt(auth.validBefore),
  nonce: auth.nonce,
});

export const hashTransferWithAuthorization = (auth: X402Authorization): Hex =>
  hashStruct({
    data: message(auth),
    primaryType: "TransferWithAuthorization",
    types: transferWithAuthorizationTypes,
  });

/** EIP-712 digest that USDC passes to the wallet's isValidSignature. */
export const x402AuthorizationDigest = (
  auth: X402Authorization,
  token: Address = BASE_SEPOLIA_USDC,
): Hex =>
  hashTypedData({
    domain: usdcDomain(token),
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: message(auth),
  });

export const usdcDomainSeparator = (token: Address = BASE_SEPOLIA_USDC): Hex =>
  domainSeparator({ domain: usdcDomain(token) });

/** 65-byte payload signature the wallet's isValidSignature requires: requestId ‖ permitId ‖ 0x01. */
export const x402Signature = (requestId: string, permitId: string): Hex =>
  concat([Hex32Schema.parse(requestId), Hex32Schema.parse(permitId), "0x01"]);

// The parts of a public client a settlement check needs, so tests can fake it.
export interface SettlementReader {
  getTransactionReceipt(args: { hash: Hash }): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[];
  }>;
  getBlockNumber(): Promise<bigint>;
}

export type X402SettlementCheck =
  | { state: "PAID"; blockNumber: bigint }
  | { state: "PENDING"; reason: string }
  | { state: "INVALID"; reason: string };

const authorizationUsedEvent = parseAbi([
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);
const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/**
 * A settlement counts only when its transaction moved exactly `amount` of the
 * asset from the wallet to the recipient and consumed the request's EIP-3009
 * nonce, with the required confirmations.
 */
export async function checkX402Settlement(
  chain: SettlementReader,
  expected: {
    wallet: string;
    asset: string;
    recipient: string;
    amount: string;
  },
  requestId: Hex,
  txHash: Hash,
  confirmations: bigint,
): Promise<X402SettlementCheck> {
  const receipt = await chain
    .getTransactionReceipt({ hash: txHash })
    .catch(() => null);
  if (!receipt)
    return { state: "PENDING", reason: "The settlement is not in a block yet" };
  if (receipt.status !== "success")
    return { state: "INVALID", reason: "The settlement reverted" };
  let transferred = false;
  let used = false;
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, expected.asset)) continue;
    try {
      const ev = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics as never,
      });
      if (
        ev.eventName === "Transfer" &&
        sameAddress(ev.args.from, expected.wallet) &&
        sameAddress(ev.args.to, expected.recipient) &&
        ev.args.value === BigInt(expected.amount)
      )
        transferred = true;
      continue;
    } catch {
      // Not a Transfer log.
    }
    try {
      const ev = decodeEventLog({
        abi: authorizationUsedEvent,
        data: log.data,
        topics: log.topics as never,
      });
      if (
        sameAddress(ev.args.authorizer, expected.wallet) &&
        ev.args.nonce.toLowerCase() === requestId.toLowerCase()
      )
        used = true;
    } catch {
      // Not an AuthorizationUsed log.
    }
  }
  if (!transferred || !used)
    return {
      state: "INVALID",
      reason: "The settlement does not pay this invoice",
    };
  const depth = (await chain.getBlockNumber()) - receipt.blockNumber + 1n;
  if (depth < confirmations)
    return {
      state: "PENDING",
      reason: `${depth} of ${confirmations} confirmations`,
    };
  return { state: "PAID", blockNumber: receipt.blockNumber };
}
