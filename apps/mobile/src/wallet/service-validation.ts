import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  sha256,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import { checkApproval, checkPermit } from "./approvals";
import { walletDomain } from "./core";
import { APPROVAL_TYPES, PERMIT_TYPES } from "./typed";
import {
  ApprovalRequestSchema,
  OwnerApprovalSchema,
  type TaskView,
  type WalletView,
  type Terms,
} from "./service-dto/api";
import { ScheduleSchema } from "./service-dto/authority";
import { Hex32Schema, Uint256 } from "./service-dto/primitives";

const DOMAIN_FIELDS = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];
export const ACTION_TYPES = {
  Action: [
    { name: "permitId", type: "bytes32" },
    { name: "requestId", type: "bytes32" },
    { name: "operation", type: "uint8" },
    { name: "target", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "minOutput", type: "uint256" },
    { name: "invoiceId", type: "bytes32" },
    { name: "inputHash", type: "bytes32" },
    { name: "period", type: "uint32" },
    { name: "issuedAt", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

function requireMatch(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`${message} Nothing was signed.`);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const object = z.record(z.unknown()).parse(value);
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Invalid canonical JSON.");
}
export const hashCanonical = (value: unknown) =>
  sha256(stringToHex(canonicalJson(value)));
function sortedUnique(items: readonly string[]) {
  requireMatch(
    items.every((v, i) => i === 0 || items[i - 1]! < v),
    "Commitment list is not sorted and unique.",
  );
}
export function templateIdsHash(ids: readonly Hex[]): Hex {
  const parsed = z.array(Hex32Schema).max(8).parse(ids);
  sortedUnique(parsed);
  return parsed.length === 0
    ? zeroHash
    : keccak256(encodeAbiParameters([{ type: "bytes32[]" }], [parsed]));
}
export function recipientsHash(recipients: readonly Address[]): Hex {
  requireMatch(recipients.length <= 4, "Too many recipients.");
  sortedUnique(recipients.map((a) => a.toLowerCase()));
  return keccak256(
    encodeAbiParameters([{ type: "address[]" }], [[...recipients]]),
  );
}
export function scheduleHash(value: unknown): Hex {
  const s = ScheduleSchema.parse(value);
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "start", type: "uint64" },
            { name: "interval", type: "uint32" },
            { name: "window", type: "uint32" },
            { name: "periods", type: "uint32" },
          ],
        },
      ],
      [{ ...s, amount: BigInt(s.amount), start: BigInt(s.start) }],
    ),
  );
}
function checkTypedData(
  types: Record<string, { name: string; type: string }[]>,
  primary: "Permit" | "Approval",
  expected: readonly { name: string; type: string }[],
  domain: unknown,
  address: Address,
) {
  requireMatch(
    canonicalJson(domain) === canonicalJson(walletDomain(address)),
    "Unexpected signing domain.",
  );
  requireMatch(
    canonicalJson(types) ===
      canonicalJson({ EIP712Domain: DOMAIN_FIELDS, [primary]: expected }),
    "Unexpected signing fields or order.",
  );
}
export function permitSigningMessage(
  p: z.infer<typeof OwnerApprovalSchema>["typedData"]["message"],
) {
  return {
    ...p,
    issuedAt: BigInt(p.issuedAt),
    startsAt: BigInt(p.startsAt),
    expiresAt: BigInt(p.expiresAt),
    epoch: BigInt(p.epoch),
    nonce: BigInt(p.nonce),
    maxPayment: BigInt(p.maxPayment),
    spendCap: BigInt(p.spendCap),
    liquidFloor: BigInt(p.liquidFloor),
    depositCap: BigInt(p.depositCap),
    withdrawCap: BigInt(p.withdrawCap),
    reviewThreshold: BigInt(p.reviewThreshold),
    periodCap: BigInt(p.periodCap),
  };
}
export interface PermitContext {
  wallet: WalletView;
  task: TaskView;
  epoch: bigint;
  nowSeconds: bigint;
  agentAssets: readonly Address[];
  executor: Address;
  terms?: Terms;
  // The order shown to the owner; an order Permit must commit to exactly it.
  order?: {
    productId: string;
    size: string | null;
    amount: string;
    deliveryHash: Hex;
  };
}
export function validatePermitDraft(value: unknown, context: PermitContext) {
  const draft = OwnerApprovalSchema.parse(value);
  const { wallet, task } = context;
  const p = draft.typedData.message;
  requireMatch(
    wallet.provisioningState === "READY" && wallet.address !== null,
    "The service wallet is not ready.",
  );
  checkTypedData(
    draft.typedData.types,
    "Permit",
    PERMIT_TYPES.Permit,
    draft.typedData.domain,
    wallet.address,
  );
  requireMatch(
    task.walletId === wallet.walletId && p.taskId === task.chainTaskId,
    "The draft belongs to another task.",
  );
  requireMatch(
    task.outcomeState === "AWAITING_OWNER",
    "This task is no longer awaiting approval.",
  );
  requireMatch(
    wallet.executorAddress?.toLowerCase() === context.executor.toLowerCase() &&
      p.executor.toLowerCase() === context.executor.toLowerCase() &&
      p.executor !== zeroAddress,
    "Unexpected executor.",
  );
  requireMatch(
    draft.policyVersion === wallet.policyVersion,
    "Wallet policy changed.",
  );
  const checked = checkPermit(p, context);
  requireMatch(checked.ok, checked.ok ? "" : checked.error);
  requireMatch(
    BigInt(p.issuedAt) <= context.nowSeconds &&
      BigInt(p.maxPayment) > 0n &&
      BigInt(p.spendCap) > 0n &&
      p.maxActions > 0 &&
      p.maxPayments > 0,
    "Invalid time or zero payment limits.",
  );
  const { conditions, runbookManifest, providerBindings } = draft.scope;
  requireMatch(
    p.kind ===
      (
        {
          "browser-check": 0,
          "liquidity-keeper": 1,
          "scheduled-pay": 2,
          "service-allowance": 3,
          "commerce-buy": 0,
        } as const
      )[task.runbookId],
    "Runbook kind differs.",
  );
  requireMatch(
    conditions.runbookId === task.runbookId &&
      runbookManifest.runbookId === task.runbookId &&
      runbookManifest.kind === p.kind,
    "Runbook metadata differs from the task.",
  );
  requireMatch(
    p.runbookHash === hashCanonical(runbookManifest) &&
      p.conditionsHash === hashCanonical(conditions),
    "Runbook or conditions commitment differs.",
  );
  requireMatch(
    p.recipientsHash === recipientsHash(draft.recipients) &&
      p.scheduleHash === scheduleHash(draft.schedule) &&
      p.templatesHash === templateIdsHash(draft.templateIds),
    "Recipient, schedule or template commitment differs.",
  );
  if (conditions.browser) {
    requireMatch(
      p.kind === 0 &&
        BigInt(p.expiresAt) <= BigInt(conditions.browser.taskDeadline) &&
        p.maxActions <= conditions.browser.maxSteps &&
        p.maxPayments <= conditions.browser.maxPaidAttempts,
      "Browser scope exceeds the reviewed limits.",
    );
    const bound = [
      ...new Set(providerBindings.map((b) => b.recipient.toLowerCase())),
    ].sort();
    requireMatch(
      canonicalJson(bound) ===
        canonicalJson(draft.recipients.map((a) => a.toLowerCase())),
      "Provider recipients differ from the signed recipients.",
    );
    requireMatch(
      providerBindings.every((b) =>
        conditions.browser!.providerIds.includes(b.providerId),
      ),
      "Unexpected provider binding.",
    );
  }
  if (conditions.commerce) {
    const c = conditions.commerce;
    const o = context.order;
    requireMatch(
      !!o &&
        c.productId === o.productId &&
        c.size === o.size &&
        c.maxAmount === o.amount &&
        c.deliveryHash.toLowerCase() === o.deliveryHash.toLowerCase(),
      "The order differs from the one shown.",
    );
    requireMatch(
      p.kind === 0 &&
        BigInt(p.expiresAt) <= BigInt(c.taskDeadline) &&
        p.maxPayments === 1 &&
        BigInt(p.maxPayment) <= BigInt(c.maxAmount) &&
        BigInt(p.spendCap) <= BigInt(c.maxAmount),
      "The order's limits exceed its price.",
    );
    requireMatch(
      providerBindings.length === 1 &&
        providerBindings[0]!.providerId === "shop" &&
        canonicalJson([providerBindings[0]!.recipient.toLowerCase()]) ===
          canonicalJson(draft.recipients.map((a) => a.toLowerCase())),
      "The order must pay only the shop.",
    );
  }
  if (p.kind !== 2)
    requireMatch(
      scheduleHash(draft.schedule) ===
        scheduleHash({
          recipient: zeroAddress,
          amount: "0",
          start: "0",
          interval: 0,
          window: 0,
          periods: 0,
        }),
      "Unexpected payment schedule.",
    );
  if (conditions.schedule)
    requireMatch(
      scheduleHash(conditions.schedule) === p.scheduleHash,
      "Conditions schedule differs.",
    );
  if (conditions.calls)
    requireMatch(
      templateIdsHash(conditions.calls.templateIds) === p.templatesHash,
      "Call templates differ.",
    );
  else
    requireMatch(draft.templateIds.length === 0, "Unexpected call templates.");
  if (context.terms) {
    const { recipients, schedule, templateIds, ...terms } = context.terms;
    requireMatch(
      Object.entries(terms).every(
        ([k, v]) => canonicalJson(p[k as keyof typeof p]) === canonicalJson(v),
      ) &&
        recipientsHash(recipients) === p.recipientsHash &&
        scheduleHash(schedule) === p.scheduleHash &&
        templateIdsHash(templateIds) === p.templatesHash,
      "The service changed the requested terms.",
    );
  }
  requireMatch(
    hashTypedData({
      domain: walletDomain(wallet.address),
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: permitSigningMessage(p),
    }) === draft.digest,
    "Permit digest differs.",
  );
  return draft;
}
export interface ApprovalPermitContext {
  permitId: Hex;
  taskId: Hex;
  asset: Address;
  epoch: bigint;
  currentEpoch: bigint;
  activated: boolean;
  closed: boolean;
  revoked: boolean;
  startsAt: bigint;
  expiresAt: bigint;
}
export function validatePaymentApproval(
  value: unknown,
  wallet: WalletView,
  task: TaskView,
  nowSeconds: bigint,
  permit: ApprovalPermitContext,
) {
  const approval = ApprovalRequestSchema.parse(value);
  requireMatch(
    wallet.address !== null && wallet.provisioningState === "READY",
    "Wallet is not ready.",
  );
  checkTypedData(
    approval.typedData.types,
    "Approval",
    APPROVAL_TYPES.Approval,
    approval.typedData.domain,
    wallet.address,
  );
  requireMatch(
    approval.walletId === wallet.walletId &&
      approval.taskId === task.taskId &&
      task.walletId === wallet.walletId,
    "Approval belongs to another task or wallet.",
  );
  requireMatch(
    approval.state === "PENDING" &&
      approval.expiresAt === approval.typedData.message.expiresAt,
    "Approval is no longer pending or has inconsistent expiry.",
  );
  const checked = checkApproval(approval.typedData.message, nowSeconds);
  requireMatch(checked.ok, checked.ok ? "" : checked.error);
  const a = approval.action;
  const actionMessage = {
    ...a,
    amount: BigInt(a.amount),
    minOutput: BigInt(a.minOutput),
    issuedAt: BigInt(a.issuedAt),
    deadline: BigInt(a.deadline),
  };
  requireMatch(
    hashTypedData({
      domain: walletDomain(wallet.address),
      types: ACTION_TYPES,
      primaryType: "Action",
      message: actionMessage,
    }) === approval.typedData.message.actionDigest,
    "Action digest differs from the approved payment.",
  );
  const invoice = approval.invoice;
  requireMatch(
    invoice !== null && (a.operation === 0 || a.operation === 6),
    "Only invoice-bound payments can be approved here.",
  );
  requireMatch(
    invoice.wallet === wallet.address &&
      invoice.taskId === task.chainTaskId &&
      invoice.recipient === a.target &&
      invoice.amount === a.amount &&
      invoice.inputHash === a.inputHash &&
      invoice.invoiceId === a.invoiceId &&
      BigInt(a.amount) > 0n &&
      BigInt(a.issuedAt) <= nowSeconds &&
      BigInt(invoice.issuedAt) <= nowSeconds &&
      BigInt(a.deadline) >= BigInt(approval.expiresAt) &&
      BigInt(invoice.expiresAt) >= BigInt(approval.expiresAt),
    "Invoice fields differ from the co-signed Action.",
  );
  requireMatch(
    permit.activated &&
      !permit.closed &&
      !permit.revoked &&
      permit.epoch === permit.currentEpoch &&
      permit.startsAt <= nowSeconds &&
      permit.expiresAt > nowSeconds,
    "Payment permission is not active.",
  );
  requireMatch(
    a.permitId === permit.permitId &&
      permit.taskId === task.chainTaskId &&
      permit.asset === invoice.asset,
    "Payment asset or task differs from the activated Permit.",
  );
  requireMatch(
    wallet.assets.some((asset) => asset.asset === invoice.asset),
    "Payment asset is not registered for this wallet.",
  );
  requireMatch(
    hashTypedData({
      domain: walletDomain(wallet.address),
      types: APPROVAL_TYPES,
      primaryType: "Approval",
      message: {
        actionDigest: approval.typedData.message.actionDigest,
        expiresAt: BigInt(approval.expiresAt),
      },
    }) === approval.digest,
    "Approval digest differs.",
  );
  return approval;
}
export function formatUnitsExact(units: string, decimals = 6): string {
  Uint256.parse(units);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new Error("Invalid asset precision.");
  if (decimals === 0) return units;
  const padded = units.padStart(decimals + 1, "0");
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`;
}
export function taskProgress(task: TaskView) {
  const pending = task.payments.some((p) =>
    [
      "PROPOSED",
      "RESERVED",
      "AWAITING_APPROVAL",
      "SIGNING",
      "SIGNED",
      "SUBMITTED",
      "UNKNOWN",
    ].includes(p.chainState),
  );
  const provisional = task.payments.some((p) => p.chainState === "INCLUDED");
  const failed = task.payments.some((p) =>
    ["DENIED", "REJECTED", "REVERTED"].includes(p.chainState),
  );
  return {
    result: task.outcomeState,
    permission: task.authorityState,
    payment: pending
      ? "PENDING"
      : provisional
        ? "PROVISIONAL"
        : failed
          ? "FAILED"
          : "SETTLED",
    done:
      task.outcomeState === "COMPLETED" && !pending && !provisional && !failed,
  } as const;
}
