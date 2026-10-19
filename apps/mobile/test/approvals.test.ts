import assert from "node:assert/strict";
import { test } from "node:test";
import { ApprovalRequestSchema, Operation } from "@mandate/schema";
import {
  APPROVAL_STATE_INFO,
  OPERATION_LABELS,
  canDecide,
  expiryLabel,
} from "../src/config/approvals";

const APPROVAL_STATES = ApprovalRequestSchema.shape.state.options;
const NOW = 1_800_000_000;

test("UI-08 approvals: every shared approval state has a label and group", () => {
  for (const state of APPROVAL_STATES) {
    const info = APPROVAL_STATE_INFO[state];
    assert.ok((info?.label ?? "").trim().length > 0, state);
    assert.ok((info?.group ?? "").length > 0, state);
  }
});

test("UI-08 approvals: only a pending request before its expiry can be decided", () => {
  const future = String(NOW + 600);
  for (const state of APPROVAL_STATES)
    assert.equal(canDecide(state, future, NOW), state === "PENDING", state);
  assert.equal(canDecide("PENDING", String(NOW), NOW), false, "at expiry");
  assert.equal(canDecide("PENDING", String(NOW - 1), NOW), false, "past");
});

test("UI-08 approvals: an approved state is never shown as the default or a pending state", () => {
  assert.notEqual(
    APPROVAL_STATE_INFO.APPROVED.label,
    APPROVAL_STATE_INFO.PENDING.label,
  );
  assert.equal(APPROVAL_STATE_INFO.PENDING.group, "attention");
});

test("UI-08 approvals: expiry label counts down and never shows a past request as open", () => {
  assert.equal(expiryLabel(String(NOW + 600), NOW), "Expires in 10 min");
  assert.equal(expiryLabel(String(NOW + 61), NOW), "Expires in 2 min");
  assert.equal(expiryLabel(String(NOW + 30), NOW), "Expires in under a minute");
  assert.equal(expiryLabel(String(NOW), NOW), "Expired");
  assert.equal(expiryLabel(String(NOW - 5), NOW), "Expired");
});

test("UI-08 approvals: every shared operation has a plain-language label", () => {
  for (const name of Object.keys(Operation) as (keyof typeof Operation)[])
    assert.ok((OPERATION_LABELS[name] ?? "").trim().length > 0, name);
});
