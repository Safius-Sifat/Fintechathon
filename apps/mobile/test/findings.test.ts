import assert from "node:assert/strict";
import { test } from "node:test";
import { FindingSchema, type Finding } from "@mandate/schema";
import {
  FINDING_NAMES,
  isAssertionOnly,
  summarizeFindings,
} from "../src/config/findings";

const pass = (name: Finding["name"]): Finding => ({
  name,
  state: "PASS",
  ruleId: `${name}-rule`,
  reason: "",
  evidenceIds: [],
  basis: ["chain", "signature"],
});

const allPass = () => FINDING_NAMES.map(pass);

test("UI-07 findings: the six categories match the shared Finding schema in order", () => {
  assert.deepEqual([...FINDING_NAMES], FindingSchema.shape.name.options);
});

test("UI-07 findings: all six PASS with independent basis is all passed", () => {
  assert.equal(summarizeFindings(allPass()), "allPassed");
});

test("UI-07 findings: PENDING or UNVERIFIABLE is incomplete, never all passed", () => {
  for (const state of ["PENDING", "UNVERIFIABLE"] as const) {
    const findings = allPass();
    findings[3] = { ...findings[3]!, state };
    assert.equal(summarizeFindings(findings), "incomplete", state);
  }
});

test("UI-07 findings: a missing category or an empty report is incomplete", () => {
  assert.equal(summarizeFindings(allPass().slice(1)), "incomplete");
  assert.equal(summarizeFindings([]), "incomplete");
});

test("UI-07 findings: any FAIL makes the report failed", () => {
  const findings = allPass();
  findings[0] = { ...findings[0]!, state: "PENDING" };
  findings[4] = { ...findings[4]!, state: "FAIL" };
  assert.equal(summarizeFindings(findings), "failed");
});

test("UI-07 findings: a PASS backed only by a recorder assertion is not independent proof", () => {
  const findings = allPass();
  findings[5] = { ...findings[5]!, basis: ["recorder_assertion"] };
  assert.equal(isAssertionOnly(findings[5]!), true);
  assert.equal(isAssertionOnly(findings[0]!), false);
  assert.equal(isAssertionOnly({ ...findings[0]!, basis: [] }), true);
  assert.equal(summarizeFindings(findings), "incomplete");
});
