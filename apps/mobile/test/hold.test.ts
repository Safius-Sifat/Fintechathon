import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLD_STEPS,
  holdRelease,
  holdTick,
  idleHold,
  type Hold,
} from "../src/state/hold";

function ticks(n: number): Hold {
  let hold = idleHold;
  for (let i = 0; i < n; i += 1) hold = holdTick(hold);
  return hold;
}

test("hold: releasing before it is full signs nothing and starts over", () => {
  const partway = ticks(HOLD_STEPS - 1);
  assert.equal(partway.sealed, false);
  assert.deepEqual(holdRelease(partway), idleHold);
});

test("hold: a full hold seals, and stays sealed after release", () => {
  const full = ticks(HOLD_STEPS);
  assert.equal(full.sealed, true);
  assert.equal(full.filled, HOLD_STEPS);
  assert.equal(holdRelease(full).sealed, true);
});

test("hold: extra ticks never overfill", () => {
  assert.equal(ticks(HOLD_STEPS + 20).filled, HOLD_STEPS);
});
