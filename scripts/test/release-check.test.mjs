import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateRelease } from "../release-check.mjs";

const repo = new URL("../../", import.meta.url).pathname;
const manifest = JSON.parse(
  readFileSync(join(repo, "packages/schema/fixtures/manifest-v7.json"), "utf8"),
).valid;
const commit = "a".repeat(40);

const record = (caseId, status = "PASS", extra = {}) => ({
  caseId,
  status,
  sourceCommit: commit,
  exitCode: status === "PASS" ? 0 : null,
  observed: "as expected",
  ...extra,
});

/// Builds a minimal repository: two plan cases, one wallet case, evidence and a deployment.
function fixture({ records, withManifest = true, deployment } = {}) {
  const root = mkdtempSync(join(tmpdir(), "release-check-"));
  mkdirSync(join(root, "docs/plans"), { recursive: true });
  writeFileSync(
    join(root, "docs/plans/01 - Contracts.md"),
    "| Case ID | Setup | Outcome |\n| --- | --- | --- |\n| `P1-06.T01` | a | b |\n| `P1-06.T05` | a | b |\n",
  );
  writeFileSync(
    join(root, "docs/COMPLETE-APP.md"),
    "Required wallet cases: WQ01 create/import; WQ02 isolation.\n",
  );
  mkdirSync(join(root, "evidence/person1/cases"), { recursive: true });
  const all = records ?? [
    record("P1-06.T01"),
    record("P1-06.T05"),
    record("WQ01"),
    record("WQ02"),
  ];
  writeFileSync(
    join(root, "evidence/person1/cases/P1-06.json"),
    JSON.stringify(all),
  );
  mkdirSync(join(root, "deployments"), { recursive: true });
  if (withManifest)
    writeFileSync(
      join(root, "deployments/base-sepolia.json"),
      JSON.stringify(manifest),
    );
  writeFileSync(
    join(root, "evidence/person1/deployment.json"),
    JSON.stringify(
      deployment ?? { chainId: 84532, contracts: manifest.contracts },
    ),
  );
  return root;
}

test("P1-06.T05 complete evidence and a matching manifest pass", () => {
  const r = evaluateRelease({ root: fixture() });
  assert.deepEqual(
    [r.status, r.missing, r.failed, r.invalid, r.manifestErrors],
    ["PASS", [], [], [], []],
  );
  assert.equal(r.required, 4);
});

test("P1-06.T05 a missing mandatory case keeps the release incomplete", () => {
  const r = evaluateRelease({
    root: fixture({
      records: [record("P1-06.T01"), record("WQ01"), record("WQ02")],
    }),
  });
  assert.equal(r.status, "INCOMPLETE");
  assert.deepEqual(r.missing, ["P1-06.T05"]);
});

test("P1-06.T05 a failed case fails even when another record passes", () => {
  const records = [
    record("P1-06.T01"),
    record("P1-06.T01", "FAIL"),
    record("P1-06.T05"),
    record("WQ01"),
    record("WQ02"),
  ];
  const r = evaluateRelease({ root: fixture({ records }) });
  assert.equal(r.status, "FAIL");
  assert.deepEqual(r.failed, ["P1-06.T01"]);
});

test("P1-06.T05 local, blocked and malformed results do not count as PASS", () => {
  const records = [
    record("P1-06.T01", "LOCAL_PASS"),
    record("P1-06.T05", "PASS", { exitCode: 1 }),
    record("WQ01", "BLOCKED"),
    record("WQ02", "PASS", { sourceCommit: "dirty" }),
  ];
  const r = evaluateRelease({ root: fixture({ records }) });
  assert.equal(r.status, "INCOMPLETE");
  assert.deepEqual(r.missing, ["P1-06.T01", "P1-06.T05", "WQ01", "WQ02"]);
  assert.deepEqual(
    r.invalid.map((i) => i.caseId),
    ["P1-06.T05", "WQ02"],
  );
});

test("P1-06.T05 a case file that is not an array of records is reported and not counted", () => {
  const root = fixture();
  writeFileSync(
    join(root, "evidence/person1/cases/P1-06.json"),
    JSON.stringify({ task: "P1-06", status: "PASS" }),
  );
  const r = evaluateRelease({ root });
  assert.equal(r.status, "INCOMPLETE");
  assert.deepEqual(r.invalidFiles, ["evidence/person1/cases/P1-06.json"]);
  assert.equal(r.passed, 0);
});

test("P1-06.T05 an absent or schema-invalid manifest blocks the release", () => {
  assert.equal(
    evaluateRelease({ root: fixture({ withManifest: false }) }).status,
    "INCOMPLETE",
  );
  const root = fixture();
  writeFileSync(
    join(root, "deployments/base-sepolia.json"),
    JSON.stringify({ ...manifest, walletDomainVersion: "4" }),
  );
  const r = evaluateRelease({ root });
  assert.equal(r.status, "FAIL");
  assert.match(r.manifestErrors.join("\n"), /walletDomainVersion/);
});

test("P1-06.T05 a manifest that differs from the recorded deployment fails", () => {
  const contracts = structuredClone(manifest.contracts);
  contracts.factory.codeHash = `0x${"b".repeat(64)}`;
  const r = evaluateRelease({
    root: fixture({ deployment: { chainId: 84532, contracts } }),
  });
  assert.equal(r.status, "FAIL");
  assert.deepEqual(r.manifestErrors, [
    "contracts.factory.codeHash differs from evidence/person1/deployment.json",
  ]);
});

test("P1-06.T05 the repository today is not releasable", () => {
  const r = evaluateRelease({ root: repo });
  assert.notEqual(r.status, "PASS");
  assert.ok(r.required > 100);
});
