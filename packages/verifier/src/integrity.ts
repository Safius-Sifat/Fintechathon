import { createHash, createPublicKey, verify } from "node:crypto";
import {
  CheckpointSchema,
  canonicalJson,
  hashCanonical,
  type EvidenceBundle,
  type Finding,
  ZERO_HASH,
} from "@mandate/schema";
import type { VerifyContext } from "./context.js";

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({
  name: "integrity",
  state,
  ruleId,
  reason,
  evidenceIds,
  basis,
});

function checkpointSignatureValid(
  publicKeyHex: string,
  checkpoint: unknown,
  signatureHex: string,
) {
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKeyHex.slice(2), "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(canonicalJson(CheckpointSchema.parse(checkpoint))),
      key,
      Buffer.from(signatureHex.slice(2), "hex"),
    );
  } catch {
    return false;
  }
}

// Recomputes every event hash (RFC 8785 canonical JSON, as the recorder
// writes them), the links and the checkpoint, checks artifact bytes, and
// verifies the checkpoint signature with the separately trusted key.
export function checkIntegrity(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Finding {
  const {
    events,
    checkpoint,
    checkpointSig,
    artifactIndex,
    artifacts,
    manifest,
  } = bundle;
  const ids = events.map((e) => e.eventId);
  let prev = ZERO_HASH as string;
  for (let i = 0; i < events.length; i++) {
    const { eventHash, ...rest } = events[i]!;
    if (rest.sequence !== i)
      return finding(
        "FAIL",
        "INTEGRITY_SEQUENCE_MISMATCH",
        `Event ${i} has sequence ${rest.sequence}`,
        ids,
        ["artifact"],
      );
    if (rest.prevHash.toLowerCase() !== prev.toLowerCase())
      return finding(
        "FAIL",
        "INTEGRITY_HASH_CHAIN_BROKEN",
        `Event ${i} does not link to the previous event`,
        ids,
        ["artifact"],
      );
    if (hashCanonical(rest).toLowerCase() !== eventHash.toLowerCase())
      return finding(
        "FAIL",
        "INTEGRITY_EVENT_HASH_MISMATCH",
        `Event ${i} was changed after it was recorded`,
        ids,
        ["artifact"],
      );
    prev = eventHash;
  }
  const last = events.at(-1);
  if (
    !last ||
    checkpoint.headHash.toLowerCase() !== last.eventHash.toLowerCase() ||
    checkpoint.sequence !== last.sequence ||
    checkpoint.wallet.toLowerCase() !== manifest.wallet.toLowerCase() ||
    checkpoint.taskId.toLowerCase() !== manifest.chainTaskId.toLowerCase()
  )
    return finding(
      "FAIL",
      "INTEGRITY_CHECKPOINT_MISMATCH",
      "The checkpoint does not cover the recorded events",
      ids,
      ["artifact"],
    );
  for (const entry of artifactIndex) {
    if (!entry.retained) continue;
    const data = artifacts[entry.artifactId];
    if (!data)
      return finding(
        "UNVERIFIABLE",
        "INTEGRITY_ARTIFACT_MISSING",
        `Retained artifact ${entry.artifactId} is not in the bundle`,
        ids,
        ["artifact"],
      );
    const digest = `0x${createHash("sha256")
      .update(Buffer.from(data.slice(2), "hex"))
      .digest("hex")}`;
    if (digest !== entry.sha256.toLowerCase())
      return finding(
        "FAIL",
        "INTEGRITY_ARTIFACT_HASH_MISMATCH",
        `Artifact ${entry.artifactId} does not match its hash`,
        ids,
        ["artifact"],
      );
  }
  if (!ctx.trustedEvidenceKey)
    return finding(
      "UNVERIFIABLE",
      "INTEGRITY_NO_TRUSTED_KEY",
      "Events and artifacts are consistent; no trusted evidence key was given, so the checkpoint signature was not checked",
      ids,
      ["artifact"],
    );
  if (
    !checkpointSignatureValid(ctx.trustedEvidenceKey, checkpoint, checkpointSig)
  )
    return finding(
      "FAIL",
      "INTEGRITY_CHECKPOINT_SIGNATURE",
      "The checkpoint is not signed by the trusted evidence key",
      ids,
      ["signature"],
    );
  if (!manifest.anchorTxHash)
    return finding(
      "UNVERIFIABLE",
      "INTEGRITY_NOT_ANCHORED",
      "Events, artifacts and the signed checkpoint are consistent; the export is provisional because the checkpoint is not anchored yet",
      ids,
      ["artifact", "signature"],
    );
  if (!ctx.chain)
    return finding(
      "UNVERIFIABLE",
      "INTEGRITY_ANCHOR_NOT_READ",
      "The checkpoint is signed; its anchor transaction was not read because no RPC was given",
      ids,
      ["artifact", "signature"],
    );
  if (ctx.chain.anchorReceipt?.status !== "success")
    return finding(
      "FAIL",
      "INTEGRITY_ANCHOR_MISSING",
      "The anchor transaction is not a successful transaction on the chain",
      ids,
      ["chain"],
    );
  return finding(
    "PASS",
    "INTEGRITY_VALID",
    `${events.length} events, artifacts, the signed checkpoint and its anchor are consistent`,
    ids,
    ["artifact", "signature", "chain"],
  );
}
