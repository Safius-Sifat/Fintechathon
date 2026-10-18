import { z } from "zod";
import {
  AddressSchema,
  big,
  Bytes4Schema,
  Hex32Schema,
  Uint256,
  Uint64,
  uintNumber,
} from "./primitives.js";

export const RecipientRule = { NONE: 0, WALLET: 1, ALLOWLIST: 2 } as const;
export const TemplateFlag = { PULLS_ASSET: 1 } as const;
// Selectors a call template may never use (S9.8): approvals, pulls and plain transfers.
export const BANNED_SELECTORS = {
  approve: "0x095ea7b3",
  increaseAllowance: "0x39509351",
  permit: "0xd505accf",
  transferFrom: "0x23b872dd",
  setApprovalForAll: "0xa22cb465",
  transfer: "0xa9059cbb",
  transferAndCall: "0x4000aea0",
} as const;
const banned = new Set<string>(Object.values(BANNED_SELECTORS));

export const MAX_POLICY_LIST = 32;
export const MAX_POLICY_TEMPLATES = 8;
export const MAX_POLICY_LIFETIME_SECONDS = 1800n;

export const AssetCapSchema = z
  .object({
    asset: AddressSchema,
    perTx: Uint256,
    daily: Uint256,
    weekly: Uint256,
  })
  .strict()
  .refine((c) => big(c.perTx) <= big(c.daily), "perTx must not exceed daily")
  .refine((c) => big(c.daily) <= big(c.weekly), "daily must not exceed weekly");

export const CallTemplateSchema = z
  .object({
    templateId: Hex32Schema,
    target: AddressSchema,
    selector: Bytes4Schema,
    amountArg: uintNumber(7),
    recipientArg: uintNumber(7),
    recipientRule: uintNumber(2),
    flags: uintNumber(1),
    maxAmount: Uint256,
  })
  .strict()
  .refine(
    (t) => !banned.has(t.selector),
    "Selector is banned for call templates",
  )
  .refine(
    (t) => t.recipientRule !== RecipientRule.NONE || t.recipientArg === 0,
    "recipientArg must be 0 when recipientRule is NONE",
  )
  .refine(
    (t) =>
      t.recipientRule === RecipientRule.NONE || t.recipientArg !== t.amountArg,
    "recipientArg and amountArg must differ",
  );

export const WalletPolicySchema = z
  .object({
    version: Uint64,
    assetCapsHash: Hex32Schema,
    allowlistHash: Hex32Schema,
    blocklistHash: Hex32Schema,
    templatesHash: Hex32Schema,
    reviewThreshold: Uint256,
    nonce: Uint256,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict()
  .refine(
    (p) => big(p.deadline) > big(p.issuedAt),
    "deadline must follow issuedAt",
  )
  .refine(
    (p) => big(p.deadline) - big(p.issuedAt) <= MAX_POLICY_LIFETIME_SECONDS,
    "WalletPolicy lifetime must be at most 30 minutes",
  );

// The full lists the owner reviews; their hashes are committed in WalletPolicy.
export const WalletPolicyListsSchema = z
  .object({
    assetCaps: z.array(AssetCapSchema).min(1).max(MAX_POLICY_LIST),
    allowlist: z.array(AddressSchema).max(MAX_POLICY_LIST),
    blocklist: z.array(AddressSchema).max(MAX_POLICY_LIST),
    templates: z.array(CallTemplateSchema).max(MAX_POLICY_TEMPLATES),
  })
  .strict();

export type AssetCap = z.infer<typeof AssetCapSchema>;
export type CallTemplate = z.infer<typeof CallTemplateSchema>;
export type WalletPolicy = z.infer<typeof WalletPolicySchema>;
export type WalletPolicyLists = z.infer<typeof WalletPolicyListsSchema>;

const f = (entries: readonly (readonly [string, string])[]) =>
  entries.map(([name, type]) => ({ name, type }));
export const policyTypes = {
  WalletPolicy: f([
    ["version", "uint64"],
    ["assetCapsHash", "bytes32"],
    ["allowlistHash", "bytes32"],
    ["blocklistHash", "bytes32"],
    ["templatesHash", "bytes32"],
    ["reviewThreshold", "uint256"],
    ["nonce", "uint256"],
    ["issuedAt", "uint64"],
    ["deadline", "uint64"],
  ]),
  AssetCap: f([
    ["asset", "address"],
    ["perTx", "uint256"],
    ["daily", "uint256"],
    ["weekly", "uint256"],
  ]),
  CallTemplate: f([
    ["templateId", "bytes32"],
    ["target", "address"],
    ["selector", "bytes4"],
    ["amountArg", "uint8"],
    ["recipientArg", "uint8"],
    ["recipientRule", "uint8"],
    ["flags", "uint8"],
    ["maxAmount", "uint256"],
  ]),
};
