import { readFile } from "node:fs/promises";
import { EvidenceBundleSchema, type EvidenceBundle } from "@mandate/schema";
import { readStoredZip } from "./zip.js";

const text = (files: Map<string, Buffer>, path: string) => {
  const f = files.get(path);
  if (!f) throw new Error(`Archive is missing ${path}`);
  return f.toString("utf8");
};

// Turns the export ZIP (manifest.json, events.jsonl, checkpoint.json,
// checkpoint.sig, authority.json, transactions.json, artifact-index.json,
// artifacts/<id>) into a bundle object. Shape is checked by the schema.
export function bundleFromZip(zip: Buffer): EvidenceBundle {
  const files = readStoredZip(zip);
  const artifacts: Record<string, string> = {};
  for (const [path, bytes] of files) {
    const m = /^artifacts\/([^/]+)$/.exec(path);
    if (m && !path.endsWith(".salt"))
      artifacts[m[1]!] = `0x${bytes.toString("hex")}`;
  }
  return EvidenceBundleSchema.parse({
    manifest: JSON.parse(text(files, "manifest.json")),
    events: text(files, "events.jsonl")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l)),
    checkpoint: JSON.parse(text(files, "checkpoint.json")),
    checkpointSig: text(files, "checkpoint.sig").trim(),
    authority: JSON.parse(text(files, "authority.json")),
    transactions: JSON.parse(text(files, "transactions.json")),
    artifactIndex: JSON.parse(text(files, "artifact-index.json")),
    artifacts,
  });
}

// Accepts the export ZIP, a JSON bundle file, a JSON string or an object.
export async function loadBundle(
  input: string | object,
): Promise<EvidenceBundle> {
  if (typeof input !== "string") return EvidenceBundleSchema.parse(input);
  if (input.trim().startsWith("{"))
    return EvidenceBundleSchema.parse(JSON.parse(input));
  const raw = await readFile(input);
  if (raw.subarray(0, 2).toString() === "PK") return bundleFromZip(raw);
  return EvidenceBundleSchema.parse(JSON.parse(raw.toString("utf8")));
}

// Reads the evidence public key from a separately trusted deployment
// manifest. The key inside the bundle itself is never trusted.
export async function loadTrustedEvidenceKey(
  path: string,
): Promise<`0x${string}`> {
  const manifest = JSON.parse(await readFile(path, "utf8")) as {
    evidence?: { ed25519PublicKey?: string };
  };
  const key = manifest.evidence?.ed25519PublicKey;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error("Trusted manifest has no evidence.ed25519PublicKey");
  return key as `0x${string}`;
}
