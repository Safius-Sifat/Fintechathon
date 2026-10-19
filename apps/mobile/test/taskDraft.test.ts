import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { CHECK_ORDER, PROVIDER_IDS } from "@mandate/schema";
import {
  CHECKS,
  EMPTY_TASK_DRAFTS,
  PROVIDERS,
  clearAllTaskDrafts,
  clearTaskDraft,
  getTaskDrafts,
  isBrowserDraftComplete,
  isScheduleDraftComplete,
  switchTaskContext,
  toggleCheck,
  toggleProvider,
  updateBrowserDraft,
  updateScheduleDraft,
} from "../src/state/taskDraft";

const ACCOUNT_A = { accountId: "account-a", chainId: 84532 };
const ACCOUNT_B = { accountId: "account-b", chainId: 84532 };

afterEach(() => clearAllTaskDrafts());

test("UI-07 task draft: check and provider lists match the shared schema order", () => {
  assert.deepEqual([...CHECKS], [...CHECK_ORDER]);
  assert.deepEqual([...PROVIDERS], [...PROVIDER_IDS]);
});

test("UI-07 task draft: starts empty with the most restrictive choices", () => {
  const { browser } = getTaskDrafts(ACCOUNT_A);
  assert.deepEqual(getTaskDrafts(ACCOUNT_A), EMPTY_TASK_DRAFTS);
  assert.deepEqual(browser.checks, []);
  assert.deepEqual(browser.providerIds, []);
  assert.equal(browser.maxPaidAttempts, 1);
  assert.equal(browser.asset, "DemoUSD");
});

test("UI-07 task draft: checks stay in canonical order whatever the tap order", () => {
  toggleCheck(ACCOUNT_A, "formSubmit");
  toggleCheck(ACCOUNT_A, "pageLoad");
  toggleCheck(ACCOUNT_A, "title");
  assert.deepEqual(getTaskDrafts(ACCOUNT_A).browser.checks, [
    "pageLoad",
    "title",
    "formSubmit",
  ]);
  toggleCheck(ACCOUNT_A, "title");
  assert.deepEqual(getTaskDrafts(ACCOUNT_A).browser.checks, [
    "pageLoad",
    "formSubmit",
  ]);
});

test("UI-07 task draft: providers stay sorted a, b", () => {
  toggleProvider(ACCOUNT_A, "b");
  toggleProvider(ACCOUNT_A, "a");
  assert.deepEqual(getTaskDrafts(ACCOUNT_A).browser.providerIds, ["a", "b"]);
  toggleProvider(ACCOUNT_A, "a");
  assert.deepEqual(getTaskDrafts(ACCOUNT_A).browser.providerIds, ["b"]);
});

test("UI-07 task draft: browser review needs a goal, a check, a provider and a spend cap", () => {
  const complete = {
    ...EMPTY_TASK_DRAFTS.browser,
    goal: "Check the staging checkout",
    checks: ["pageLoad" as const],
    providerIds: ["a" as const],
    spendCap: "1",
  };
  assert.equal(isBrowserDraftComplete(complete), true);
  assert.equal(isBrowserDraftComplete({ ...complete, goal: "  " }), false);
  assert.equal(isBrowserDraftComplete({ ...complete, checks: [] }), false);
  assert.equal(isBrowserDraftComplete({ ...complete, providerIds: [] }), false);
  assert.equal(isBrowserDraftComplete({ ...complete, spendCap: "" }), false);
});

test("UI-07 task draft: schedule review needs every fixed term", () => {
  const complete = {
    ...EMPTY_TASK_DRAFTS.schedule,
    recipient: "sample-recipient",
    amount: "5",
    start: "tomorrow 09:00",
    window: "2 hours",
    periods: "4",
  };
  assert.equal(isScheduleDraftComplete(complete), true);
  for (const field of [
    "recipient",
    "amount",
    "start",
    "window",
    "periods",
  ] as const)
    assert.equal(
      isScheduleDraftComplete({ ...complete, [field]: " " }),
      false,
      field,
    );
});

test("UI-07 task draft: clearing one form keeps the other", () => {
  updateBrowserDraft(ACCOUNT_A, { goal: "goal" });
  updateScheduleDraft(ACCOUNT_A, { amount: "5" });
  clearTaskDraft(ACCOUNT_A, "browser");
  assert.equal(getTaskDrafts(ACCOUNT_A).browser.goal, "");
  assert.equal(getTaskDrafts(ACCOUNT_A).schedule.amount, "5");
});

test("UI-07 task draft: drafts belong to one account; switching or locking clears them", () => {
  updateBrowserDraft(ACCOUNT_A, { goal: "goal" });
  assert.equal(getTaskDrafts(ACCOUNT_B).browser.goal, "");
  switchTaskContext(ACCOUNT_A, ACCOUNT_B);
  assert.equal(getTaskDrafts(ACCOUNT_A).browser.goal, "");
  updateScheduleDraft(ACCOUNT_B, { amount: "5" });
  clearAllTaskDrafts();
  assert.deepEqual(getTaskDrafts(ACCOUNT_B), EMPTY_TASK_DRAFTS);
});

test("UI-07 task draft: same object until it changes (stable snapshot)", () => {
  updateBrowserDraft(ACCOUNT_A, { goal: "one" });
  const first = getTaskDrafts(ACCOUNT_A);
  assert.equal(getTaskDrafts(ACCOUNT_A), first);
  updateBrowserDraft(ACCOUNT_A, { goal: "two" });
  assert.notEqual(getTaskDrafts(ACCOUNT_A), first);
});
