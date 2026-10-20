import { createHash } from "node:crypto";
import { type EvidenceBundle, type Finding, ZERO_HASH } from "@mandate/schema";

export function checkIntegrity(bundle: EvidenceBundle): Finding {
  const { events, checkpoint, artifactIndex, artifacts } = bundle;
  const evidenceIds = events.map((e) => e.eventId);

  // 1. Check sequence and event hash chain
  let expectedPrevHash = ZERO_HASH;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (ev.sequence !== i) {
      return {
        name: "integrity",
        state: "FAIL",
        ruleId: "INTEGRITY_SEQUENCE_MISMATCH",
        reason: `Event sequence broken at index ${i}: expected ${i}, found ${ev.sequence}`,
        evidenceIds,
        basis: ["artifact"],
      };
    }

    if (ev.prevHash.toLowerCase() !== expectedPrevHash.toLowerCase()) {
      return {
        name: "integrity",
        state: "FAIL",
        ruleId: "INTEGRITY_HASH_CHAIN_BROKEN",
        reason: `Event prevHash mismatch at sequence ${ev.sequence}: expected ${expectedPrevHash}, found ${ev.prevHash}`,
        evidenceIds,
        basis: ["artifact"],
      };
    }
    expectedPrevHash = ev.eventHash;
  }

  // 2. Check checkpoint head hash
  if (events.length > 0) {
    const lastEvent = events[events.length - 1]!;
    if (
      checkpoint.headHash.toLowerCase() !== lastEvent.eventHash.toLowerCase()
    ) {
      return {
        name: "integrity",
        state: "FAIL",
        ruleId: "INTEGRITY_CHECKPOINT_HEAD_MISMATCH",
        reason: `Checkpoint headHash ${checkpoint.headHash} does not match final eventHash ${lastEvent.eventHash}`,
        evidenceIds,
        basis: ["artifact"],
      };
    }
  }

  // 3. Check artifact index integrity
  for (const entry of artifactIndex) {
    if (entry.retained) {
      const artData = artifacts[entry.artifactId];
      if (!artData) {
        return {
          name: "integrity",
          state: "UNVERIFIABLE",
          ruleId: "INTEGRITY_ARTIFACT_MISSING",
          reason: `Retained artifact ${entry.artifactId} missing from bundle payload`,
          evidenceIds,
          basis: ["artifact"],
        };
      }
      const digest = `0x${createHash("sha256")
        .update(Buffer.from(String(artData).replace(/^0x/, ""), "hex"))
        .digest("hex")}`;
      if (digest.toLowerCase() !== entry.sha256.toLowerCase()) {
        return {
          name: "integrity",
          state: "FAIL",
          ruleId: "INTEGRITY_ARTIFACT_HASH_MISMATCH",
          reason: `Artifact ${entry.artifactId} does not match its recorded sha256`,
          evidenceIds,
          basis: ["artifact"],
        };
      }
    }
  }

  // Links, sequence and artifact hashes are consistent. Event hashes are not
  // recomputed, and the checkpoint signature and anchor are not checked, so
  // this does not prove the record is untampered.
  return {
    name: "integrity",
    state: "UNVERIFIABLE",
    ruleId: "INTEGRITY_PARTIAL",
    reason: `Sequence, hash links and artifact hashes are consistent across ${events.length} events; event hashes, the checkpoint signature and the anchor were not checked`,
    evidenceIds,
    basis: ["artifact"],
  };
}
