import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import {
  appendEvent,
  checkpoint,
  evidenceKey,
  expireArtifacts,
  openArtifact,
  readStoredZip,
  storeArtifact,
  transaction,
  verifyCheckpoint,
  verifyEventChain,
} from "@mandate/platform";
import {
  ApiErrorSchema,
  ExportManifestSchema,
  WalletViewSchema,
  type EvidenceEvent,
} from "@mandate/schema";
import {
  admin,
  apiEnvironment,
  insertTask,
  ownerA,
  ownerB,
} from "./support.js";

after(() => admin.end());

const artifactKey = randomBytes(32);
const key = evidenceKey(randomBytes(32));

async function withEvidence(
  run: (
    e: Awaited<ReturnType<typeof apiEnvironment>>,
    ids: { walletId: string; taskId: string; owner: string },
  ) => Promise<void>,
) {
  const e = await apiEnvironment({
    business: { chain: null, evidence: { artifactKey, key } },
  });
  try {
    const owner = await e.login(ownerA);
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", owner, {})).json(),
    ).walletId;
    // Evidence needs a deployed wallet address; provisioning itself is tested in the worker.
    await e.pool.query(
      "UPDATE wallets SET wallet_address=$2,deployment_block=100 WHERE id=$1",
      [walletId, "0x" + randomBytes(20).toString("hex")],
    );
    const taskId = await insertTask(e.pool, walletId, e.now());
    await run(e, { walletId, taskId, owner });
  } finally {
    await e.close();
  }
}

const events = async (pool: Pool, taskId: string) =>
  (
    await pool.query<{ event: EvidenceEvent }>(
      "SELECT event FROM evidence_events WHERE task_id=$1 ORDER BY sequence",
      [taskId],
    )
  ).rows.map((r) => r.event);

test("P2-05.T01 concurrent appenders get a contiguous hash chain; a retried transition writes no duplicate; rolled-back writes leave no gap", () =>
  withEvidence(async (e, { taskId }) => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        transaction(e.pool, (c) =>
          appendEvent(
            c,
            {
              taskId,
              type: "AGENT_DECISION",
              dedupeKey: "d" + i,
              payload: { i },
            },
            e.now(),
          ),
        ),
      ),
    );
    const again = await transaction(e.pool, (c) =>
      appendEvent(
        c,
        { taskId, type: "AGENT_DECISION", dedupeKey: "d3", payload: { i: 99 } },
        e.now(),
      ),
    );
    assert.equal(again.payload.i, 3);
    // Crash between event and outbox write: the whole transaction rolls back.
    await assert.rejects(
      transaction(e.pool, async (c) => {
        await appendEvent(
          c,
          { taskId, type: "ACTION_SIGNED", dedupeKey: "crash", payload: {} },
          e.now(),
        );
        throw new Error("process died before outbox write");
      }),
    );
    await transaction(e.pool, (c) =>
      appendEvent(
        c,
        { taskId, type: "ACTION_SIGNED", dedupeKey: "crash", payload: {} },
        e.now(),
      ),
    );
    const chain = await events(e.pool, taskId);
    assert.deepEqual(
      chain.map((x) => x.sequence),
      Array.from({ length: 21 }, (_, i) => i),
    );
    assert.equal(verifyEventChain(chain), null);
    assert.equal(chain[0]!.prevHash, "0x" + "0".repeat(64));
  }));

test("P2-05.T02 changed artifact byte, salt or task AAD and edited event or checkpoint copies fail verification; the store is unchanged", () =>
  withEvidence(async (e, { taskId }) => {
    const bytes = Buffer.from("screenshot bytes");
    await transaction(e.pool, (c) =>
      storeArtifact(
        c,
        artifactKey,
        { taskId, artifactId: "shot.png", mediaType: "image/png", bytes },
        e.now(),
      ),
    );
    const row = (
      await e.pool.query("SELECT * FROM artifacts WHERE task_id=$1", [taskId])
    ).rows[0];
    assert.deepEqual(openArtifact(artifactKey, taskId, row)!.bytes, bytes);
    const flipped = Buffer.from(row.ciphertext);
    flipped[0]! ^= 1;
    assert.throws(() =>
      openArtifact(artifactKey, taskId, { ...row, ciphertext: flipped }),
    );
    assert.throws(
      () =>
        openArtifact(artifactKey, taskId, { ...row, salt: randomBytes(32) }),
      /commitment/,
    );
    assert.throws(() => openArtifact(artifactKey, crypto.randomUUID(), row));
    assert.throws(() => openArtifact(randomBytes(32), taskId, row));

    for (let i = 0; i < 3; i++)
      await transaction(e.pool, (c) =>
        appendEvent(
          c,
          {
            taskId,
            type: "PROVIDER_RESULT",
            dedupeKey: "r" + i,
            payload: { i },
          },
          e.now(),
        ),
      );
    const chain = await events(e.pool, taskId);
    const edited = structuredClone(chain);
    edited[1]!.payload = { i: 42 };
    assert.equal(verifyEventChain(edited), 1);
    assert.equal(verifyEventChain([chain[0]!, chain[2]!]), 1);
    const cp = await transaction(e.pool, (c) =>
      checkpoint(c, key, taskId, e.now()),
    );
    assert.equal(
      verifyCheckpoint(key.publicKeyHex, cp.checkpoint, cp.signature),
      true,
    );
    assert.equal(
      verifyCheckpoint(
        key.publicKeyHex,
        { ...cp.checkpoint, sequence: 1 },
        cp.signature,
      ),
      false,
    );
    assert.equal(verifyEventChain(await events(e.pool, taskId)), null);
    assert.deepEqual(
      openArtifact(
        artifactKey,
        taskId,
        (
          await e.pool.query("SELECT * FROM artifacts WHERE task_id=$1", [
            taskId,
          ])
        ).rows[0],
      )!.bytes,
      bytes,
    );
  }));

test("P2-05.T03 read-only, run-only and other-tenant credentials cannot export; evidence scope and the owner can", () =>
  withEvidence(async (e, { walletId, taskId, owner }) => {
    await transaction(e.pool, async (c) => {
      await appendEvent(
        c,
        { taskId, type: "PERMIT_ACTIVATED", dedupeKey: "p", payload: {} },
        e.now(),
      );
      await checkpoint(c, key, taskId, e.now());
    });
    const token = async (scopes: string[]) =>
      "Bearer " +
      (
        (
          await e.call("POST", "/v1/agent-tokens", owner, {
            walletId,
            taskId,
            scopes,
            expiresAt: String(e.now() + 3600),
          })
        ).json() as { token: string }
      ).token;
    for (const auth of [
      await token(["read"]),
      await token(["run", "prepare"]),
      await e.login(ownerB),
    ]) {
      const r = await e.call("GET", `/v1/tasks/${taskId}/evidence`, auth);
      assert.equal(r.statusCode, 403);
      assert.equal(ApiErrorSchema.parse(r.json()).code, "AUTH_SCOPE");
    }
    for (const auth of [await token(["evidence"]), owner]) {
      const r = await e.call("GET", `/v1/tasks/${taskId}/evidence`, auth);
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.headers["content-type"], "application/zip");
      assert.ok(readStoredZip(r.rawPayload).has("events.jsonl"));
    }
  }));

test("P2-05.T04 an export before anchoring is provisional and its checkpoint excludes its own anchor", () =>
  withEvidence(async (e, { taskId, owner }) => {
    await transaction(e.pool, async (c) => {
      await appendEvent(
        c,
        { taskId, type: "ACTION_INCLUDED", dedupeKey: "a", payload: {} },
        e.now(),
      );
      await checkpoint(c, key, taskId, e.now());
    });
    const files = readStoredZip(
      (await e.call("GET", `/v1/tasks/${taskId}/evidence`, owner)).rawPayload,
    );
    const manifest = ExportManifestSchema.parse(
      JSON.parse(files.get("manifest.json")!.toString()),
    );
    assert.equal(manifest.anchorTxHash, null);
    assert.equal(manifest.publicKeys.evidence, key.publicKeyHex);
    const cp = JSON.parse(files.get("checkpoint.json")!.toString());
    assert.equal(
      verifyCheckpoint(
        key.publicKeyHex,
        cp,
        files.get("checkpoint.sig")!.toString(),
      ),
      true,
    );
    const lines = files
      .get("events.jsonl")!
      .toString()
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.equal(cp.sequence, lines.length - 1);
    assert.ok(
      !lines.some((l: EvidenceEvent) => l.type === "CHECKPOINT_ANCHORED"),
    );
    assert.equal(verifyEventChain(lines), null);
  }));

test("P2-05.T05 retention deletes bytes after 30 days and records it; the export marks the artifact unretained", () =>
  withEvidence(async (e, { taskId, owner }) => {
    await transaction(e.pool, async (c) => {
      await storeArtifact(
        c,
        artifactKey,
        {
          taskId,
          artifactId: "log.txt",
          mediaType: "text/plain",
          bytes: Buffer.from("log"),
        },
        e.now(),
      );
      await appendEvent(
        c,
        { taskId, type: "PROVIDER_RESULT", dedupeKey: "r", payload: {} },
        e.now(),
      );
    });
    assert.equal(await expireArtifacts(e.pool, e.now() + 29 * 86400), 0);
    assert.equal(await expireArtifacts(e.pool, e.now() + 30 * 86400), 1);
    const row = (
      await e.pool.query(
        "SELECT ciphertext,iv,salt,deleted_at,sha256 FROM artifacts WHERE task_id=$1",
        [taskId],
      )
    ).rows[0];
    assert.deepEqual([row.ciphertext, row.iv, row.salt], [null, null, null]);
    assert.ok(row.deleted_at);
    const chain = await events(e.pool, taskId);
    assert.equal(chain.at(-1)!.type, "ARTIFACT_DELETED");
    await transaction(e.pool, (c) => checkpoint(c, key, taskId, e.now()));
    const files = readStoredZip(
      (await e.call("GET", `/v1/tasks/${taskId}/evidence`, owner)).rawPayload,
    );
    const index = JSON.parse(files.get("artifact-index.json")!.toString());
    assert.deepEqual(index, [
      {
        artifactId: "log.txt",
        sha256: row.sha256,
        storageCommitment: index[0].storageCommitment,
        retained: false,
      },
    ]);
    assert.ok(![...files.keys()].some((k) => k.startsWith("artifacts/")));
  }));
