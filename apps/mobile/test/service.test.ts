import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  hashTypedData,
  recoverTypedDataAddress,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import {
  authorityTypes,
  ConditionsSchema,
  ScopeSchema,
  TermsSchema,
  hashConditions,
  hashRunbook,
  hashSchedule,
  hashTemplateIds,
  hashRecipients,
  hashDigest,
  hashPermit,
  hashAction,
  OwnerApprovalSchema as SharedDraft,
  WalletViewSchema as SharedWallet,
  TaskViewSchema as SharedTask,
  ApprovalRequestSchema as SharedApproval,
  ActivityPageSchema as SharedActivity,
  IntentDraftSchema as SharedIntent,
  PermitSchema as SharedPermit,
  ActionSchema,
  InvoiceSchema,
  walletDomain,
  typedDataJson,
  ZERO_SCHEDULE,
  mandateWalletAbi,
} from "@mandate/schema";
import { PERMIT_TYPES } from "../src/wallet/typed";
import {
  ACTION_TYPES,
  hashCanonical,
  canonicalJson,
  recipientsHash,
  scheduleHash,
  templateIdsHash,
  validatePermitDraft,
  validatePaymentApproval,
  permitSigningMessage,
  formatUnitsExact,
  taskProgress,
  type PermitContext,
  type ApprovalPermitContext,
} from "../src/wallet/service-validation";
import {
  OwnerApprovalSchema,
  WalletViewSchema,
  TaskViewSchema,
  ApprovalRequestSchema,
  IntentDraftSchema,
  type OwnerApproval,
  type ApprovalRequest,
} from "../src/wallet/service-dto/api";
import { PermitSchema } from "../src/wallet/service-dto/authority";
import { ActivityPageSchema } from "../src/wallet/service-dto/activity";
import {
  Hex32Schema,
  AddressSchema,
  SignatureSchema,
} from "../src/wallet/service-dto/primitives";
import {
  OwnerSessionGate,
  newOperationId,
  operationKey,
} from "../src/wallet/service-session";
import { readProofBytes, MAX_PROOF_BYTES } from "../src/wallet/service-proof";
import { permitStateAbi } from "../src/wallet/chain-abi";
const load = (name: string): unknown =>
  JSON.parse(
    readFileSync(resolve("../../packages/schema/fixtures", name), "utf8"),
  );
const vectors = z
  .object({
    valid: z.array(
      z.object({
        message: SharedPermit,
        domain: z.object({ verifyingContract: AddressSchema }),
        digest: Hex32Schema,
        signature: SignatureSchema,
        signer: AddressSchema,
      }),
    ),
    invalid: z.array(z.object({ message: z.unknown() }).passthrough()),
  })
  .parse(load("permit-v7.json"));
const hashes = z
  .object({
    conditions: z.object({
      input: ConditionsSchema,
      reorderedKeys: ConditionsSchema,
      hash: Hex32Schema,
    }),
    runbookManifest: z.object({
      input: ScopeSchema.shape.runbookManifest,
      hash: Hex32Schema,
    }),
    recipients: z.object({
      input: z.array(AddressSchema),
      hash: Hex32Schema,
      rejected: z.array(z.array(AddressSchema)),
    }),
    schedule: z.object({ zero: z.unknown(), zeroHash: Hex32Schema }),
    templateIds: z.object({
      empty: Hex32Schema,
      single: z.object({ input: z.array(Hex32Schema), hash: Hex32Schema }),
    }),
  })
  .parse(load("hashes-v7.json"));
const ID = "11111111-1111-4111-8111-111111111111",
  TASK_ID = "22222222-2222-4222-8222-222222222222",
  OTHER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ADDRESS: Address = "0x4444444444444444444444444444444444444444";
const OTHER_HASH = Hex32Schema.parse("0x" + "aa".repeat(32));
const NOW = 1793000010n;
function example() {
  const vector = vectors.valid[0]!;
  const scope = ScopeSchema.parse({
    conditions: {
      ...hashes.conditions.input,
      browser: {
        ...hashes.conditions.input.browser,
        taskDeadline: vector.message.expiresAt,
      },
    },
    runbookManifest: hashes.runbookManifest.input,
    providerBindings: hashes.recipients.input.map((recipient, i) => ({
      providerId: i === 0 ? "a" : "b",
      recipient,
    })),
  });
  const message = SharedPermit.parse({
    ...vector.message,
    conditionsHash: hashConditions(scope.conditions),
  });
  const domain = walletDomain(vector.domain.verifyingContract);
  const draft = OwnerApprovalSchema.parse({
    draftId: OTHER_ID,
    typedData: typedDataJson("Permit", message, domain),
    scope,
    recipients: hashes.recipients.input,
    schedule: ZERO_SCHEDULE,
    templateIds: [],
    digest: hashDigest("Permit", message, domain),
    policyVersion: "1",
    intentId: null,
  });
  const wallet = WalletViewSchema.parse({
    walletId: ID,
    owner: vector.signer,
    address: domain.verifyingContract,
    chainId: 84532,
    provisioningState: "READY",
    executorAddress: message.executor,
    paused: false,
    frozen: false,
    epoch: "0",
    policyVersion: "1",
    inhibited: false,
    assets: [
      {
        asset: message.asset,
        symbol: "DUSD",
        liquidUnits: "1000000",
        reservedUnits: "0",
      },
      {
        asset: OTHER_ADDRESS,
        symbol: "USDC",
        liquidUnits: "1000000",
        reservedUnits: "0",
      },
    ],
    liquidUnits: "1000000",
    floorUnits: "0",
    reservedUnits: "0",
    vaultAssetsUnits: "0",
    spendableUnits: "1000000",
    budgets: {
      day: "0",
      walletSpentUnits: "0",
      executorSpentUnits: "0",
      walletRemainingUnits: "0",
      executorRemainingUnits: "0",
    },
    asOfBlock: "0",
  });
  const task = TaskViewSchema.parse({
    taskId: TASK_ID,
    chainTaskId: message.taskId,
    walletId: ID,
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
  const terms = TermsSchema.parse({
    asset: message.asset,
    startsAt: message.startsAt,
    expiresAt: message.expiresAt,
    maxActions: message.maxActions,
    maxPayments: message.maxPayments,
    maxPayment: message.maxPayment,
    spendCap: message.spendCap,
    liquidFloor: message.liquidFloor,
    depositCap: message.depositCap,
    withdrawCap: message.withdrawCap,
    reviewThreshold: message.reviewThreshold,
    periodCap: message.periodCap,
    periodSeconds: message.periodSeconds,
    recipients: draft.recipients,
    schedule: draft.schedule,
    templateIds: [],
  });
  const context: PermitContext = {
    wallet,
    task,
    epoch: 0n,
    nowSeconds: NOW,
    agentAssets: [message.asset],
    executor: message.executor,
    terms,
  };
  return { draft, wallet, task, context };
}
function payment() {
  const base = example(),
    { wallet, task, draft } = base;
  const domain = walletDomain(wallet.address!);
  const invoice = InvoiceSchema.parse({
    invoiceId: OTHER_HASH,
    taskId: task.chainTaskId,
    wallet: wallet.address,
    asset: draft.typedData.message.asset,
    recipient: draft.recipients[0],
    amount: "400000",
    inputHash: OTHER_HASH,
    issuedAt: "1793000000",
    expiresAt: "1793000600",
  });
  const action = ActionSchema.parse({
    permitId: hashPermit(draft.typedData.message),
    requestId: OTHER_HASH,
    operation: 0,
    target: invoice.recipient,
    amount: invoice.amount,
    minOutput: "0",
    invoiceId: invoice.invoiceId,
    inputHash: invoice.inputHash,
    period: 0,
    issuedAt: invoice.issuedAt,
    deadline: invoice.expiresAt,
  });
  const message = {
    actionDigest: hashAction(action, domain),
    expiresAt: "1793000300",
  };
  const approval = ApprovalRequestSchema.parse({
    approvalId: OTHER_ID,
    walletId: ID,
    taskId: TASK_ID,
    action,
    invoice,
    typedData: typedDataJson("Approval", message, domain),
    digest: hashDigest("Approval", message, domain),
    rationale: null,
    rationaleUntrusted: true,
    expiresAt: message.expiresAt,
    state: "PENDING",
  });
  const permit: ApprovalPermitContext = {
    permitId: action.permitId,
    taskId: task.chainTaskId,
    asset: invoice.asset,
    epoch: 0n,
    currentEpoch: 0n,
    activated: true,
    closed: false,
    revoked: false,
    startsAt: 1793000000n,
    expiresAt: 1793003600n,
  };
  return { ...base, approval, permit };
}
function resign(a: ApprovalRequest) {
  a.typedData.message.actionDigest = hashAction(a.action, a.typedData.domain);
  a.digest = hashDigest("Approval", a.typedData.message, a.typedData.domain);
}
test("service: valid shared-built Permit and terms pass", () => {
  const { draft, context } = example();
  assert.deepEqual(validatePermitDraft(draft, context), draft);
  assert.deepEqual(SharedDraft.parse(draft), draft);
});
test("service: real golden Permit digests and signatures agree", async () => {
  assert.ok(vectors.valid.length > 0);
  for (const v of vectors.valid) {
    const typed = {
      domain: walletDomain(v.domain.verifyingContract),
      types: PERMIT_TYPES,
      primaryType: "Permit" as const,
      message: permitSigningMessage(PermitSchema.parse(v.message)),
    };
    assert.equal(hashTypedData(typed), v.digest);
    assert.equal(
      await recoverTypedDataAddress({ ...typed, signature: v.signature }),
      v.signer,
    );
  }
});
test("service: commitment hashes match actual shared fixtures", () => {
  assert.equal(hashCanonical(hashes.conditions.input), hashes.conditions.hash);
  assert.equal(
    hashCanonical(hashes.conditions.reorderedKeys),
    hashConditions(hashes.conditions.input),
  );
  assert.equal(
    hashCanonical(hashes.runbookManifest.input),
    hashes.runbookManifest.hash,
  );
  assert.equal(
    hashCanonical(hashes.runbookManifest.input),
    hashRunbook(hashes.runbookManifest.input),
  );
  assert.equal(recipientsHash(hashes.recipients.input), hashes.recipients.hash);
  assert.equal(
    recipientsHash(hashes.recipients.input),
    hashRecipients(hashes.recipients.input),
  );
  for (const invalid of hashes.recipients.rejected)
    assert.throws(() => recipientsHash(invalid));
  assert.equal(scheduleHash(hashes.schedule.zero), hashes.schedule.zeroHash);
  assert.equal(
    scheduleHash(hashes.schedule.zero),
    hashSchedule(hashes.schedule.zero),
  );
  assert.equal(templateIdsHash([]), hashes.templateIds.empty);
  assert.equal(
    templateIdsHash(hashes.templateIds.single.input),
    hashes.templateIds.single.hash,
  );
  assert.equal(
    templateIdsHash(hashes.templateIds.single.input),
    hashTemplateIds(hashes.templateIds.single.input),
  );
  assert.throws(() => templateIdsHash([OTHER_HASH, OTHER_HASH]));
  assert.throws(() => canonicalJson({ bad: undefined }));
  assert.throws(() => canonicalJson(0.5));
});
const draftMutations: [string, (d: OwnerApproval) => void][] = [
  [
    "wrong chain",
    (d) => {
      Object.assign(d.typedData.domain, { chainId: 1 });
    },
  ],
  [
    "wrong version",
    (d) => {
      Object.assign(d.typedData.domain, { version: "4" });
    },
  ],
  [
    "wrong name",
    (d) => {
      Object.assign(d.typedData.domain, { name: "Other" });
    },
  ],
  [
    "wrong contract",
    (d) => {
      d.typedData.domain.verifyingContract = OTHER_ADDRESS;
    },
  ],
  [
    "extra domain field",
    (d) => {
      Object.assign(d.typedData.domain, { salt: OTHER_HASH });
    },
  ],
  [
    "wrong primary type",
    (d) => {
      Object.assign(d.typedData, { primaryType: "Action" });
    },
  ],
  [
    "wrong field type",
    (d) => {
      d.typedData.types.Permit![0]!.type = "uint256";
    },
  ],
  [
    "wrong field order",
    (d) => {
      d.typedData.types.Permit!.reverse();
    },
  ],
  [
    "wrong domain field order",
    (d) => {
      d.typedData.types.EIP712Domain!.reverse();
    },
  ],
  [
    "extra type",
    (d) => {
      d.typedData.types.Action = [];
    },
  ],
  [
    "extra message field",
    (d) => {
      Object.assign(d.typedData.message, { hidden: "1" });
    },
  ],
  [
    "wrong task",
    (d) => {
      d.typedData.message.taskId = OTHER_HASH;
    },
  ],
  [
    "wrong executor",
    (d) => {
      d.typedData.message.executor = OTHER_ADDRESS;
    },
  ],
  [
    "zero executor",
    (d) => {
      d.typedData.message.executor = zeroAddress;
    },
  ],
  [
    "wrong asset",
    (d) => {
      d.typedData.message.asset = OTHER_ADDRESS;
    },
  ],
  [
    "wrong epoch",
    (d) => {
      d.typedData.message.epoch = "1";
    },
  ],
  [
    "future issue",
    (d) => {
      d.typedData.message.issuedAt = "1793000020";
    },
  ],
  [
    "expired",
    (d) => {
      d.typedData.message.expiresAt = "1793000001";
    },
  ],
  [
    "long lifetime",
    (d) => {
      d.typedData.message.expiresAt = "1794000000";
    },
  ],
  [
    "zero actions",
    (d) => {
      d.typedData.message.maxActions = 0;
    },
  ],
  [
    "zero payments",
    (d) => {
      d.typedData.message.maxPayments = 0;
    },
  ],
  [
    "zero payment",
    (d) => {
      d.typedData.message.maxPayment = "0";
    },
  ],
  [
    "zero cap",
    (d) => {
      d.typedData.message.spendCap = "0";
    },
  ],
  [
    "excess payment",
    (d) => {
      d.typedData.message.maxPayment = "500001";
    },
  ],
  [
    "excess spend",
    (d) => {
      d.typedData.message.spendCap = "2000001";
    },
  ],
  [
    "uint overflow",
    (d) => {
      d.typedData.message.nonce = (1n << 256n).toString();
    },
  ],
  [
    "uint64 overflow",
    (d) => {
      d.typedData.message.epoch = (1n << 64n).toString();
    },
  ],
  [
    "count overflow",
    (d) => {
      d.typedData.message.maxActions = 2 ** 32;
    },
  ],
  [
    "negative",
    (d) => {
      d.typedData.message.spendCap = "-1";
    },
  ],
  [
    "fraction",
    (d) => {
      d.typedData.message.spendCap = "0.1";
    },
  ],
  [
    "leading zero",
    (d) => {
      d.typedData.message.spendCap = "01";
    },
  ],
  [
    "changed conditions",
    (d) => {
      d.scope.conditions.browser!.targetId = "checkout-broken";
    },
  ],
  [
    "changed runbook",
    (d) => {
      d.scope.runbookManifest.version = "2.0.0";
    },
  ],
  [
    "wrong runbook kind",
    (d) => {
      d.scope.runbookManifest.kind = 1;
    },
  ],
  [
    "changed recipients",
    (d) => {
      d.recipients[0] = OTHER_ADDRESS;
    },
  ],
  [
    "reordered recipients",
    (d) => {
      d.recipients.reverse();
    },
  ],
  [
    "duplicate recipients",
    (d) => {
      d.recipients[1] = d.recipients[0]!;
    },
  ],
  [
    "wrong provider metadata",
    (d) => {
      d.scope.providerBindings[0]!.recipient = OTHER_ADDRESS;
    },
  ],
  [
    "changed schedule",
    (d) => {
      d.schedule.amount = "1";
    },
  ],
  [
    "changed templates",
    (d) => {
      d.templateIds = [OTHER_HASH];
    },
  ],
  [
    "wrong conditions hash",
    (d) => {
      d.typedData.message.conditionsHash = OTHER_HASH;
    },
  ],
  [
    "wrong recipients hash",
    (d) => {
      d.typedData.message.recipientsHash = OTHER_HASH;
    },
  ],
  [
    "wrong digest",
    (d) => {
      d.digest = OTHER_HASH;
    },
  ],
  [
    "wrong policy version",
    (d) => {
      d.policyVersion = "2";
    },
  ],
];
const DELIVERY = Hex32Schema.parse("0x" + "cd".repeat(32));
// A shop order: one payment of at most the price, to the bound shop only.
function orderExample() {
  const base = example();
  const vector = vectors.valid[0]!;
  const shop = hashes.recipients.input[0]!;
  const scope = ScopeSchema.parse({
    conditions: {
      schemaVersion: 4,
      runbookId: "commerce-buy",
      browser: null,
      liquidity: null,
      schedule: null,
      allowance: null,
      calls: null,
      commerce: {
        providerId: "shop",
        productId: "aero-runner",
        size: "42",
        maxAmount: "450000",
        deliveryHash: DELIVERY,
        taskDeadline: vector.message.expiresAt,
      },
    },
    runbookManifest: {
      ...hashes.runbookManifest.input,
      runbookId: "commerce-buy",
    },
    providerBindings: [{ providerId: "shop", recipient: shop }],
  });
  const message = SharedPermit.parse({
    ...vector.message,
    maxPayments: 1,
    maxPayment: "450000",
    spendCap: "450000",
    reviewThreshold: "450000",
    recipientsHash: hashRecipients([shop]),
    conditionsHash: hashConditions(scope.conditions),
    runbookHash: hashRunbook(scope.runbookManifest),
  });
  const domain = walletDomain(vector.domain.verifyingContract);
  const draft = OwnerApprovalSchema.parse({
    ...base.draft,
    typedData: typedDataJson("Permit", message, domain),
    scope,
    recipients: [shop],
    digest: hashDigest("Permit", message, domain),
  });
  const context: PermitContext = {
    ...base.context,
    task: { ...base.task, runbookId: "commerce-buy" },
    terms: {
      ...base.context.terms!,
      maxPayments: 1,
      maxPayment: "450000",
      spendCap: "450000",
      reviewThreshold: "450000",
      recipients: [shop],
    },
    order: {
      productId: "aero-runner",
      size: "42",
      amount: "450000",
      deliveryHash: DELIVERY,
    },
  };
  return { draft, context };
}

test("service: an order Permit for the order shown passes", () => {
  const { draft, context } = orderExample();
  assert.deepEqual(validatePermitDraft(draft, context), draft);
});
for (const [name, change] of [
  ["another product", { productId: "trail-pro" }],
  ["another size", { size: "43" }],
  ["another price", { amount: "400000" }],
  ["another address", { deliveryHash: OTHER_HASH }],
] as const)
  test(`service: an order Permit rejects ${name} than shown`, () => {
    const { draft, context } = orderExample();
    context.order = { ...context.order!, ...change };
    assert.throws(
      () => validatePermitDraft(draft, context),
      /differs from the one shown/,
    );
  });
test("service: an order Permit needs the order it was shown for", () => {
  const { draft, context } = orderExample();
  delete context.order;
  assert.throws(() => validatePermitDraft(draft, context));
});

for (const [name, mutate] of draftMutations)
  test(`service: Permit rejects ${name}`, () => {
    const { draft, context } = example();
    mutate(draft);
    assert.throws(() => validatePermitDraft(draft, context));
  });
for (const [name, mutate] of [
  [
    "wallet",
    (c: PermitContext) => {
      c.task.walletId = OTHER_ID;
    },
  ],
  [
    "provisioning",
    (c: PermitContext) => {
      c.wallet.provisioningState = "DEPLOYING";
    },
  ],
  [
    "task state",
    (c: PermitContext) => {
      c.task.outcomeState = "COMPLETED";
    },
  ],
  [
    "requested terms",
    (c: PermitContext) => {
      c.terms!.maxPayment = "1";
    },
  ],
  [
    "chain epoch",
    (c: PermitContext) => {
      c.epoch = 1n;
    },
  ],
  [
    "executor binding",
    (c: PermitContext) => {
      c.executor = OTHER_ADDRESS;
    },
  ],
] as const)
  test(`service: Permit rejects context ${name}`, () => {
    const { draft, context } = example();
    mutate(context);
    assert.throws(() => validatePermitDraft(draft, context));
  });

test("service: valid Action-bound Approval passes with exact shared Action fields", () => {
  const { approval, wallet, task, permit } = payment();
  assert.deepEqual(ACTION_TYPES.Action, authorityTypes.Action);
  assert.deepEqual(
    validatePaymentApproval(approval, wallet, task, NOW, permit),
    approval,
  );
  assert.deepEqual(SharedApproval.parse(approval), approval);
});
const approvalMutations: [string, (a: ApprovalRequest) => void][] = [
  [
    "wrong contract",
    (a) => {
      a.typedData.domain.verifyingContract = OTHER_ADDRESS;
    },
  ],
  [
    "wrong chain",
    (a) => {
      Object.assign(a.typedData.domain, { chainId: 1 });
    },
  ],
  [
    "wrong fields",
    (a) => {
      a.typedData.types.Approval!.reverse();
    },
  ],
  [
    "wrong primary type",
    (a) => {
      Object.assign(a.typedData, { primaryType: "Permit" });
    },
  ],
  [
    "wrong digest",
    (a) => {
      a.digest = OTHER_HASH;
    },
  ],
  [
    "wrong Action digest",
    (a) => {
      a.typedData.message.actionDigest = zeroHash;
    },
  ],
  [
    "changed target",
    (a) => {
      a.action.target = OTHER_ADDRESS;
    },
  ],
  [
    "changed amount",
    (a) => {
      a.action.amount = "1";
    },
  ],
  [
    "changed Action input",
    (a) => {
      a.action.inputHash = zeroHash;
    },
  ],
  [
    "invoice recipient",
    (a) => {
      a.invoice!.recipient = OTHER_ADDRESS;
    },
  ],
  [
    "invoice amount",
    (a) => {
      a.invoice!.amount = "1";
    },
  ],
  [
    "invoice input",
    (a) => {
      a.invoice!.inputHash = zeroHash;
    },
  ],
  [
    "invoice ID",
    (a) => {
      a.invoice!.invoiceId = zeroHash;
    },
  ],
  [
    "invoice task",
    (a) => {
      a.invoice!.taskId = zeroHash;
    },
  ],
  [
    "invoice wallet",
    (a) => {
      a.invoice!.wallet = OTHER_ADDRESS;
    },
  ],
  [
    "another registered asset",
    (a) => {
      a.invoice!.asset = OTHER_ADDRESS;
    },
  ],
  [
    "missing invoice",
    (a) => {
      a.invoice = null;
    },
  ],
  [
    "wrong task",
    (a) => {
      a.taskId = OTHER_ID;
    },
  ],
  [
    "wrong wallet",
    (a) => {
      a.walletId = OTHER_ID;
    },
  ],
  [
    "expired",
    (a) => {
      a.expiresAt = a.typedData.message.expiresAt = "1793000001";
      resign(a);
    },
  ],
  [
    "expiry mismatch",
    (a) => {
      a.expiresAt = "1793000200";
    },
  ],
  [
    "long approval",
    (a) => {
      a.expiresAt = a.typedData.message.expiresAt = "1793001000";
      resign(a);
    },
  ],
  [
    "already approved",
    (a) => {
      a.state = "APPROVED";
    },
  ],
  [
    "unsupported operation",
    (a) => {
      a.action.operation = 1;
      resign(a);
    },
  ],
  [
    "zero amount",
    (a) => {
      a.action.amount = a.invoice!.amount = "0";
      resign(a);
    },
  ],
  [
    "overflow amount",
    (a) => {
      a.action.amount = (1n << 256n).toString();
    },
  ],
  [
    "future Action",
    (a) => {
      a.action.issuedAt = "1793000020";
      resign(a);
    },
  ],
  [
    "future invoice",
    (a) => {
      a.invoice!.issuedAt = "1793000020";
    },
  ],
  [
    "invoice too short",
    (a) => {
      a.invoice!.expiresAt = "1793000020";
    },
  ],
  [
    "Action too short",
    (a) => {
      a.action.deadline = "1793000020";
      resign(a);
    },
  ],
];
for (const [name, mutate] of approvalMutations)
  test(`service: Approval rejects ${name}`, () => {
    const { approval, wallet, task, permit } = payment();
    mutate(approval);
    assert.throws(() =>
      validatePaymentApproval(approval, wallet, task, NOW, permit),
    );
  });
for (const [name, mutate] of [
  [
    "different permit",
    (p: ApprovalPermitContext) => {
      p.permitId = OTHER_HASH;
    },
  ],
  [
    "different task",
    (p: ApprovalPermitContext) => {
      p.taskId = OTHER_HASH;
    },
  ],
  [
    "different asset",
    (p: ApprovalPermitContext) => {
      p.asset = OTHER_ADDRESS;
    },
  ],
  [
    "unactivated",
    (p: ApprovalPermitContext) => {
      p.activated = false;
    },
  ],
  [
    "closed",
    (p: ApprovalPermitContext) => {
      p.closed = true;
    },
  ],
  [
    "revoked",
    (p: ApprovalPermitContext) => {
      p.revoked = true;
    },
  ],
  [
    "new epoch",
    (p: ApprovalPermitContext) => {
      p.currentEpoch = 1n;
    },
  ],
  [
    "not started",
    (p: ApprovalPermitContext) => {
      p.startsAt = NOW + 1n;
    },
  ],
  [
    "expired",
    (p: ApprovalPermitContext) => {
      p.expiresAt = NOW;
    },
  ],
] as const)
  test(`service: Approval rejects on-chain permission ${name}`, () => {
    const { approval, wallet, task, permit } = payment();
    mutate(permit);
    assert.throws(() =>
      validatePaymentApproval(approval, wallet, task, NOW, permit),
    );
  });

test("service: Permit read ABI matches generated contract ABI", () => {
  function structural(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(structural);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .filter(([k]) => k !== "internalType")
          .map(([k, x]) => [k, structural(x)]),
      );
    return v;
  }
  assert.deepEqual(
    structural(permitStateAbi[0]),
    structural(
      mandateWalletAbi.find(
        (e) => e.type === "function" && e.name === "getPermit",
      ),
    ),
  );
});
test("service: DTOs agree with shared success and rejected wire views", () => {
  const { draft, wallet, task, context } = example(),
    { approval } = payment();
  const activity = {
    items: [
      {
        activityId: "managed:tx",
        ownerAddress: wallet.owner,
        source: "MANAGED",
        category: "AGENT",
        chainId: 84532,
        txHash: OTHER_HASH,
        blockHash: null,
        blockNumber: null,
        nonce: null,
        asset: draft.typedData.message.asset,
        from: wallet.address,
        to: draft.recipients[0],
        amount: "1",
        feeWei: null,
        feePayer: null,
        state: "SUBMITTED",
        operationId: null,
        taskId: task.taskId,
        transferId: null,
        replacementOf: null,
        provenance: "INDEXER_ASSERTION",
        observedAt: "1793000000",
      },
    ],
    nextCursor: "cursor",
    coverage: {
      fromBlock: "0",
      toBlock: "100",
      indexedThrough: null,
      backfillState: "RUNNING",
      gaps: [],
    },
  };
  const intent = {
    intentId: OTHER_ID,
    draft: { runbookId: "browser-check", input: {}, terms: context.terms },
    explanation: "Draft",
    warnings: [],
  };
  const pairs: [z.ZodTypeAny, z.ZodTypeAny, unknown][] = [
    [OwnerApprovalSchema, SharedDraft, draft],
    [WalletViewSchema, SharedWallet, wallet],
    [TaskViewSchema, SharedTask, task],
    [ApprovalRequestSchema, SharedApproval, approval],
    [ActivityPageSchema, SharedActivity, activity],
    [IntentDraftSchema, SharedIntent, intent],
  ];
  for (const [mobile, shared, valid] of pairs) {
    assert.deepEqual(mobile.parse(valid), shared.parse(valid));
    for (const invalid of [
      {},
      null,
      { ...z.record(z.unknown()).parse(valid), extra: "untrusted" },
    ]) {
      assert.equal(mobile.safeParse(invalid).success, false);
      assert.equal(shared.safeParse(invalid).success, false);
    }
  }
  for (const schema of [ActivityPageSchema, SharedActivity]) {
    assert.equal(
      schema.safeParse({
        ...activity,
        items: [{ ...activity.items[0], taskId: null }],
      }).success,
      false,
    );
    assert.equal(
      schema.safeParse({
        ...activity,
        items: [
          {
            ...activity.items[0],
            category: "OWNER_CONTROL",
            transferId: OTHER_HASH,
          },
        ],
      }).success,
      false,
    );
  }
});
test("service: all golden Permit structural results match shared schema", () => {
  for (const v of vectors.valid)
    assert.deepEqual(
      PermitSchema.parse(v.message),
      SharedPermit.parse(v.message),
    );
  assert.ok(vectors.invalid.length);
  for (const v of vectors.invalid)
    assert.equal(
      PermitSchema.safeParse(v.message).success,
      SharedPermit.safeParse(v.message).success,
    );
});
test("service: exact units and integer bounds", () => {
  assert.equal(
    formatUnitsExact("9007199254740993000001", 6),
    "9007199254740993.000001",
  );
  assert.equal(formatUnitsExact("1", 6), "0.000001");
  assert.equal(formatUnitsExact("0", 6), "0.000000");
  const max = ((1n << 256n) - 1n).toString();
  assert.equal(formatUnitsExact(max, 0), max);
  for (const invalid of ["-1", "01", "1.2", "1e6", (1n << 256n).toString(), ""])
    assert.throws(() => formatUnitsExact(invalid));
  for (const invalid of [-1, 0.5, 37])
    assert.throws(() => formatUnitsExact("1", invalid));
});
for (const state of [
  "PROPOSED",
  "RESERVED",
  "AWAITING_APPROVAL",
  "SIGNING",
  "SIGNED",
  "SUBMITTED",
  "UNKNOWN",
  "INCLUDED",
  "FINALIZED",
  "DENIED",
  "REJECTED",
  "REVERTED",
] as const)
  test(`service: result and permission stay separate from payment ${state}`, () => {
    const task = example().task;
    task.outcomeState = "COMPLETED";
    task.authorityState = "ACTIVE";
    task.payments = [
      {
        actionId: OTHER_ID,
        requestId: OTHER_HASH,
        providerId: "a",
        amountUnits: "1",
        txHash: ["INCLUDED", "FINALIZED"].includes(state) ? OTHER_HASH : null,
        chainState: state,
      },
    ];
    const progress = taskProgress(task);
    assert.equal(progress.result, "COMPLETED");
    assert.equal(progress.permission, "ACTIVE");
    assert.equal(progress.done, state === "FINALIZED");
    if (state === "INCLUDED") assert.equal(progress.payment, "PROVISIONAL");
  });
test("service: owner and unlock generations isolate in-flight work", async () => {
  const gate = new OwnerSessionGate();
  assert.throws(() => gate.ticket());
  gate.update(OTHER_ADDRESS);
  const first = gate.ticket();
  gate.update(OTHER_ADDRESS.toUpperCase());
  gate.assert(first);
  let resume: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  }).then(() => gate.assert(first));
  gate.update(zeroAddress);
  const second = gate.ticket();
  resume!();
  await assert.rejects(pending, /account changed/);
  gate.assert(second);
  gate.update(null);
  assert.throws(() => gate.assert(second));
  gate.update(zeroAddress);
  assert.throws(() => gate.assert(second));
  const third = gate.ticket();
  gate.invalidate();
  assert.throws(() => gate.assert(third));
});
test("service: retry UUIDs are stable, distinct and contain no credentials", () => {
  const body = { ownerSignature: "test-sensitive-signature", draftId: ID };
  const first = operationKey({}, "/v1/permits/activate", body);
  assert.match(
    first.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const stored = { [first.fingerprint]: first.id };
  assert.deepEqual(
    operationKey(stored, "/v1/permits/activate", {
      draftId: ID,
      ownerSignature: body.ownerSignature,
    }),
    first,
  );
  assert.equal(JSON.stringify(stored).includes(body.ownerSignature), false);
  assert.notEqual(
    operationKey(stored, "/v1/permits/activate", { ...body, draftId: OTHER_ID })
      .id,
    first.id,
  );
  assert.notEqual(operationKey({}, "/v1/permits/activate", body).id, first.id);
  assert.notEqual(newOperationId(), newOperationId());
});
test("service: proof binary checks owner, media, ZIP header and size", async () => {
  const zip = new Uint8Array([80, 75, 3, 4, 1, 2]);
  assert.deepEqual(
    await readProofBytes(
      new Response(zip, { headers: { "content-type": "application/zip" } }),
      () => undefined,
    ),
    zip,
  );
  await assert.rejects(
    readProofBytes(
      new Response(zip, { headers: { "content-type": "application/json" } }),
      () => undefined,
    ),
    /proof ZIP/,
  );
  await assert.rejects(
    readProofBytes(
      new Response(zip, {
        headers: {
          "content-type": "application/zip",
          "content-length": String(MAX_PROOF_BYTES + 1),
        },
      }),
      () => undefined,
    ),
    /20 MB/,
  );
  await assert.rejects(
    readProofBytes(
      new Response("not a zip", {
        headers: { "content-type": "application/zip" },
      }),
      () => undefined,
    ),
    /malformed/,
  );
  const gate = new OwnerSessionGate();
  gate.update(OTHER_ADDRESS);
  const ticket = gate.ticket();
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      gate.update(null);
      c.enqueue(zip);
      c.close();
    },
  });
  await assert.rejects(
    readProofBytes(
      new Response(body, { headers: { "content-type": "application/zip" } }),
      () => gate.assert(ticket),
    ),
    /locked/,
  );
});

test("service: proof streaming cancels oversized bodies without a content length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(MAX_PROOF_BYTES + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readProofBytes(
      new Response(body, { headers: { "content-type": "application/zip" } }),
      () => undefined,
    ),
    /20 MB/,
  );
  assert.equal(cancelled, true);
});

test("service: native proof fallback requires a bounded declared size", async () => {
  const zip = new Uint8Array([80, 75, 3, 4]);
  const sized = new Response(zip, {
    headers: { "content-type": "application/zip", "content-length": "4" },
  });
  Object.defineProperty(sized, "body", { value: null });
  assert.deepEqual(await readProofBytes(sized, () => undefined), zip);
  const unsized = new Response(zip, {
    headers: { "content-type": "application/zip" },
  });
  Object.defineProperty(unsized, "body", { value: null });
  await assert.rejects(
    readProofBytes(unsized, () => undefined),
    /report the proof size/,
  );
});
