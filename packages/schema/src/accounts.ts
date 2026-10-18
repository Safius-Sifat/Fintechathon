import { z } from "zod";
import {
  encodeFunctionData,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { CHAIN_ID } from "./runtime.js";
import {
  AddressSchema,
  big,
  Hex32Schema,
  NonZeroAddressSchema,
  Uint256,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const MAX_ACCOUNT_INDEX = 19;
export const derivationPath = (index: number) => {
  if (!Number.isInteger(index) || index < 0 || index > MAX_ACCOUNT_INDEX)
    throw new Error("Account index must be 0..19");
  return `m/44'/60'/0'/0/${index}` as const;
};

export const AccountSchema = z
  .object({
    accountId: UuidSchema,
    address: AddressSchema,
    index: z.number().int().min(0).max(MAX_ACCOUNT_INDEX),
    label: z.string().min(1).max(64),
    backupConfirmed: z.boolean(),
  })
  .strict();

// S8.2 semantic request. asset zero = native ETH. Amount is in the asset's base units.
export const PersonalTransferRequestSchema = z
  .object({
    clientRequestId: UuidSchema,
    accountId: UuidSchema,
    chainId: z.literal(CHAIN_ID),
    asset: AddressSchema,
    recipient: NonZeroAddressSchema,
    amount: Uint256.refine((v) => big(v) > 0n, "amount must be positive"),
  })
  .strict();

export const PersonalTransferPreviewSchema = z
  .object({
    localOperationId: UuidSchema,
    from: AddressSchema,
    to: NonZeroAddressSchema,
    asset: AddressSchema,
    amount: Uint256,
    nonce: Uint64,
    gasLimit: Uint64,
    maxFeePerGas: Uint256,
    maxPriorityFeePerGas: Uint256,
    estimatedL1FeeWei: Uint256,
    estimatedTotalFeeWei: Uint256,
    estimatedTotalDebitWei: Uint256, // ETH only: gas, plus value for native sends; never token units
    quoteBlock: Uint64,
    quoteExpiresAt: Uint64,
    simulation: z
      .object({
        success: z.boolean(),
        revertReason: z.string().max(500).nullable(),
      })
      .strict(),
    requestDigest: Hex32Schema,
  })
  .strict()
  .refine(
    (p) => p.to !== p.from,
    "Recipient must differ from the sending address",
  )
  .refine(
    (p) => big(p.maxPriorityFeePerGas) <= big(p.maxFeePerGas),
    "Priority fee exceeds max fee",
  );

export const LOCAL_TX_STATES = [
  "DRAFT",
  "AWAITING_SIGNATURE",
  "SIGNED",
  "SUBMITTED",
  "INCLUDED",
  "FINALIZED",
  "REVERTED",
  "REPLACED",
  "UNKNOWN",
  "CANCELLED",
  "REORGED",
] as const;
export const LocalTxStateSchema = z.enum(LOCAL_TX_STATES);

/** The only calldata forms a personal send may build (S8.2). */
export function personalTransferCall(
  asset: Address,
  recipient: Address,
  amount: string,
): { to: Address; value: string; data: Hex } {
  const to = NonZeroAddressSchema.parse(recipient);
  const units = Uint256.parse(amount);
  if (AddressSchema.parse(asset) === zeroAddress)
    return { to, value: units, data: "0x" };
  return {
    to: AddressSchema.parse(asset),
    value: "0",
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, big(units)],
    }),
  };
}

export type Account = z.infer<typeof AccountSchema>;
export type PersonalTransferRequest = z.infer<
  typeof PersonalTransferRequestSchema
>;
export type PersonalTransferPreview = z.infer<
  typeof PersonalTransferPreviewSchema
>;
