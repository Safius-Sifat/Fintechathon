import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  EMPTY_TASK_DRAFTS,
  allowanceSummary,
  clearAllTaskDrafts,
  clearTaskDraft,
  getTaskDrafts,
  toggleAllowanceProvider,
  updateAllowanceDraft,
  validateAllowanceDraft,
  type AllowanceDraft,
} from "../src/state/taskDraft";

const ACCOUNT_A = { accountId: "account-a", chainId: 84532 };

afterEach(() => clearAllTaskDrafts());

const FILLED: AllowanceDraft = {
  asset: "DemoUSD",
  period: "daily",
  periodCap: "2",
  spendCap: "10",
  maxPayment: "0.5",
  providerIds: ["a"],
  days: "7",
  maxPurchases: "50",
};

test("UI-08 allowance: starts empty with nothing chosen", () => {
  const { allowance } = EMPTY_TASK_DRAFTS;
  assert.equal(allowance.asset, "DemoUSD");
  assert.equal(allowance.period, "daily");
  assert.deepEqual(allowance.providerIds, []);
  for (const field of [
    "periodCap",
    "spendCap",
    "maxPayment",
    "days",
    "maxPurchases",
  ] as const)
    assert.equal(allowance[field], "", field);
  assert.equal(validateAllowanceDraft(allowance).complete, false);
  assert.equal(allowanceSummary(allowance), null);
});

test("UI-08 allowance: limits above the S2 ceilings are rejected", () => {
  const daily = validateAllowanceDraft({
    ...FILLED,
    periodCap: "10.01",
    maxPayment: "0.51",
    days: "31",
    maxPurchases: "201",
  });
  assert.equal(daily.complete, false);
  assert.match(daily.fieldErrors.periodCap ?? "", /10\.00/);
  assert.match(daily.fieldErrors.maxPayment ?? "", /0\.50/);
  assert.match(daily.fieldErrors.days ?? "", /30/);
  assert.match(daily.fieldErrors.maxPurchases ?? "", /200/);

  // The weekly ceiling is higher than the daily one.
  const weekly = validateAllowanceDraft({
    ...FILLED,
    period: "weekly",
    periodCap: "25",
  });
  assert.equal(weekly.complete, true);
  const overWeekly = validateAllowanceDraft({
    ...FILLED,
    period: "weekly",
    periodCap: "25.01",
  });
  assert.match(overWeekly.fieldErrors.periodCap ?? "", /25\.00/);
});

test("UI-08 allowance: one purchase cannot exceed the period cap, and zero is not a limit", () => {
  const check = validateAllowanceDraft({
    ...FILLED,
    periodCap: "0.4",
    spendCap: "0",
    days: "0",
  });
  assert.ok(check.fieldErrors.maxPayment);
  assert.ok(check.fieldErrors.spendCap);
  assert.ok(check.fieldErrors.days);
});

test("UI-08 allowance: summary states period, caps, providers and lifetime in plain words", () => {
  assert.equal(validateAllowanceDraft(FILLED).complete, true);
  const text = allowanceSummary(FILLED)?.join(" ") ?? "";
  assert.match(text, /2\.00 DemoUSD each day/);
  assert.match(text, /10\.00 DemoUSD in total/);
  assert.match(text, /0\.50 DemoUSD/);
  assert.match(text, /Provider A/);
  assert.doesNotMatch(text, /Provider B/);
  assert.match(text, /50 purchases/);
  assert.match(text, /7 days/);
  // Periods count from the start, not from midnight.
  assert.match(text, /from when the allowance starts/);

  const weekly = allowanceSummary({
    ...FILLED,
    period: "weekly",
    asset: "USDC",
    providerIds: ["a", "b"],
  })?.join(" ");
  assert.match(weekly ?? "", /each week/);
  assert.match(weekly ?? "", /Test USDC/);
  assert.match(weekly ?? "", /Provider A or Provider B/);
  assert.equal(allowanceSummary({ ...FILLED, maxPayment: "0.6" }), null);
});

test("UI-08 allowance: the draft lives with the other task forms and leaving clears it", () => {
  updateAllowanceDraft(ACCOUNT_A, { periodCap: "2" });
  toggleAllowanceProvider(ACCOUNT_A, "b");
  toggleAllowanceProvider(ACCOUNT_A, "a");
  updateAllowanceDraft(ACCOUNT_A, { days: "7" });
  const { allowance, browser } = getTaskDrafts(ACCOUNT_A);
  assert.deepEqual(allowance.providerIds, ["a", "b"]);
  assert.equal(allowance.periodCap, "2");
  assert.deepEqual(browser, EMPTY_TASK_DRAFTS.browser);
  clearTaskDraft(ACCOUNT_A, "allowance");
  assert.deepEqual(
    getTaskDrafts(ACCOUNT_A).allowance,
    EMPTY_TASK_DRAFTS.allowance,
  );
});
