import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminCommand,
  MAX_ADMIN_SECONDS,
  MAX_OWNER_TRANSFER_SECONDS,
  authorityTypes,
} from "@mandate/schema";
import { findControl } from "../src/config/agentControls";
import { SAMPLE_RECOVERY_STEPS } from "../src/config/controlSamples";
import {
  COMMAND_FOR,
  FEE_ROUTES,
  LOCAL_ACTIONS,
  OWNER_CONTROL_IDS,
  RECONCILE_BEFORE_REPLACEMENT,
  RECOVERY_NEEDS,
  SIGNED_COMMANDS,
  STEP_INFO,
  STEP_ORDER,
  countsAsDone,
} from "../src/config/ownerControl";

test("UI-09 control: owner operations use Person1's Admin command numbers", () => {
  assert.equal(findControl("pause").command, AdminCommand.PAUSE);
  assert.equal(findControl("unpause").command, AdminCommand.UNPAUSE);
  assert.equal(findControl("revoke").command, AdminCommand.REVOKE);
  assert.equal(findControl("recover").command, AdminCommand.RECOVER);
  assert.equal(
    findControl("recoverLiquid").command,
    AdminCommand.RECOVER_LIQUID,
  );
  // Owner transfers, including the sweep, are their own signed type.
  for (const id of ["ownerTransfer", "ownerSweep"] as const) {
    assert.equal(findControl(id).command, null, id);
    assert.equal(findControl(id).onChain, true, id);
  }
});

test("UI-09 control: every owner operation is on chain and none needs the service", () => {
  assert.deepEqual(
    [...OWNER_CONTROL_IDS],
    ["pause", "unpause", "revoke", "recover", "recoverLiquid", "ownerSweep"],
  );
  for (const id of OWNER_CONTROL_IDS) {
    const control = findControl(id);
    assert.equal(control.onChain, true, id);
    assert.ok(control.effect.trim() && control.afterwards.trim(), id);
  }
});

test("UI-09 control: recovery and owner transfers end permissions; unpause does not restore them", () => {
  for (const id of [
    "pause",
    "recover",
    "recoverLiquid",
    "ownerTransfer",
    "ownerSweep",
  ] as const) {
    assert.equal(findControl(id).keepsPermissions, false, id);
    assert.equal(findControl(id).stopsAgentSpending, true, id);
  }
  const unpause = findControl("unpause");
  assert.equal(unpause.keepsPermissions, false);
  assert.equal(unpause.stopsAgentSpending, false);
  assert.match(unpause.afterwards, /new approval/i);
});

test("UI-09 control: recovery moves funds to the owner address; a general owner transfer goes to a reviewed recipient", () => {
  for (const id of ["recover", "recoverLiquid", "ownerSweep"] as const)
    assert.match(findControl(id).effect, /your owner address/i, id);
  assert.match(findControl("recoverLiquid").effect, /no vault/i);
  const transfer = findControl("ownerTransfer").effect;
  assert.doesNotMatch(transfer, /owner address/i);
  assert.match(transfer, /recipient you review/i);
  assert.match(findControl("ownerSweep").title, /sweep/i);
});

test("UI-09 control: Admin and OwnerTransfer are separate signed types with their own fields, lifetime and nonce", () => {
  const names = (t: readonly { name: string }[]) => t.map((f) => f.name);
  const { admin, ownerTransfer } = SIGNED_COMMANDS;
  assert.deepEqual([...admin.typedFields], names(authorityTypes.Admin));
  assert.deepEqual(
    [...ownerTransfer.typedFields],
    names(authorityTypes.OwnerTransfer),
  );
  assert.equal(admin.maxLifetimeMinutes * 60, Number(MAX_ADMIN_SECONDS));
  assert.equal(
    ownerTransfer.maxLifetimeMinutes * 60,
    Number(MAX_OWNER_TRANSFER_SECONDS),
  );
  assert.equal(admin.maxLifetimeMinutes, 30);
  assert.equal(ownerTransfer.maxLifetimeMinutes, 10);
  assert.notEqual(admin.nonce, ownerTransfer.nonce);
  assert.ok(ownerTransfer.typedFields.includes("epoch"));
  assert.ok(ownerTransfer.typedFields.includes("recipient"));
});

test("UI-09 control: each owner operation names the signed type it uses", () => {
  for (const id of OWNER_CONTROL_IDS) {
    const kind = COMMAND_FOR[id];
    assert.equal(kind, id === "ownerSweep" ? "ownerTransfer" : "admin", id);
    assert.equal(
      findControl(id).command === null,
      kind === "ownerTransfer",
      id,
    );
  }
});

test("UI-09 control: only a confirmed operation counts as done", () => {
  assert.deepEqual(
    [...STEP_ORDER],
    ["prepared", "signed", "submitted", "confirmed", "reverted", "expired"],
  );
  for (const step of STEP_ORDER) {
    assert.equal(countsAsDone(step), step === "confirmed", step);
    assert.ok(STEP_INFO[step].label.trim() && STEP_INFO[step].detail.trim());
  }
  assert.notEqual(STEP_INFO.submitted.group, "done");
  assert.notEqual(STEP_INFO.signed.group, "done");
});

test("UI-09 control: every fee route names its payer and needs a network and gas", () => {
  assert.deepEqual(
    FEE_ROUTES.map((r) => r.id),
    ["sponsor", "personal", "independent"],
  );
  for (const route of FEE_ROUTES) {
    assert.ok(route.payer.trim(), route.id);
    assert.ok(route.needs.length > 0, route.id);
    assert.ok(
      route.needs.some((n) => /network|rpc/i.test(n)),
      `${route.id} needs a network`,
    );
    assert.equal(route.available, false, route.id);
  }
  assert.ok(
    FEE_ROUTES.find((r) => r.id === "sponsor")!.needs.some((n) =>
      /service/i.test(n),
    ),
  );
  assert.equal(
    FEE_ROUTES.filter((r) => !r.needs.some((n) => /service/i.test(n))).length,
    2,
    "two routes work without the service",
  );
});

test("UI-09 control: the Admin export holds only public signed fields; the OwnerTransfer export is not defined yet", () => {
  assert.deepEqual(
    [...(SIGNED_COMMANDS.admin.exportFields ?? [])],
    ["schemaVersion", "chainId", "wallet", "admin", "ownerSignature", "digest"],
  );
  assert.equal(SIGNED_COMMANDS.ownerTransfer.exportFields, null);
  assert.match(SIGNED_COMMANDS.ownerTransfer.exportNote, /not yet defined/i);
  for (const kind of [SIGNED_COMMANDS.admin, SIGNED_COMMANDS.ownerTransfer])
    for (const field of [...kind.typedFields, ...(kind.exportFields ?? [])])
      assert.doesNotMatch(field, /mnemonic|seed|private|passphrase|word/i);
});

test("UI-09 control: expiry proves nothing about an earlier copy; reconcile before a replacement", () => {
  const expired = STEP_INFO.expired.detail;
  assert.match(expired, /does not prove/i);
  assert.match(expired, /nonce/i);
  assert.match(expired, /epoch/i);
  const reconcile = RECONCILE_BEFORE_REPLACEMENT.join(" ");
  assert.match(reconcile, /included/i);
  assert.match(reconcile, /nonce/i);
  assert.match(reconcile, /epoch/i);
});

test("UI-09 control: step texts never claim every command stops agents", () => {
  for (const step of STEP_ORDER)
    assert.doesNotMatch(
      STEP_INFO[step].detail,
      /agents are (not )?stopped|stops (all|every) agent/i,
      step,
    );
  assert.match(STEP_INFO.confirmed.detail, /own effect/i);
});

test("UI-09 recovery: restore needs words, the optional passphrase and the account index", () => {
  assert.deepEqual(
    RECOVERY_NEEDS.map((n) => n.id),
    ["words", "passphrase", "index"],
  );
  assert.equal(
    RECOVERY_NEEDS.find((n) => n.id === "passphrase")!.optional,
    true,
  );
  assert.equal(RECOVERY_NEEDS.find((n) => n.id === "words")!.optional, false);
  for (const need of RECOVERY_NEEDS) assert.ok(need.detail.trim(), need.id);
});

test("UI-09 recovery: logout and removing the wallet never stop agents", () => {
  for (const action of LOCAL_ACTIONS) {
    assert.equal(action.stopsAgents, false, action.id);
    assert.equal(action.onChain, false, action.id);
  }
  assert.deepEqual(
    LOCAL_ACTIONS.map((a) => a.id),
    ["logout", "removeWallet"],
  );
});

test("UI-09 control: the development sample never shows a confirmed step", () => {
  assert.ok(SAMPLE_RECOVERY_STEPS.length > 0);
  for (const step of SAMPLE_RECOVERY_STEPS)
    assert.notEqual(step.step, "confirmed", step.title);
});
