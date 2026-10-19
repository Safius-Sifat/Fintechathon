import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  EMPTY_DRAFT,
  clearAllDrafts,
  clearDraft,
  contextKey,
  getDraft,
  isDraftComplete,
  subscribe,
  switchContext,
  updateDraft,
} from "../src/state/sendDraft";

const NO_ACCOUNT = { accountId: null, chainId: 84532 };
const ACCOUNT_A = { accountId: "account-a", chainId: 84532 };
const ACCOUNT_B = { accountId: "account-b", chainId: 84532 };
const ACCOUNT_A_OTHER_CHAIN = { accountId: "account-a", chainId: 1 };

afterEach(() => clearAllDrafts());

test("UI-05 draft: starts empty and keeps every field and choice", () => {
  assert.deepEqual(getDraft(ACCOUNT_A), EMPTY_DRAFT);
  updateDraft(ACCOUNT_A, { source: "agent", asset: "DemoUSD" });
  updateDraft(ACCOUNT_A, { recipient: "sample-recipient", amount: "0.01" });
  assert.deepEqual(getDraft(ACCOUNT_A), {
    source: "agent",
    asset: "DemoUSD",
    recipient: "sample-recipient",
    amount: "0.01",
  });
});

test("UI-05 draft: same object until it changes (stable snapshot)", () => {
  updateDraft(ACCOUNT_A, { amount: "1" });
  const first = getDraft(ACCOUNT_A);
  assert.equal(getDraft(ACCOUNT_A), first);
  updateDraft(ACCOUNT_A, { amount: "2" });
  assert.notEqual(getDraft(ACCOUNT_A), first);
});

test("UI-05 draft: never shown in another account or network", () => {
  updateDraft(ACCOUNT_A, { recipient: "for-a", amount: "5" });
  assert.deepEqual(getDraft(ACCOUNT_B), EMPTY_DRAFT);
  assert.deepEqual(getDraft(ACCOUNT_A_OTHER_CHAIN), EMPTY_DRAFT);
  assert.deepEqual(getDraft(NO_ACCOUNT), EMPTY_DRAFT);
  assert.notEqual(contextKey(NO_ACCOUNT), contextKey(ACCOUNT_A));
});

test("UI-05 draft: cancel clears only that context", () => {
  updateDraft(ACCOUNT_A, { recipient: "a" });
  updateDraft(ACCOUNT_B, { recipient: "b" });
  clearDraft(ACCOUNT_A);
  assert.deepEqual(getDraft(ACCOUNT_A), EMPTY_DRAFT);
  assert.equal(getDraft(ACCOUNT_B).recipient, "b");
});

test("UI-05 draft: switching account cancels the previous account's draft", () => {
  updateDraft(ACCOUNT_A, { recipient: "a", amount: "1" });
  switchContext(ACCOUNT_A, ACCOUNT_B);
  assert.deepEqual(getDraft(ACCOUNT_A), EMPTY_DRAFT);
  assert.deepEqual(getDraft(ACCOUNT_B), EMPTY_DRAFT);
});

test("UI-05 draft: switching to the same context keeps the draft", () => {
  updateDraft(ACCOUNT_A, { recipient: "a" });
  switchContext(ACCOUNT_A, { ...ACCOUNT_A });
  assert.equal(getDraft(ACCOUNT_A).recipient, "a");
});

test("UI-05 draft: lock, logout or wallet removal clears every draft", () => {
  updateDraft(ACCOUNT_A, { recipient: "a" });
  updateDraft(ACCOUNT_B, { recipient: "b" });
  updateDraft(NO_ACCOUNT, { recipient: "none" });
  clearAllDrafts();
  for (const context of [ACCOUNT_A, ACCOUNT_B, NO_ACCOUNT])
    assert.deepEqual(getDraft(context), EMPTY_DRAFT);
});

test("UI-05 draft: complete only when recipient and amount have text", () => {
  assert.equal(isDraftComplete(EMPTY_DRAFT), false);
  assert.equal(
    isDraftComplete({ ...EMPTY_DRAFT, recipient: "x", amount: "  " }),
    false,
  );
  assert.equal(
    isDraftComplete({ ...EMPTY_DRAFT, recipient: "x", amount: "1" }),
    true,
  );
});

test("UI-05 draft: listeners hear changes and stop after unsubscribe", () => {
  let calls = 0;
  const unsubscribe = subscribe(() => calls++);
  updateDraft(ACCOUNT_A, { amount: "1" });
  clearDraft(ACCOUNT_A);
  clearDraft(ACCOUNT_A); // nothing to clear: no notification
  unsubscribe();
  updateDraft(ACCOUNT_A, { amount: "2" });
  assert.equal(calls, 2);
});

test("UI-05 draft: the module holds only the four public form fields", () => {
  updateDraft(ACCOUNT_A, { recipient: "r", amount: "1" });
  assert.deepEqual(Object.keys(getDraft(ACCOUNT_A)).sort(), [
    "amount",
    "asset",
    "recipient",
    "source",
  ]);
});
