import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCAL_TX_STATES } from "@mandate/schema";
import {
  STATE_LABELS,
  statusGroup,
  type StatusGroup,
} from "../src/config/txStatus";

// Groups the app shows. Every state Person1 publishes must land in one.
const EXPECTED: Record<(typeof LOCAL_TX_STATES)[number], StatusGroup> = {
  DRAFT: "pending",
  AWAITING_SIGNATURE: "pending",
  SIGNED: "pending",
  SUBMITTED: "pending",
  INCLUDED: "confirmed",
  FINALIZED: "confirmed",
  REVERTED: "failed",
  REPLACED: "replaced",
  CANCELLED: "replaced",
  UNKNOWN: "unknown",
  REORGED: "unknown",
};

test("UI-06 status: every shared LOCAL_TX_STATES value has a display group", () => {
  for (const state of LOCAL_TX_STATES)
    assert.equal(statusGroup(state), EXPECTED[state], state);
});

test("UI-06 status: every shared state has a non-empty plain-language label", () => {
  for (const state of LOCAL_TX_STATES)
    assert.ok((STATE_LABELS[state] ?? "").trim().length > 0, state);
});

test("UI-06 status: only included or finalized count as confirmed", () => {
  const confirmed = LOCAL_TX_STATES.filter(
    (s) => statusGroup(s) === "confirmed",
  );
  assert.deepEqual(confirmed, ["INCLUDED", "FINALIZED"]);
});

test("UI-06 status: a missing or reorged transaction is unknown, never failed", () => {
  assert.equal(statusGroup("UNKNOWN"), "unknown");
  assert.equal(statusGroup("REORGED"), "unknown");
});
