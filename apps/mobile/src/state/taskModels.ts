import { getAddress, zeroAddress, type Address } from "viem";
import type { Terms, TaskView } from "../wallet/service-dto/api";
import type { WalletActivity } from "../wallet/service-dto/activity";
import type { SentTx } from "../wallet/local";

export const CHECKS = ["pageLoad", "title", "formSubmit"] as const;
export type BrowserCheck = (typeof CHECKS)[number];
export interface BrowserForm {
  targetId: "checkout-healthy" | "checkout-broken";
  checks: BrowserCheck[];
  maxPaidAttempts: number;
  maxSteps: number;
  taskDeadline: string;
}
export function browserInput(
  form: BrowserForm,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !form.checks.length ||
    new Set(form.checks).size !== form.checks.length ||
    form.checks.some((c) => !CHECKS.includes(c))
  )
    throw new Error("Choose at least one check.");
  if (
    !Number.isInteger(form.maxPaidAttempts) ||
    form.maxPaidAttempts < 1 ||
    form.maxPaidAttempts > 3
  )
    throw new Error("Choose 1 to 3 paid attempts.");
  if (
    !Number.isInteger(form.maxSteps) ||
    form.maxSteps < form.maxPaidAttempts ||
    form.maxSteps > 8
  )
    throw new Error("Steps must cover paid attempts and be at most 8.");
  if (
    !/^\d+$/.test(form.taskDeadline) ||
    BigInt(form.taskDeadline) <= BigInt(now) ||
    BigInt(form.taskDeadline) > BigInt(now + 86400)
  )
    throw new Error("Set a future deadline within 24 hours.");
  return { ...form, checks: CHECKS.filter((c) => form.checks.includes(c)) };
}
export function decimalUnits(value: string, allowZero = true): string {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value.trim()))
    throw new Error("Use a DemoUSD amount with at most six decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const units = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (!allowZero && units === 0n)
    throw new Error("The payment and task caps must be greater than zero.");
  return units.toString();
}
export interface TermsForm {
  recipients: string;
  maxPayment: string;
  spendCap: string;
  liquidFloor: string;
  reviewThreshold: string;
  startsAt: string;
  expiresAt: string;
  maxActions: number;
  maxPayments: number;
}
export function taskTerms(
  form: TermsForm,
  asset: Address,
  now = Math.floor(Date.now() / 1000),
): Terms {
  const recipients = [
    ...new Set(
      form.recipients
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((a) => getAddress(a).toLowerCase() as Address),
    ),
  ].sort();
  if (
    !recipients.length ||
    recipients.length > 4 ||
    recipients.includes(zeroAddress)
  )
    throw new Error("Enter 1 to 4 nonzero provider recipient addresses.");
  const maxPayment = decimalUnits(form.maxPayment, false);
  const spendCap = decimalUnits(form.spendCap, false);
  const reviewThreshold = decimalUnits(form.reviewThreshold);
  const liquidFloor = decimalUnits(form.liquidFloor);
  // MandateLimits.sol MIN_LIQUID_FLOOR: the wallet refuses lower floors.
  if (BigInt(liquidFloor) < 3000000n)
    throw new Error(
      "Keep at least 3.000000 of the asset liquid in the agent wallet.",
    );
  if (
    BigInt(maxPayment) > 500000n ||
    BigInt(spendCap) > 2000000n ||
    BigInt(maxPayment) > BigInt(spendCap)
  )
    throw new Error(
      "Limits: 0.500000 per payment and 2.000000 per task; payment cap must fit the task cap.",
    );
  if (
    !/^\d+$/.test(form.startsAt) ||
    !/^\d+$/.test(form.expiresAt) ||
    BigInt(form.expiresAt) <= BigInt(form.startsAt) ||
    BigInt(form.expiresAt) <= BigInt(now) ||
    BigInt(form.expiresAt) - BigInt(form.startsAt) > 86400n
  )
    throw new Error("Use a valid time window of at most 24 hours.");
  if (
    !Number.isInteger(form.maxActions) ||
    form.maxActions < 1 ||
    form.maxActions > 8 ||
    !Number.isInteger(form.maxPayments) ||
    form.maxPayments < 1 ||
    form.maxPayments > 3 ||
    form.maxPayments > form.maxActions
  )
    throw new Error(
      "Use 1–8 actions and 1–3 payments, with payments within actions.",
    );
  return {
    asset,
    startsAt: form.startsAt,
    expiresAt: form.expiresAt,
    maxActions: form.maxActions,
    maxPayments: form.maxPayments,
    maxPayment,
    spendCap,
    reviewThreshold,
    liquidFloor,
    depositCap: "0",
    withdrawCap: "0",
    periodCap: "0",
    periodSeconds: 0,
    recipients,
    schedule: {
      recipient: zeroAddress,
      amount: "0",
      start: "0",
      interval: 0,
      window: 0,
      periods: 0,
    },
    templateIds: [],
  };
}
export function taskTitle(task: TaskView) {
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
  if (task.outcomeState === "COMPLETED")
    return pending
      ? "Result received; payment pending"
      : "Task result received";
  return task.outcomeState === "AWAITING_OWNER"
    ? "Approve this task"
    : "Task status";
}
export function activityActor(
  item: Pick<WalletActivity, "source" | "category">,
): "You" | "Agent" | "Incoming" {
  if (item.category === "INCOMING") return "Incoming";
  return item.source === "MANAGED" && ["AGENT", "VAULT"].includes(item.category)
    ? "Agent"
    : "You";
}
export function mergeActivity(
  indexed: WalletActivity[],
  local: SentTx[],
  owner: string,
) {
  const own = indexed.filter(
    (i) => i.ownerAddress.toLowerCase() === owner.toLowerCase(),
  );
  const byId = new Map(own.map((i) => [i.activityId, i]));
  const hashes = new Set(own.map((i) => i.txHash.toLowerCase()));
  return {
    indexed: [...byId.values()],
    local: local.filter(
      (t) =>
        t.from.toLowerCase() === owner.toLowerCase() &&
        !hashes.has(t.hash.toLowerCase()),
    ),
  };
}
