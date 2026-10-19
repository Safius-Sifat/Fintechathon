import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminCommand } from "@mandate/schema";
import { CONTROLS, findControl } from "../src/config/agentControls";

test("UI-08 controls: on-chain controls use Person1's Admin command numbers", () => {
  assert.equal(findControl("freeze").command, AdminCommand.FREEZE);
  assert.equal(findControl("unfreeze").command, AdminCommand.UNFREEZE);
  assert.equal(findControl("pause").command, AdminCommand.PAUSE);
  assert.equal(findControl("revoke").command, AdminCommand.REVOKE);
  assert.equal(findControl("logout").command, null);
});

test("UI-08 controls: freeze stops agent spending but keeps permissions", () => {
  const freeze = findControl("freeze");
  assert.equal(freeze.stopsAgentSpending, true);
  assert.equal(freeze.keepsPermissions, true);
  assert.equal(freeze.onChain, true);
  const unfreeze = findControl("unfreeze");
  assert.equal(unfreeze.stopsAgentSpending, false);
  assert.equal(unfreeze.keepsPermissions, true);
});

test("UI-08 controls: pause and revoke end existing authority", () => {
  for (const id of ["pause", "revoke"] as const) {
    const control = findControl(id);
    assert.equal(control.keepsPermissions, false, id);
    assert.equal(control.stopsAgentSpending, true, id);
    assert.equal(control.onChain, true, id);
  }
});

test("UI-08 controls: logout ends this phone's session only and never stops agents", () => {
  const logout = findControl("logout");
  assert.equal(logout.onChain, false);
  assert.equal(logout.stopsAgentSpending, false);
  assert.equal(logout.keepsPermissions, true);
});

test("UI-08 controls: each control has its own title and effect text", () => {
  const titles = new Set(CONTROLS.map((c) => c.title));
  const effects = new Set(CONTROLS.map((c) => c.effect));
  assert.equal(titles.size, CONTROLS.length);
  assert.equal(effects.size, CONTROLS.length);
});
