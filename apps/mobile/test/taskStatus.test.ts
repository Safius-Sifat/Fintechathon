import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTION_STATES,
  AUTHORITY_STATES,
  OUTCOME_STATES,
  TaskViewSchema,
} from "@mandate/schema";
import {
  ACTION_INFO,
  AUTHORITY_INFO,
  DELIVERY_INFO,
  OUTCOME_INFO,
} from "../src/config/taskStatus";

const DELIVERY_STATES = TaskViewSchema.shape.delivery.shape.state.options;

test("UI-07 task status: every shared outcome, authority, action and delivery state has a label and group", () => {
  const tables = [
    [OUTCOME_STATES, OUTCOME_INFO],
    [AUTHORITY_STATES, AUTHORITY_INFO],
    [ACTION_STATES, ACTION_INFO],
    [DELIVERY_STATES, DELIVERY_INFO],
  ] as const;
  for (const [states, info] of tables)
    for (const state of states) {
      const entry = (info as Record<string, { label: string; group: string }>)[
        state
      ];
      assert.ok((entry?.label ?? "").trim().length > 0, `${state} label`);
      assert.ok((entry?.group ?? "").length > 0, `${state} group`);
    }
});

test("UI-07 task status: a completed outcome never reads as closed, settled or final", () => {
  assert.doesNotMatch(OUTCOME_INFO.COMPLETED.label, /closed|settled|final/i);
});

test("UI-07 task status: closing authority is distinct from closed", () => {
  assert.notEqual(AUTHORITY_INFO.CLOSING.label, AUTHORITY_INFO.CLOSED.label);
  assert.notEqual(AUTHORITY_INFO.CLOSING.group, AUTHORITY_INFO.CLOSED.group);
});

test("UI-07 task status: only FINALIZED payments are described as final", () => {
  const final = ACTION_STATES.filter(
    (s) =>
      /final/i.test(ACTION_INFO[s].label) &&
      !/not final/i.test(ACTION_INFO[s].label),
  );
  assert.deepEqual(final, ["FINALIZED"]);
  assert.match(ACTION_INFO.INCLUDED.label, /not final/i);
});

test("UI-07 task status: an unknown payment is unknown, never failed", () => {
  assert.equal(ACTION_INFO.UNKNOWN.group, "unknown");
});

test("UI-07 task status: failed or invalid delivery is a problem even when payment succeeded", () => {
  assert.equal(DELIVERY_INFO.FAILED.group, "problem");
  assert.equal(DELIVERY_INFO.INVALID.group, "problem");
});
