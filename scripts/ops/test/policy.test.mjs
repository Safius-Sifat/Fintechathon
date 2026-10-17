import { test } from "node:test";
import assert from "node:assert/strict";
import { workflowProblems, secretProblems } from "../policy.mjs";
test("OPS-POL-01 mutable actions, privileged PR trigger and self-hosted runner fail", () => {
  const p = workflowProblems(
    "on: {pull_request_target: {}}\npermissions: write-all\njobs:\n  x:\n    runs-on: self-hosted\n    steps:\n      - uses: actions/checkout@v4\n",
  );
  assert.ok(p.includes("UNTRUSTED_TRIGGER"));
  assert.ok(p.includes("BROAD_PERMISSIONS"));
  assert.ok(p.some((x) => x.startsWith("SELF_HOSTED")));
  assert.ok(p.some((x) => x.startsWith("ACTION_NOT_PINNED")));
});
test("OPS-POL-02 pinned read-only GitHub-hosted CI accepted", () => {
  assert.deepEqual(
    workflowProblems(
      "on: {pull_request: {}}\npermissions: {contents: read}\njobs:\n  x:\n    runs-on: ubuntu-24.04\n    steps:\n      - uses: actions/checkout@" +
        "a".repeat(40) +
        "\n",
    ),
    [],
  );
});
test("OPS-POL-05 secret filename/content scan reports types without values", () => {
  assert.deepEqual(secretProblems(".env", "value"), ["PRIVATE_FILE"]);
  assert.deepEqual(secretProblems(".env.example", "POSTGRES_PASSWORD="), []);
  assert.deepEqual(
    secretProblems("src/key.ts", "-----BEGIN " + "PRIVATE KEY-----"),
    ["PRIVATE_KEY_CONTENT"],
  );
  assert.deepEqual(
    secretProblems("example.md", "a harmless public address"),
    [],
  );
});
test("array privileged PR trigger also rejected", () => {
  assert.ok(
    workflowProblems("on: [pull_request_target]\njobs: {}\n").includes(
      "UNTRUSTED_TRIGGER",
    ),
  );
});
