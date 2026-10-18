import { z } from "zod";
import { CHAIN_ID } from "./runtime.js";
import {
  AddressSchema,
  Hex32Schema,
  NonZeroAddressSchema,
} from "./primitives.js";

// Displayed token text is untrusted: bounded and restricted to printable ASCII.
const SymbolSchema = z
  .string()
  .regex(/^[A-Za-z0-9.$_-]{1,11}$/, "Symbol must be 1-11 safe characters");
const NameSchema = z
  .string()
  .regex(/^[\x20-\x7e]{1,64}$/, "Name must be 1-64 printable ASCII characters");

// Reviewed send-enabled registry entry (manifest supportedTokens).
export const TokenRegistryEntrySchema = z
  .object({
    chainId: z.literal(CHAIN_ID),
    address: NonZeroAddressSchema,
    codeHash: Hex32Schema,
    decimals: z.number().int().min(0).max(36),
    symbol: SymbolSchema,
    transferMode: z.literal("STANDARD_ERC20"),
  })
  .strict();

export const AgentAssetSchema = z
  .object({
    address: NonZeroAddressSchema,
    codeHash: Hex32Schema,
    decimals: z.literal(6),
    symbol: SymbolSchema,
  })
  .strict();

export const AssetMetadataSchema = z
  .object({
    chainId: z.literal(CHAIN_ID),
    address: AddressSchema, // zero = native ETH
    name: NameSchema,
    symbol: SymbolSchema,
    decimals: z.number().int().min(0).max(36),
    codeHash: Hex32Schema.nullable(),
    status: z.enum(["SEND_ENABLED", "WATCH_ONLY", "HIDDEN"]),
  })
  .strict();

export type TokenRegistryEntry = z.infer<typeof TokenRegistryEntrySchema>;
export type AgentAsset = z.infer<typeof AgentAssetSchema>;
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

/**
 * Metadata validity is not trust: only a registry entry with the same chain,
 * address and observed code hash makes a token send-enabled.
 */
export function tokenStatus(
  token: { address: string; codeHash: string | null },
  registry: readonly TokenRegistryEntry[],
): "SEND_ENABLED" | "WATCH_ONLY" {
  const address = AddressSchema.parse(token.address);
  const entry = registry.find((r) => r.address === address);
  if (!entry || token.codeHash === null) return "WATCH_ONLY";
  return entry.codeHash === Hex32Schema.parse(token.codeHash)
    ? "SEND_ENABLED"
    : "WATCH_ONLY";
}
