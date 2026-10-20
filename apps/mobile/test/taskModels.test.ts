import assert from "node:assert/strict";
import test from "node:test";
import {
  browserInput,
  decimalUnits,
  taskTerms,
  taskTitle,
  activityActor,
  mergeActivity,
  type BrowserForm,
  type TermsForm,
} from "../src/state/taskModels";
import {
  TermsSchema as SharedTerms,
  CreateTaskRequestSchema as SharedCreate,
  TaskViewSchema as SharedTask,
  WalletViewSchema as SharedWallet,
} from "@mandate/schema";
import {
  TermsSchema,
  CreateTaskRequestSchema,
  TaskViewSchema,
  WalletViewSchema,
} from "../src/wallet/service-dto/api";
import { BrowserInputSchema } from "../../../packages/runbooks/src/validators";
import {
  WalletActivitySchema,
  ActivityPageSchema,
} from "../src/wallet/service-dto/activity";
import type { SentTx } from "../src/wallet/local";

const owner = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const walletId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const hash = `0x${"11".repeat(32)}` as const;
const browser: BrowserForm = {
  targetId: "checkout-broken",
  checks: ["formSubmit", "pageLoad"],
  maxPaidAttempts: 2,
  maxSteps: 8,
  taskDeadline: "2000",
};
const termsForm: TermsForm = {
  recipients: `${other}, ${owner}, ${other}`,
  maxPayment: "0.500000",
  spendCap: "1.000001",
  liquidFloor: "0",
  reviewThreshold: "0.1",
  startsAt: "1100",
  expiresAt: "2000",
  maxActions: 8,
  maxPayments: 2,
};
const task = {
  taskId,
  chainTaskId: hash,
  walletId,
  runbookId: "browser-check",
  outcomeState: "COMPLETED",
  authorityState: "CLOSED",
  currentStep: "complete",
  grossSpendUnits: "500000",
  payments: [
    {
      actionId: walletId,
      requestId: hash,
      providerId: "b",
      amountUnits: "500000",
      txHash: hash,
      chainState: "SUBMITTED",
    },
  ],
  delivery: { state: "NONE", result: null },
  result: null,
  findings: [],
  nextPollMs: 2000,
};

test("browser form uses canonical checks and the exact runbook input shape", () => {
  const input = browserInput(browser, 1000);
  assert.deepEqual(input.checks, ["pageLoad", "formSubmit"]);
  assert.deepEqual(BrowserInputSchema.parse(input), input);
  assert.throws(() => browserInput({ ...browser, maxPaidAttempts: 4 }, 1000));
  assert.throws(() => browserInput({ ...browser, checks: [] }, 1000));
  assert.throws(() => browserInput({ ...browser, taskDeadline: "999" }, 1000));
  assert.throws(() =>
    browserInput({ ...browser, taskDeadline: "999999" }, 1000),
  );
  assert.throws(() => browserInput({ ...browser, maxSteps: 1 }, 1000));
});

test("six-decimal amounts remain exact and reject rounding or scientific notation", () => {
  assert.equal(
    decimalUnits("9007199254740993.000001"),
    "9007199254740993000001",
  );
  assert.equal(decimalUnits("0.000001"), "1");
  for (const bad of ["-1", "1e6", "01", "0.0000001", "NaN", ""])
    assert.throws(() => decimalUnits(bad));
  assert.throws(() => decimalUnits("0", false));
});

test("browser terms require explicit recipients and enforce contract ceilings", () => {
  const terms = taskTerms(termsForm, owner, 1000);
  assert.deepEqual(terms.recipients, [owner, other]);
  assert.equal(terms.maxPayment, "500000");
  assert.equal(terms.spendCap, "1000001");
  assert.equal(terms.reviewThreshold, "100000");
  assert.equal(terms.depositCap, "0");
  assert.deepEqual(TermsSchema.parse(terms), SharedTerms.parse(terms));
  for (const change of [
    { recipients: "" },
    { recipients: "0x0000000000000000000000000000000000000000" },
    { maxPayment: "0.500001" },
    { spendCap: "2.000001" },
    { maxPayments: 4 },
    { expiresAt: "1000" },
  ])
    assert.throws(() => taskTerms({ ...termsForm, ...change }, owner, 1000));
});

test("completed result never describes a submitted or unknown payment as settled", () => {
  assert.equal(
    taskTitle(TaskViewSchema.parse(task)),
    "Result received; payment pending",
  );
  assert.equal(
    taskTitle(
      TaskViewSchema.parse({
        ...task,
        payments: [{ ...task.payments[0], chainState: "UNKNOWN" }],
      }),
    ),
    "Result received; payment pending",
  );
  assert.equal(
    taskTitle(
      TaskViewSchema.parse({
        ...task,
        payments: [{ ...task.payments[0], chainState: "FINALIZED" }],
      }),
    ),
    "Task result received",
  );
});

test("route DTO mirrors accept the same task create and task view as shared schemas", () => {
  const create = {
    walletId,
    runbookId: "browser-check",
    goal: "Check the checkout",
    input: browserInput(browser, 1000),
  };
  assert.deepEqual(
    CreateTaskRequestSchema.parse(create),
    SharedCreate.parse(create),
  );
  assert.deepEqual(TaskViewSchema.parse(task), SharedTask.parse(task));
  const wallet = {
    walletId,
    owner,
    address: other,
    chainId: 84532,
    provisioningState: "READY",
    executorAddress: owner,
    paused: false,
    frozen: false,
    epoch: "0",
    policyVersion: "0",
    inhibited: false,
    assets: [],
    liquidUnits: "0",
    floorUnits: "0",
    reservedUnits: "0",
    vaultAssetsUnits: "0",
    spendableUnits: "0",
    budgets: {
      day: "0",
      walletSpentUnits: "0",
      executorSpentUnits: "0",
      walletRemainingUnits: "0",
      executorRemainingUnits: "0",
    },
    asOfBlock: "1",
  };
  assert.deepEqual(WalletViewSchema.parse(wallet), SharedWallet.parse(wallet));
  assert.equal(
    TaskViewSchema.safeParse({ ...task, nextPollMs: 500 }).success,
    false,
  );
  assert.equal(
    TaskViewSchema.safeParse({ ...task, extra: "untrusted" }).success,
    false,
  );
});

test("activity actor preserves managed owner controls and merges indexed operations by ID", () => {
  const a = WalletActivitySchema.parse({
    activityId: "one",
    ownerAddress: owner,
    source: "MANAGED",
    category: "AGENT",
    chainId: 84532,
    txHash: hash,
    blockHash: hash,
    blockNumber: "1",
    nonce: "0",
    asset: owner,
    from: owner,
    to: other,
    amount: "1",
    feeWei: "1",
    feePayer: owner,
    state: "INCLUDED",
    operationId: "op1",
    taskId,
    transferId: null,
    replacementOf: null,
    provenance: "INDEXER_ASSERTION",
    observedAt: "1",
  });
  assert.equal(activityActor(a), "Agent");
  assert.equal(activityActor({ source: "MANAGED", category: "ADMIN" }), "You");
  assert.equal(
    activityActor({ source: "MANAGED", category: "OWNER_CONTROL" }),
    "You",
  );
  const local: SentTx = {
    hash,
    from: owner,
    to: other,
    symbol: "DUSD",
    amount: "1",
    kind: "send",
    label: "Sent",
    createdAt: 1,
  };
  const merged = mergeActivity(
    [a, { ...a, activityId: "two", operationId: "op2" }, a],
    [local],
    owner,
  );
  assert.equal(merged.indexed.length, 2);
  assert.equal(merged.local.length, 0);
  assert.equal(mergeActivity([a], [local], other).indexed.length, 0);
  assert.equal(mergeActivity([], [local], owner).local.length, 1);
  assert.equal(
    ActivityPageSchema.safeParse({
      items: [a],
      nextCursor: null,
      coverage: {
        fromBlock: "0",
        toBlock: "1",
        indexedThrough: "1",
        backfillState: "RUNNING",
        gaps: [{ fromBlock: "0", toBlock: "0" }],
      },
    }).success,
    true,
  );
});
