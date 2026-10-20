import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { RUNBOOK_IDS, TermsSchema } from "@mandate/schema";
import { SAMPLE_INTENT } from "../src/config/policySamples";
import {
  EDITABLE_TERMS,
  TERM_ORDER,
  clearAllIntentDrafts,
  clearIntentDraft,
  editedTerms,
  getIntentDraft,
  loadCompiledIntent,
  reviewRows,
  setIntentGoal,
  switchIntentContext,
  toggleIntentProvider,
  updateIntentTerms,
  validateIntentTerms,
} from "../src/state/intentDraft";

const ACCOUNT_A = { accountId: "account-a", chainId: 84532 };
const ACCOUNT_B = { accountId: "account-b", chainId: 84532 };

afterEach(() => clearAllIntentDrafts());

test("UI-08 intent review: shows every shared Terms field, in order", () => {
  assert.deepEqual([...TERM_ORDER], Object.keys(TermsSchema.shape));
  setIntentGoal(ACCOUNT_A, "Check the staging checkout");
  loadCompiledIntent(ACCOUNT_A, SAMPLE_INTENT);
  const rows = reviewRows(getIntentDraft(ACCOUNT_A));
  assert.deepEqual(
    rows.map((r) => r.key),
    [...TERM_ORDER],
  );
  for (const key of ["asset", "reviewThreshold", "templateIds"] as const) {
    const row = rows.find((r) => r.key === key);
    assert.ok(row && row.label.trim() && row.value.trim(), key);
  }
});

test("UI-08 intent review: without a draft every term is not drafted, never a value", () => {
  setIntentGoal(ACCOUNT_A, "Check the staging checkout");
  const rows = reviewRows(getIntentDraft(ACCOUNT_A));
  assert.equal(rows.length, Object.keys(TermsSchema.shape).length);
  for (const row of rows) {
    assert.equal(row.value, "Not drafted yet", row.key);
    assert.equal(row.edited, false, row.key);
  }
});

test("UI-08 intent review: shown terms are the owner's edits, not the compiled draft", () => {
  loadCompiledIntent(ACCOUNT_A, SAMPLE_INTENT);
  assert.deepEqual(editedTerms(getIntentDraft(ACCOUNT_A)), []);
  updateIntentTerms(ACCOUNT_A, { spendCap: "0.6", reviewThreshold: "" });
  toggleIntentProvider(ACCOUNT_A, "b");

  const draft = getIntentDraft(ACCOUNT_A);
  assert.deepEqual(editedTerms(draft), [
    "spendCap",
    "reviewThreshold",
    "recipients",
  ]);
  const rows = reviewRows(draft);
  const spend = rows.find((r) => r.key === "spendCap");
  assert.equal(spend?.edited, true);
  assert.match(spend?.value ?? "", /0\.60/);
  assert.doesNotMatch(
    spend?.value ?? "",
    new RegExp(SAMPLE_INTENT.terms.spendCap.replace(".", "\\.")),
  );
  assert.match(
    rows.find((r) => r.key === "reviewThreshold")?.value ?? "",
    /never/i,
  );
  assert.equal(rows.find((r) => r.key === "asset")?.edited, false);
  // The compiled draft itself is kept unchanged for comparison.
  assert.deepEqual(draft.compiled?.terms, SAMPLE_INTENT.terms);
});

test("UI-08 intent review: reverting an edit clears its mark", () => {
  loadCompiledIntent(ACCOUNT_A, SAMPLE_INTENT);
  updateIntentTerms(ACCOUNT_A, { maxPayment: "0.1" });
  updateIntentTerms(ACCOUNT_A, { maxPayment: SAMPLE_INTENT.terms.maxPayment });
  assert.deepEqual(editedTerms(getIntentDraft(ACCOUNT_A)), []);
});

test("UI-08 intent review: edited terms are checked against the S2 ceilings", () => {
  const ok = validateIntentTerms(SAMPLE_INTENT.terms);
  assert.equal(ok.complete, true);
  const bad = validateIntentTerms({
    ...SAMPLE_INTENT.terms,
    maxPayment: "0.6",
    spendCap: "2.5",
    providerIds: [],
  });
  assert.equal(bad.complete, false);
  assert.match(bad.fieldErrors.maxPayment ?? "", /0\.50/);
  assert.match(bad.fieldErrors.spendCap ?? "", /2\.00/);
  assert.ok(bad.missing.length > 0, "a provider is required");
  const order = validateIntentTerms({
    ...SAMPLE_INTENT.terms,
    maxPayment: "0.5",
    spendCap: "0.4",
  });
  assert.ok(order.fieldErrors.spendCap, "spend cap below one payment");
});

test("UI-08 intent review: the sample compiles only to a known runbook and editable terms", () => {
  assert.ok(
    (RUNBOOK_IDS as readonly string[]).includes(SAMPLE_INTENT.runbookId),
  );
  for (const key of EDITABLE_TERMS)
    assert.ok((TERM_ORDER as readonly string[]).includes(key), key);
  assert.ok(SAMPLE_INTENT.explanation.trim());
  assert.match(SAMPLE_INTENT.label, /development sample/i);
});

test("UI-08 intent review: drafts belong to one account and leaving clears them", () => {
  setIntentGoal(ACCOUNT_A, "goal A");
  loadCompiledIntent(ACCOUNT_A, SAMPLE_INTENT);
  setIntentGoal(ACCOUNT_B, "goal B");
  assert.equal(getIntentDraft(ACCOUNT_A).goal, "goal A");
  assert.equal(getIntentDraft(ACCOUNT_B).compiled, null);
  switchIntentContext(ACCOUNT_A, ACCOUNT_B);
  assert.equal(getIntentDraft(ACCOUNT_A).goal, "");
  assert.equal(getIntentDraft(ACCOUNT_A).compiled, null);
  clearIntentDraft(ACCOUNT_B);
  assert.equal(getIntentDraft(ACCOUNT_B).goal, "");
});
