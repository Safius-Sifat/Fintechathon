import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  CHAIN_ID,
  CheckpointSchema,
  EvidenceEventSchema,
  ExportManifestSchema,
  canonicalJson,
  hashCanonical,
  ZERO_HASH,
  type EvidenceEvent,
} from "@mandate/schema";
import { storedZip } from "./zip.js";

const RETENTION_SECONDS = 30 * 86400;
export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const sha256 = (...parts: Uint8Array[]) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return "0x" + h.digest("hex");
};

export const eventHash = (event: Omit<EvidenceEvent, "eventHash">) =>
  hashCanonical(event);

// Appends under the task row lock: contiguous sequence, prevHash link, and a
// dedupe key so a retried logical transition never writes a second event.
export async function appendEvent(
  c: PoolClient,
  input: {
    taskId: string;
    type: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    requestId?: string | null;
    permitId?: string | null;
  },
  now: number,
): Promise<EvidenceEvent> {
  const task = (
    await c.query<{ chain_task_id: string; wallet_address: string | null }>(
      "SELECT t.chain_task_id,w.wallet_address FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1 FOR UPDATE OF t",
      [input.taskId],
    )
  ).rows[0];
  if (!task?.wallet_address)
    throw new Error("Evidence requires a task on a deployed wallet");
  const prior = (
    await c.query<{ event: EvidenceEvent }>(
      "SELECT event FROM evidence_events WHERE task_id=$1 AND dedupe_key=$2",
      [input.taskId, input.dedupeKey],
    )
  ).rows[0];
  if (prior) return prior.event;
  const head = (
    await c.query<{ sequence: number; event_hash: string }>(
      "SELECT sequence,event_hash FROM evidence_events WHERE task_id=$1 ORDER BY sequence DESC LIMIT 1",
      [input.taskId],
    )
  ).rows[0];
  const body = {
    schemaVersion: 4 as const,
    eventId: randomUUID(),
    taskId: input.taskId,
    chainTaskId: task.chain_task_id,
    wallet: task.wallet_address,
    sequence: head ? head.sequence + 1 : 0,
    recordedAt: String(now),
    type: input.type,
    requestId: input.requestId ?? null,
    permitId: input.permitId ?? null,
    payload: input.payload,
    prevHash: head?.event_hash ?? ZERO_HASH,
  };
  const event = EvidenceEventSchema.parse({
    ...body,
    eventHash: eventHash(
      EvidenceEventSchema.omit({ eventHash: true }).parse(body),
    ),
  });
  await c.query(
    "INSERT INTO evidence_events(task_id,sequence,event_id,type,event,prev_hash,event_hash,dedupe_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      input.taskId,
      event.sequence,
      event.eventId,
      event.type,
      event,
      event.prevHash,
      event.eventHash,
      input.dedupeKey,
    ],
  );
  return event;
}

// Recomputes every hash and link; returns the first broken sequence or null.
export function verifyEventChain(
  events: readonly EvidenceEvent[],
): number | null {
  let prev = ZERO_HASH as string;
  for (let i = 0; i < events.length; i++) {
    const e = EvidenceEventSchema.safeParse(events[i]);
    if (!e.success) return i;
    const { eventHash: stored, ...rest } = e.data;
    if (
      e.data.sequence !== i ||
      e.data.prevHash !== prev ||
      eventHash(rest) !== stored
    )
      return i;
    prev = stored;
  }
  return null;
}

const aad = (taskId: string, artifactId: string) =>
  Buffer.from(`${taskId}/${artifactId}`, "utf8");

export async function storeArtifact(
  c: PoolClient,
  key: Buffer,
  input: {
    taskId: string;
    artifactId: string;
    mediaType: "image/png" | "text/plain" | "application/json";
    bytes: Buffer;
  },
  now: number,
) {
  if (key.length !== 32) throw new Error("Artifact key must be 32 bytes");
  if (input.bytes.length > MAX_ARTIFACT_BYTES)
    throw new Error("Artifact exceeds 10 MiB");
  const iv = randomBytes(12);
  const salt = randomBytes(32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(input.taskId, input.artifactId));
  const ciphertext = Buffer.concat([
    cipher.update(input.bytes),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const record = {
    sha256: sha256(input.bytes),
    storageCommitment: sha256(salt, input.bytes),
  };
  await c.query(
    "INSERT INTO artifacts(task_id,artifact_id,media_type,sha256,storage_commitment,byte_length,iv,salt,ciphertext,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      input.taskId,
      input.artifactId,
      input.mediaType,
      record.sha256,
      record.storageCommitment,
      input.bytes.length,
      iv,
      salt,
      ciphertext,
      now + RETENTION_SECONDS,
      now,
    ],
  );
  return record;
}

type ArtifactRow = {
  artifact_id: string;
  media_type: string;
  sha256: string;
  storage_commitment: string;
  iv: Buffer | null;
  salt: Buffer | null;
  ciphertext: Buffer | null;
};

// Decrypts and checks the storage commitment; any tampering throws.
export function openArtifact(
  key: Buffer,
  taskId: string,
  row: ArtifactRow,
): { bytes: Buffer; salt: Buffer } | null {
  if (!row.ciphertext || !row.iv || !row.salt) return null;
  const decipher = createDecipheriv("aes-256-gcm", key, row.iv);
  decipher.setAAD(aad(taskId, row.artifact_id));
  decipher.setAuthTag(row.ciphertext.subarray(row.ciphertext.length - 16));
  const bytes = Buffer.concat([
    decipher.update(row.ciphertext.subarray(0, row.ciphertext.length - 16)),
    decipher.final(),
  ]);
  if (
    sha256(row.salt, bytes) !== row.storage_commitment ||
    sha256(bytes) !== row.sha256
  )
    throw new Error("Artifact commitment mismatch");
  return { bytes, salt: row.salt };
}

// Deletes expired bytes and records the deletion as a new event.
export async function expireArtifacts(
  database: Pool,
  now: number,
): Promise<number> {
  const due = await database.query<{ task_id: string; artifact_id: string }>(
    "SELECT task_id,artifact_id FROM artifacts WHERE deleted_at IS NULL AND expires_at<=$1",
    [now],
  );
  for (const a of due.rows) {
    const c = await database.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "UPDATE artifacts SET ciphertext=NULL,iv=NULL,salt=NULL,deleted_at=$3 WHERE task_id=$1 AND artifact_id=$2 AND deleted_at IS NULL",
        [a.task_id, a.artifact_id, now],
      );
      await appendEvent(
        c,
        {
          taskId: a.task_id,
          type: "ARTIFACT_DELETED",
          dedupeKey: "artifact-deleted:" + a.artifact_id,
          payload: { artifactId: a.artifact_id, reason: "retention" },
        },
        now,
      );
      await c.query("COMMIT");
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
  }
  return due.rowCount ?? 0;
}

export type EvidenceKey = { privateKey: KeyObject; publicKeyHex: string };
export function evidenceKey(seed: Buffer): EvidenceKey {
  if (seed.length !== 32) throw new Error("Evidence key seed must be 32 bytes");
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      seed,
    ]),
    format: "der",
    type: "pkcs8",
  });
  const der = createPublicKey(privateKey).export({
    format: "der",
    type: "spki",
  });
  return {
    privateKey,
    publicKeyHex: "0x" + der.subarray(der.length - 32).toString("hex"),
  };
}

export function verifyCheckpoint(
  publicKeyHex: string,
  checkpoint: unknown,
  signatureHex: string,
): boolean {
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
}

// Signs the current head. The anchor transaction for this checkpoint is never an
// event inside it; a later checkpoint may include it.
export async function checkpoint(
  c: PoolClient,
  key: EvidenceKey,
  taskId: string,
  now: number,
) {
  const head = (
    await c.query<{
      sequence: number;
      event_hash: string;
      chain_task_id: string;
      wallet_address: string;
    }>(
      "SELECT e.sequence,e.event_hash,t.chain_task_id,w.wallet_address FROM evidence_events e JOIN tasks t ON t.id=e.task_id JOIN wallets w ON w.id=t.wallet_id WHERE e.task_id=$1 ORDER BY e.sequence DESC LIMIT 1",
      [taskId],
    )
  ).rows[0];
  if (!head) throw new Error("No evidence to checkpoint");
  const body = CheckpointSchema.parse({
    schemaVersion: 4,
    chainId: CHAIN_ID,
    wallet: head.wallet_address,
    taskId: head.chain_task_id,
    sequence: head.sequence,
    headHash: head.event_hash,
  });
  const bytes = Buffer.from(canonicalJson(body));
  const signature = "0x" + sign(null, bytes, key.privateKey).toString("hex");
  const digest = sha256(bytes);
  await c.query(
    "INSERT INTO checkpoints(task_id,sequence,checkpoint,signature,digest,anchor_state,created_at) VALUES($1,$2,$3,$4,$5,'UNANCHORED',$6) ON CONFLICT (task_id,sequence) DO NOTHING",
    [taskId, head.sequence, body, signature, digest, now],
  );
  return { checkpoint: body, signature, digest };
}

// Builds the S6 bundle. Artifact plaintext and salts are included only when the
// caller has evidence access; the backend's own findings are not part of it.
export async function exportBundle(
  database: Pool,
  artifactKey: Buffer,
  evidence: EvidenceKey,
  taskId: string,
) {
  const events = (
    await database.query<{ event: EvidenceEvent }>(
      "SELECT event FROM evidence_events WHERE task_id=$1 ORDER BY sequence",
      [taskId],
    )
  ).rows.map((r) => r.event);
  if (verifyEventChain(events) !== null)
    throw new Error("Stored evidence chain is inconsistent");
  const latest = (
    await database.query<{
      checkpoint: unknown;
      signature: string;
      anchor_tx: string | null;
      anchor_state: string;
    }>(
      "SELECT c.checkpoint,c.signature,t.tx_hash AS anchor_tx,c.anchor_state FROM checkpoints c LEFT JOIN transactions t ON t.id=c.anchor_tx_id WHERE c.task_id=$1 ORDER BY c.sequence DESC LIMIT 1",
      [taskId],
    )
  ).rows[0];
  if (!latest) throw new Error("Task has no checkpoint");
  const task = (
    await database.query<{
      chain_task_id: string;
      wallet_address: string;
      deployment_block: string;
    }>(
      "SELECT t.chain_task_id,w.wallet_address,w.deployment_block::text FROM tasks t JOIN wallets w ON w.id=t.wallet_id WHERE t.id=$1",
      [taskId],
    )
  ).rows[0]!;
  const authority = (
    await database.query<{
      permit: unknown;
      owner_signature: string;
      scope: unknown;
      authority_state: string;
    }>(
      "SELECT p.permit,p.owner_signature,d.scope,p.authority_state FROM permits p JOIN permit_drafts d ON d.id=p.draft_id WHERE p.task_id=$1",
      [taskId],
    )
  ).rows[0];
  const transactions = (
    await database.query<Record<string, unknown>>(
      'SELECT t.tx_hash AS "txHash",t.sender,t.nonce::text,t.purpose,t.state,t.block_number::text AS "blockNumber",t.replaces,a.request_id AS "requestId" FROM transactions t JOIN actions a ON a.id=t.action_id WHERE a.task_id=$1 ORDER BY t.journaled_at,t.id',
      [taskId],
    )
  ).rows;
  const artifacts = (
    await database.query<ArtifactRow>(
      "SELECT artifact_id,media_type,sha256,storage_commitment,iv,salt,ciphertext FROM artifacts WHERE task_id=$1 ORDER BY artifact_id",
      [taskId],
    )
  ).rows;
  const toBlock = transactions.reduce(
    (m, t) =>
      t.blockNumber && BigInt(t.blockNumber as string) > m
        ? BigInt(t.blockNumber as string)
        : m,
    BigInt(task.deployment_block),
  );
  const manifest = ExportManifestSchema.parse({
    schemaVersion: 4,
    chainId: CHAIN_ID,
    wallet: task.wallet_address,
    taskId,
    chainTaskId: task.chain_task_id,
    inspection: {
      fromBlock: task.deployment_block,
      toBlock: toBlock.toString(),
    },
    publicKeys: { evidence: evidence.publicKeyHex },
    retainedHashes: artifacts.filter((a) => a.ciphertext).map((a) => a.sha256),
    // Null until the anchor is included; the export is provisional before that.
    anchorTxHash:
      latest.anchor_state === "INCLUDED" || latest.anchor_state === "FINALIZED"
        ? latest.anchor_tx
        : null,
  });
  const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
  const files: { path: string; bytes: Uint8Array }[] = [
    { path: "manifest.json", bytes: json(manifest) },
    {
      path: "events.jsonl",
      bytes: Buffer.from(events.map((e) => canonicalJson(e)).join("\n") + "\n"),
    },
    {
      path: "checkpoint.json",
      bytes: Buffer.from(canonicalJson(latest.checkpoint)),
    },
    { path: "checkpoint.sig", bytes: Buffer.from(latest.signature) },
    { path: "authority.json", bytes: json(authority ?? {}) },
    { path: "transactions.json", bytes: json(transactions) },
    {
      path: "artifact-index.json",
      bytes: json(
        artifacts.map((a) => ({
          artifactId: a.artifact_id,
          sha256: a.sha256,
          storageCommitment: a.storage_commitment,
          retained: a.ciphertext !== null,
        })),
      ),
    },
  ];
  for (const a of artifacts) {
    const opened = openArtifact(artifactKey, taskId, a);
    if (!opened) continue;
    files.push({ path: `artifacts/${a.artifact_id}`, bytes: opened.bytes });
    files.push({
      path: `artifacts/${a.artifact_id}.salt`,
      bytes: Buffer.from("0x" + opened.salt.toString("hex")),
    });
  }
  return { zip: storedZip(files), manifest };
}
