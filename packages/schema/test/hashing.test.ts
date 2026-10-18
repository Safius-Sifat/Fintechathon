import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZERO_HASH,
  ZERO_SCHEDULE,
  hashAddressList,
  hashConditions,
  hashRecipients,
  hashSchedule,
  hashTemplateIds,
  hashWalletPolicyLists,
} from "../src/index.js";
import { loadFixture } from "./support/load.js";

const hashes = loadFixture("hashes-v7.json");

test("P1-01.T05 recipients must be canonical; committed values change hashes; key order does not", () => {
  assert.equal(hashRecipients(hashes.recipients.input), hashes.recipients.hash);
  for (const bad of hashes.recipients.rejected)
    assert.throws(() => hashRecipients(bad));
  assert.throws(() =>
    hashRecipients([
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
      "0x5555555555555555555555555555555555555555",
    ]),
  );

  assert.equal(hashConditions(hashes.conditions.input), hashes.conditions.hash);
  assert.equal(
    hashConditions(hashes.conditions.reorderedKeys),
    hashes.conditions.hash,
  );
  const changed = structuredClone(hashes.conditions.input);
  changed.browser.maxPaidAttempts = 2;
  assert.notEqual(hashConditions(changed), hashes.conditions.hash);

  assert.equal(hashSchedule(ZERO_SCHEDULE), hashes.schedule.zeroHash);
  assert.notEqual(
    hashSchedule({ ...ZERO_SCHEDULE, periods: 1 }),
    hashes.schedule.zeroHash,
  );
});

test("P1-A01.T03 list hashes are stable and reject duplicates or unsorted input", () => {
  assert.equal(hashTemplateIds([]), ZERO_HASH);
  assert.equal(
    hashTemplateIds(hashes.templateIds.single.input),
    hashes.templateIds.single.hash,
  );
  assert.deepEqual(
    hashWalletPolicyLists(hashes.walletPolicyLists.input),
    hashes.walletPolicyLists.hashes,
  );
  const lists = hashes.walletPolicyLists.input;
  assert.throws(() =>
    hashWalletPolicyLists({
      ...lists,
      assetCaps: [...lists.assetCaps].reverse(),
    }),
  );
  assert.throws(() =>
    hashAddressList([lists.allowlist[0], lists.allowlist[0]]),
  );
  assert.throws(() =>
    hashTemplateIds([
      lists.templates[0].templateId,
      lists.templates[0].templateId,
    ]),
  );
  // Empty allowlist hashes the empty-array encoding, not the zero hash.
  assert.notEqual(hashAddressList([]), ZERO_HASH);
});

test("P1-01.T05 conditions branch invariants", () => {
  const c = hashes.conditions.input;
  assert.throws(() => hashConditions({ ...c, runbookId: "scheduled-pay" }));
  assert.throws(() =>
    hashConditions({
      ...c,
      browser: { ...c.browser, checks: ["title", "pageLoad"] },
    }),
  );
  assert.throws(() =>
    hashConditions({
      ...c,
      browser: { ...c.browser, providerIds: ["a", "a"] },
    }),
  );
  assert.throws(() =>
    hashConditions({ ...c, calls: { templateIds: [ZERO_HASH], purpose: "x" } }),
  );
});
