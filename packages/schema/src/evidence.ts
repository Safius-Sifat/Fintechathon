import { z } from "zod";
import { CHAIN_ID } from "./runtime.js";
import {
  AddressSchema,
  Hex32Schema,
  HexDataSchema,
  JsonObjectSchema,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const Ed25519PublicKeySchema = Hex32Schema;
export const Ed25519SignatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{128}$/)
  .transform((v) => v.toLowerCase());

// Additive v7 event types (S9.13). The event envelope and schema version stay 4.
export const V7_EVENT_TYPES = [
  "INTENT_COMPILED",
  "AGENT_QUESTION",
  "AGENT_DECISION",
  "AGENT_TIMEOUT",
  "APPROVAL_REQUESTED",
  "OWNER_APPROVAL",
  "OWNER_REJECTION",
  "RISK_ALERT",
  "SCREENING_DENIAL",
  "POLICY_UPDATED",
  "WALLET_FROZEN",
  "WALLET_UNFROZEN",
  "CALL_EXECUTED",
  "X402_AUTHORIZED",
] as const;

export const EvidenceEventSchema = z
  .object({
    schemaVersion: z.literal(4),
    eventId: UuidSchema,
    taskId: UuidSchema,
    chainTaskId: Hex32Schema,
    wallet: AddressSchema,
    sequence: z.number().int().min(0),
    recordedAt: Uint64,
    type: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    requestId: Hex32Schema.nullable(),
    permitId: Hex32Schema.nullable(),
    payload: JsonObjectSchema,
    prevHash: Hex32Schema,
    eventHash: Hex32Schema,
  })
  .strict();

export const CheckpointSchema = z
  .object({
    schemaVersion: z.literal(4),
    chainId: z.literal(CHAIN_ID),
    wallet: AddressSchema,
    taskId: Hex32Schema,
    sequence: z.number().int().min(0),
    headHash: Hex32Schema,
  })
  .strict();

export const FindingSchema = z
  .object({
    name: z.enum([
      "integrity",
      "authority",
      "policy",
      "settlement",
      "delivery",
      "completion",
    ]),
    state: z.enum(["PASS", "FAIL", "PENDING", "UNVERIFIABLE"]),
    ruleId: z.string().min(1).max(64),
    reason: z.string().max(2000),
    evidenceIds: z.array(UuidSchema),
    basis: z.array(
      z.enum(["chain", "signature", "artifact", "recorder_assertion"]),
    ),
  })
  .strict();

export const ExportManifestSchema = z
  .object({
    schemaVersion: z.literal(4),
    chainId: z.literal(CHAIN_ID),
    wallet: AddressSchema,
    taskId: UuidSchema,
    chainTaskId: Hex32Schema,
    inspection: z.object({ fromBlock: Uint64, toBlock: Uint64 }).strict(),
    publicKeys: z.object({ evidence: Ed25519PublicKeySchema }).strict(),
    retainedHashes: z.array(Hex32Schema),
    anchorTxHash: Hex32Schema.nullable(),
  })
  .strict();

export const ArtifactIndexEntrySchema = z
  .object({
    artifactId: z.string().min(1).max(128),
    sha256: Hex32Schema,
    storageCommitment: Hex32Schema,
    retained: z.boolean(),
  })
  .strict();

export const EvidenceBundleSchema = z
  .object({
    manifest: ExportManifestSchema,
    events: z.array(EvidenceEventSchema),
    checkpoint: CheckpointSchema,
    checkpointSig: Ed25519SignatureSchema,
    authority: JsonObjectSchema,
    transactions: z.array(JsonObjectSchema),
    artifactIndex: z.array(ArtifactIndexEntrySchema),
    artifacts: z.record(HexDataSchema),
  })
  .strict();

export const VerifierReportSchema = z
  .object({
    schemaVersion: z.literal(4),
    taskId: UuidSchema,
    inspectionHead: Uint64,
    findings: z.array(FindingSchema),
    unmatchedOutflows: z.array(JsonObjectSchema),
    limitations: z.array(z.string()),
  })
  .strict();

export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type VerifierReport = z.infer<typeof VerifierReportSchema>;
