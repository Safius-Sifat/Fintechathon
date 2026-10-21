import assert from "node:assert/strict";
import test from "node:test";
import {
  agentLine,
  canStop,
  defaultTerms,
  describeRequest,
  nowDoing,
  readRequest,
  threadSteps,
} from "../src/state/agentThread";
import type { Provider } from "../src/wallet/api";
import { TaskViewSchema } from "../src/wallet/service-dto/api";

const id = "11111111-1111-4111-8111-111111111111";
const hash = `0x${"ab".repeat(32)}`;
const base = TaskViewSchema.parse({
  taskId: id,
  chainTaskId: hash,
  walletId: id,
  runbookId: "browser-check",
  outcomeState: "AWAITING_OWNER",
  authorityState: "PENDING",
  currentStep: "prepared",
  grossSpendUnits: "0",
  payments: [],
  delivery: { state: "NONE", result: null },
  result: null,
  findings: [],
  nextPollMs: 2000,
});

test("a plain request becomes a browser check, and anything else is refused", () => {
  const form = readRequest("Check the checkout form submits", 1000);
  assert.equal(form.targetId, "checkout-healthy");
  assert.deepEqual(form.checks, ["pageLoad", "title", "formSubmit"]);
  assert.equal(form.taskDeadline, "4600");
  assert.equal(
    readRequest("test the broken checkout", 1000).targetId,
    "checkout-broken",
  );
  assert.match(describeRequest(form), /checkout page: the page loads/);
  assert.throws(() => readRequest("send 5 dollars to Bob", 1000));
});

test("limits come from the providers that support every requested check", () => {
  const providers: Provider[] = [
    {
      providerId: "a",
      recipient: owner(1),
      capabilities: ["pageLoad", "title"],
      price: "200000",
      available: true,
    },
    {
      providerId: "b",
      recipient: owner(2),
      capabilities: ["pageLoad", "title", "formSubmit"],
      price: "350000",
      available: true,
    },
  ];
  const both = defaultTerms(
    providers,
    {
      checks: ["pageLoad", "title"],
      maxPaidAttempts: 3,
      maxSteps: 8,
      taskDeadline: "5000",
    },
    1000,
  )!;
  assert.equal(both.providers.length, 2);
  assert.equal(both.form.maxPayment, "0.350000");
  assert.equal(both.form.spendCap, "1.050000");
  assert.equal(both.form.liquidFloor, "3");
  assert.equal(both.form.startsAt, "1060");
  const form = defaultTerms(
    providers,
    { checks: ["formSubmit"], maxPaidAttempts: 1 },
    1000,
  )!;
  assert.deepEqual(
    form.providers.map((p) => p.providerId),
    ["b"],
  );
  assert.equal(defaultTerms(providers, { checks: [] }, 1000), null);
});

test("status lines follow the service states, and Stop shows only while the agent can spend", () => {
  assert.match(agentLine(base, 0, false), /approve/);
  assert.match(agentLine(base, 0, true), /Waiting for it to land/);
  assert.equal(threadSteps(base, true)[0]!.title, "Approval landing on chain");
  assert.equal(canStop(base), false);
  const running = {
    ...base,
    outcomeState: "RUNNING" as const,
    authorityState: "ACTIVE" as const,
  };
  assert.equal(agentLine(running), "Working on it.");
  assert.equal(canStop(running), true);
  const paid = TaskViewSchema.parse({
    ...running,
    outcomeState: "COMPLETED" as const,
    payments: [
      {
        actionId: id,
        requestId: hash,
        providerId: "a",
        amountUnits: "200000",
        txHash: hash,
        chainState: "SUBMITTED" as const,
      },
    ],
  });
  assert.match(agentLine(paid), /isn't final/);
  assert.equal(threadSteps(paid)[2]!.title, "Paying provider A 0.20 DUSD");
  assert.equal(canStop(paid), false);
  const failed = TaskViewSchema.parse({
    ...running,
    payments: [{ ...paid.payments[0]!, chainState: "REVERTED" }],
  });
  assert.equal(threadSteps(failed)[2]!.state, "failed");
  assert.match(agentLine(failed), /didn't go through/);
  assert.equal(threadSteps(failed)[1]!.state, "todo");
  assert.equal(nowDoing(failed), null);
  assert.equal(nowDoing(running), "Asking providers for a quote");
  assert.match(
    nowDoing(TaskViewSchema.parse({ ...paid, outcomeState: "RUNNING" }))!,
    /provider A to confirm/,
  );
  assert.equal(
    nowDoing(base, true),
    "Waiting for your approval to land on chain",
  );
  assert.match(
    agentLine({ ...running, authorityState: "REVOKED" as const }),
    /ended/,
  );
});

function owner(n: number) {
  return `0x${String(n).repeat(40)}` as const;
}
