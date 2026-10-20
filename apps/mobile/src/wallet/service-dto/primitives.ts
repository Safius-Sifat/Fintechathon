// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import {
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

// Checksummed on output so canonical JSON and hashes never depend on input casing.
export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Expected 20-byte 0x address")
  .refine((v) => isAddress(v, { strict: false }), "Invalid EVM address")
  .transform((v) => getAddress(v) as Address);
export const NonZeroAddressSchema = AddressSchema.refine(
  (v) => v !== zeroAddress,
  "Zero address not allowed",
);
export const Hex32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Expected 32-byte 0x hex")
  .transform((v) => v.toLowerCase() as Hex);
export const Bytes4Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{8}$/, "Expected 4-byte 0x hex")
  .transform((v) => v.toLowerCase() as Hex);
export const HexDataSchema = z
  .string()
  .regex(/^0x([0-9a-fA-F]{2})*$/, "Expected even-length 0x hex")
  .transform((v) => v.toLowerCase() as Hex);
export const SignatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/, "Expected 65-byte signature")
  .transform((v) => v.toLowerCase() as Hex);
export const UuidSchema = z.string().uuid();

// Canonical unsigned decimal string bounded to the Solidity width. Rejects
// floats, negatives, leading zeros, exponents and JSON numbers.
const CANONICAL_UINT = /^(0|[1-9][0-9]*)$/;
// Refinements still run after a failed field check, so they must never throw.
// Invalid input maps to 0n; the field's own issue already fails the parse.
export const big = (v: unknown): bigint =>
  typeof v === "string" && CANONICAL_UINT.test(v)
    ? BigInt(v)
    : typeof v === "number" && Number.isSafeInteger(v)
      ? BigInt(v)
      : 0n;
export const uint = (bits: number) =>
  z
    .string()
    .regex(CANONICAL_UINT, "Expected canonical unsigned decimal string")
    .refine((v) => big(v) < 1n << BigInt(bits), `uint${bits} overflow`);
export const Uint256 = uint(256);
export const Uint64 = uint(64);
// Small enum/count fields are bounded JSON integers (S2).
export const uintNumber = (max: number) => z.number().int().min(0).max(max);
export const Uint8 = uintNumber(255);
export const Uint32 = uintNumber(4294967295);

export const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
export const MAX_UINT256 = ((1n << 256n) - 1n).toString();

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().int(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);
export const JsonObjectSchema = z.record(JsonValueSchema);
export type JsonObject = z.infer<typeof JsonObjectSchema>;
