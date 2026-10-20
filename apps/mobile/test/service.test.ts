import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashConditions, hashRunbook, hashSchedule, hashTemplateIds, OwnerApprovalSchema } from "@mandate/schema";
import { hashCanonical, scheduleHash, templateIdsHash, validatePermitDraft, formatUnitsExact, taskProgress } from "../src/wallet/service-validation";
import { WalletViewSchema, TaskViewSchema } from "../src/wallet/service-dto/api";

function context() {
  const wallet = WalletViewSchema.parse({ walletId: "11111111-1111-4111-8111-111111111111", owner: "0x1111111111111111111111111111111111111111", address: "0x1111111111111111111111111111111111111111", chainId: 84532, provisioningState: "READY", executorAddress: "0x2222222222222222222222222222222222222222", paused: false, frozen: false, epoch: "0", policyVersion: "0", inhibited: false, assets: [], liquidUnits: "0", floorUnits: "0", reservedUnits: "0", vaultAssetsUnits: "0", spendableUnits: "0", budgets: { day: "0", walletSpentUnits: "0", executorSpentUnits: "0", walletRemainingUnits: "0", executorRemainingUnits: "0" }, asOfBlock: "0" });
  const task = TaskViewSchema.parse({ taskId: "22222222-2222-4222-8222-222222222222", chainTaskId: "0x" + "11".repeat(32), walletId: wallet.walletId, runbookId: "browser-check", outcomeState: "AWAITING_OWNER", authorityState: "PENDING", currentStep: "prepared", grossSpendUnits: "0", payments: [], delivery: { state: "NONE", result: null }, result: null, findings: [], nextPollMs: 2000 });
  return { wallet, task, epoch: 0n, nowSeconds: 0n, agentAssets: [], executor: wallet.owner };
}
const fixture = JSON.parse(readFileSync(resolve("../../packages/schema/fixtures/permit-v7.json"), "utf8"));

test("service: integer units retain precision", () => {
  assert.equal(formatUnitsExact("9007199254740993000001", 6), "9007199254740993.000001");
  assert.throws(() => formatUnitsExact("-1", 6));
  assert.throws(() => formatUnitsExact("01", 6));
});

test("service: schema fixtures retain commitment algorithms", () => {
  for (const v of fixture.valid) {
    if (v.scope) {
      assert.equal(hashCanonical(v.scope.conditions), hashConditions(v.scope.conditions));
      assert.equal(hashCanonical(v.scope.runbookManifest), hashRunbook(v.scope.runbookManifest));
    }
  }
  const s = { recipient: "0x0000000000000000000000000000000000000000", amount: "0", start: "0", interval: 0, window: 0, periods: 0 };
  assert.equal(scheduleHash(s), hashSchedule(s));
  assert.equal(templateIdsHash([]), hashTemplateIds([]));
});

test("service: malformed drafts reject before signing", () => {
  assert.throws(() => validatePermitDraft({}, context()));
  assert.equal(OwnerApprovalSchema.safeParse({}).success, false);
  assert.equal(TaskViewSchema.safeParse({}).success, false);
});
