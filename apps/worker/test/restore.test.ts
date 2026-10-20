import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gatedSigning,
  type AttemptView,
  type SigningClient,
} from "../src/execution.js";

test("P2-06.T02 a restored worker starts with new signing disabled while status reads continue", async () => {
  const calls: string[] = [];
  const signed: AttemptView = {
    actionId: "a",
    attemptId: "t",
    keyVersion: "1",
    executorAddress: "0x" + "11".repeat(20),
    signature: null,
    state: "SIGNING_UNKNOWN",
  };
  const adapter: SigningClient = {
    start: async (id) => (calls.push("start:" + id), signed),
    status: async (id) => (calls.push("status:" + id), signed),
  };
  const disabled = gatedSigning(adapter, false);
  assert.equal(await disabled.start("a"), "BUSY");
  assert.deepEqual(await disabled.status("a"), signed);
  assert.deepEqual(calls, ["status:a"]);
  assert.deepEqual(await gatedSigning(adapter, true).start("b"), signed);
  assert.deepEqual(calls, ["status:a", "start:b"]);
});
