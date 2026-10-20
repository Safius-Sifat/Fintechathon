// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import { CHAIN_ID } from "./runtime";
const LocalTxStateSchema = z.enum(["DRAFT", "AWAITING_SIGNATURE", "SIGNED", "SUBMITTED", "INCLUDED", "FINALIZED", "REVERTED", "REPLACED", "UNKNOWN", "CANCELLED", "REORGED"]);
import { AddressSchema, Hex32Schema, Uint256, Uint64 } from "./primitives";

export const ACTIVITY_CATEGORIES = [
  "INCOMING",
  "OUTGOING",
  "FUNDING",
  "AGENT",
  "VAULT",
  "ADMIN",
  "OWNER_CONTROL",
  "CANCEL",
  "SPEED_UP",
] as const;

// S8.4 WalletActivity. source and category keep personal, manual-owner and agent movement distinct.
export const WalletActivitySchema = z
  .object({
    activityId: z.string().min(1).max(128),
    ownerAddress: AddressSchema,
    source: z.enum(["PERSONAL", "MANAGED"]),
    category: z.enum(ACTIVITY_CATEGORIES),
    chainId: z.literal(CHAIN_ID),
    txHash: Hex32Schema,
    blockHash: Hex32Schema.nullable(),
    blockNumber: Uint64.nullable(),
    nonce: Uint64.nullable(),
    asset: AddressSchema,
    from: AddressSchema,
    to: AddressSchema,
    amount: Uint256,
    feeWei: Uint256.nullable(),
    feePayer: AddressSchema.nullable(),
    state: LocalTxStateSchema,
    operationId: z.string().max(128).nullable(),
    taskId: z.string().max(128).nullable(),
    transferId: Hex32Schema.nullable(),
    replacementOf: Hex32Schema.nullable(),
    provenance: z.enum(["RPC_VERIFIED", "INDEXER_ASSERTION", "LOCAL_JOURNAL"]),
    observedAt: Uint64,
  })
  .strict()
  .refine(
    (a) =>
      a.category !== "OWNER_CONTROL" ||
      (a.source === "MANAGED" && a.transferId !== null && a.taskId === null),
    "OWNER_CONTROL is a managed owner transfer with transferId and no task",
  )
  .refine(
    (a) =>
      a.category !== "AGENT" || (a.source === "MANAGED" && a.taskId !== null),
    "AGENT activity belongs to a managed task",
  );

export const CoverageSchema = z
  .object({
    fromBlock: Uint64,
    toBlock: Uint64,
    indexedThrough: Uint64.nullable(),
    backfillState: z.enum(["NOT_STARTED", "RUNNING", "COMPLETE", "FAILED"]),
    gaps: z.array(z.object({ fromBlock: Uint64, toBlock: Uint64 }).strict()),
  })
  .strict();

export const ActivityPageSchema = z
  .object({
    items: z.array(WalletActivitySchema),
    nextCursor: z.string().max(512).nullable(),
    coverage: CoverageSchema,
  })
  .strict();

export type WalletActivity = z.infer<typeof WalletActivitySchema>;
export type Coverage = z.infer<typeof CoverageSchema>;
