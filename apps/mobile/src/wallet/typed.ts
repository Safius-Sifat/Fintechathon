// EIP-712 types and list hashing for the owner objects signed on this phone.
// Pure TypeScript; tests check every definition against packages/schema and
// its golden vectors.
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { POLICY_CEILINGS } from "./config";

export const OWNER_TRANSFER_TYPES = {
  OwnerTransfer: [
    { name: "transferId", type: "bytes32" },
    { name: "asset", type: "address" },
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "epoch", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export const WALLET_POLICY_TYPES = {
  WalletPolicy: [
    { name: "version", type: "uint64" },
    { name: "assetCapsHash", type: "bytes32" },
    { name: "allowlistHash", type: "bytes32" },
    { name: "blocklistHash", type: "bytes32" },
    { name: "templatesHash", type: "bytes32" },
    { name: "reviewThreshold", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export const APPROVAL_TYPES = {
  Approval: [
    { name: "actionDigest", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const PERMIT_TYPES = {
  Permit: [
    { name: "taskId", type: "bytes32" },
    { name: "executor", type: "address" },
    { name: "kind", type: "uint8" },
    { name: "asset", type: "address" },
    { name: "runbookHash", type: "bytes32" },
    { name: "conditionsHash", type: "bytes32" },
    { name: "recipientsHash", type: "bytes32" },
    { name: "scheduleHash", type: "bytes32" },
    { name: "templatesHash", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "startsAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "epoch", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "maxActions", type: "uint32" },
    { name: "maxPayments", type: "uint32" },
    { name: "maxPayment", type: "uint256" },
    { name: "spendCap", type: "uint256" },
    { name: "liquidFloor", type: "uint256" },
    { name: "depositCap", type: "uint256" },
    { name: "withdrawCap", type: "uint256" },
    { name: "reviewThreshold", type: "uint256" },
    { name: "periodCap", type: "uint256" },
    { name: "periodSeconds", type: "uint32" },
  ],
} as const;

export const ASSET_CAP_COMPONENTS = [
  { name: "asset", type: "address" },
  { name: "perTx", type: "uint256" },
  { name: "daily", type: "uint256" },
  { name: "weekly", type: "uint256" },
] as const;

export const CALL_TEMPLATE_COMPONENTS = [
  { name: "templateId", type: "bytes32" },
  { name: "target", type: "address" },
  { name: "targetCodeHash", type: "bytes32" },
  { name: "selector", type: "bytes4" },
  { name: "amountArg", type: "uint8" },
  { name: "recipientArg", type: "uint8" },
  { name: "recipientRule", type: "uint8" },
  { name: "flags", type: "uint8" },
  { name: "maxAmount", type: "uint256" },
] as const;

export const MAX_OWNER_TRANSFER_SECONDS = 600n;
export const MAX_POLICY_SECONDS = 1800n;
export const MAX_POLICY_LIST = 32;

export interface AssetCap {
  asset: Address;
  perTx: bigint;
  daily: bigint;
  weekly: bigint;
}

export interface PolicyLists {
  assetCaps: AssetCap[];
  allowlist: Address[];
  blocklist: Address[];
}

const lower = (a: string) => a.toLowerCase();
const byAddress =
  <T>(key: (x: T) => string) =>
  (a: T, b: T) =>
    lower(key(a)) < lower(key(b)) ? -1 : lower(key(a)) > lower(key(b)) ? 1 : 0;

// Sorts and de-duplicates the lists the way the contract requires.
export function canonicalLists(l: PolicyLists): PolicyLists {
  const uniq = (xs: Address[]) =>
    [...new Map(xs.map((x) => [lower(x), getAddress(x)])).values()].sort(
      byAddress((x) => x),
    );
  return {
    assetCaps: [...l.assetCaps].sort(byAddress((c) => c.asset)),
    allowlist: uniq(l.allowlist),
    blocklist: uniq(l.blocklist),
  };
}

export function hashAssetCaps(caps: readonly AssetCap[]): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple[]", components: ASSET_CAP_COMPONENTS }],
      [caps.map((c) => ({ ...c }))],
    ),
  );
}

export const hashAddressList = (list: readonly Address[]): Hex =>
  keccak256(encodeAbiParameters([{ type: "address[]" }], [[...list]]));

// This phone never adds call templates, so it always commits the empty list.
export const EMPTY_TEMPLATES_HASH: Hex = keccak256(
  encodeAbiParameters(
    [{ type: "tuple[]", components: CALL_TEMPLATE_COMPONENTS }],
    [[]],
  ),
);

// Returns the first problem with a proposed policy, or null when the
// contract would accept it.
export function checkPolicy(
  l: PolicyLists,
  reviewThreshold: bigint,
): string | null {
  if (l.assetCaps.length === 0) return "Set limits for at least one asset.";
  for (const c of l.assetCaps) {
    if (c.perTx > POLICY_CEILINGS.perTx)
      return "Per payment can be at most 0.50.";
    if (c.daily > POLICY_CEILINGS.daily)
      return "Each day can be at most 10.00.";
    if (c.weekly > POLICY_CEILINGS.weekly)
      return "Each week can be at most 25.00.";
    if (c.perTx > c.daily) return "Per payment cannot be above each day.";
    if (c.daily > c.weekly) return "Each day cannot be above each week.";
  }
  if (
    l.allowlist.length > MAX_POLICY_LIST ||
    l.blocklist.length > MAX_POLICY_LIST
  )
    return "A list can hold at most 32 addresses.";
  if ([...l.allowlist, ...l.blocklist].some((a) => lower(a) === zeroAddress))
    return "The zero address cannot be listed.";
  if (reviewThreshold < 0n) return "The approval limit cannot be negative.";
  return null;
}

export function buildPolicy(
  l: PolicyLists,
  reviewThreshold: bigint,
  version: bigint,
  nonce: bigint,
  nowSeconds: bigint,
) {
  const c = canonicalLists(l);
  return {
    lists: c,
    message: {
      version,
      assetCapsHash: hashAssetCaps(c.assetCaps),
      allowlistHash: hashAddressList(c.allowlist),
      blocklistHash: hashAddressList(c.blocklist),
      templatesHash: EMPTY_TEMPLATES_HASH,
      reviewThreshold,
      nonce,
      issuedAt: nowSeconds,
      deadline: nowSeconds + MAX_POLICY_SECONDS,
    },
  };
}

export function buildOwnerTransfer(input: {
  transferId: Hex;
  asset: Address | null;
  recipient: Address;
  amount: bigint;
  epoch: bigint;
  nonce: bigint;
  nowSeconds: bigint;
}) {
  return {
    transferId: input.transferId,
    asset: input.asset ?? zeroAddress,
    recipient: input.recipient,
    amount: input.amount,
    epoch: input.epoch,
    nonce: input.nonce,
    issuedAt: input.nowSeconds,
    deadline: input.nowSeconds + MAX_OWNER_TRANSFER_SECONDS,
  };
}
