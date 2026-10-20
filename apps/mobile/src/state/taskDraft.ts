// In-memory store for the agent task forms (browser check, scheduled
// payment and service allowance). Like the Send draft it lives outside the screens, so a draft
// survives a font-size remount and Review -> Edit, and it is never written
// to disk. It holds only public form input. Nothing here is a task, a
// permission or a signed term: those come from the Mandate service and the
// native confirmation screen.
//
// Pure TypeScript with no React Native imports, so Node tests can load it.

import type { CHECK_ORDER, PROVIDER_IDS, TARGET_IDS } from "@mandate/schema";
import {
  CEILINGS,
  checkAmount,
  checkCount,
  formCheck,
  type FormCheck,
} from "../config/agentLimits";
import { ASSET_LABELS, PROVIDER_LABELS } from "../config/taskLabels";
import { formatAgentAmount } from "../domain/amounts";
import { contextKey, type DraftContext } from "./sendDraft";

export type Check = (typeof CHECK_ORDER)[number];
export type ProviderId = (typeof PROVIDER_IDS)[number];
export type TargetId = (typeof TARGET_IDS)[number];
// The two agent assets in plan S2. USDC also needs a wallet policy cap.
export type AgentAsset = "DemoUSD" | "USDC";
export type ScheduleInterval = "daily" | "weekly" | "demo";
// ALLOWANCE periods (plan S9.7): 86400 or 604800 seconds.
export type AllowancePeriod = "daily" | "weekly";

// Canonical orders from the shared schema (tested against it).
export const CHECKS = [
  "pageLoad",
  "title",
  "formSubmit",
] as const satisfies readonly Check[];
export const PROVIDERS = ["a", "b"] as const satisfies readonly ProviderId[];

export interface BrowserDraft {
  goal: string;
  targetId: TargetId;
  checks: readonly Check[];
  providerIds: readonly ProviderId[];
  asset: AgentAsset;
  maxPaidAttempts: 1 | 2 | 3;
  spendCap: string;
}

export interface ScheduleDraft {
  recipient: string;
  amount: string;
  asset: AgentAsset;
  start: string;
  interval: ScheduleInterval;
  window: string;
  periods: string;
}

// Service allowance (runbook "service-allowance", Permit kind ALLOWANCE).
export interface AllowanceDraft {
  asset: AgentAsset;
  period: AllowancePeriod;
  periodCap: string;
  spendCap: string;
  maxPayment: string;
  providerIds: readonly ProviderId[];
  days: string;
  maxPurchases: string;
}

export interface TaskDrafts {
  browser: BrowserDraft;
  schedule: ScheduleDraft;
  allowance: AllowanceDraft;
}

export type TaskDraftKind = keyof TaskDrafts;

// Nothing is chosen for the owner: no checks or providers, one paid
// attempt, and DemoUSD, which the default wallet policy already caps.
export const EMPTY_TASK_DRAFTS: TaskDrafts = Object.freeze({
  browser: Object.freeze({
    goal: "",
    targetId: "checkout-healthy",
    checks: [],
    providerIds: [],
    asset: "DemoUSD",
    maxPaidAttempts: 1,
    spendCap: "",
  }),
  schedule: Object.freeze({
    recipient: "",
    amount: "",
    asset: "DemoUSD",
    start: "",
    interval: "daily",
    window: "",
    periods: "",
  }),
  allowance: Object.freeze({
    asset: "DemoUSD",
    period: "daily",
    periodCap: "",
    spendCap: "",
    maxPayment: "",
    providerIds: [],
    days: "",
    maxPurchases: "",
  }),
});

type Listener = () => void;

const drafts = new Map<string, TaskDrafts>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

// Returns the same object until a draft changes, as useSyncExternalStore
// requires.
export function getTaskDrafts(context: DraftContext): TaskDrafts {
  return drafts.get(contextKey(context)) ?? EMPTY_TASK_DRAFTS;
}

function update<K extends TaskDraftKind>(
  context: DraftContext,
  kind: K,
  patch: Partial<TaskDrafts[K]>,
) {
  const current = getTaskDrafts(context);
  drafts.set(contextKey(context), {
    ...current,
    [kind]: { ...current[kind], ...patch },
  });
  notify();
}

export function updateBrowserDraft(
  context: DraftContext,
  patch: Partial<BrowserDraft>,
): void {
  update(context, "browser", patch);
}

export function updateScheduleDraft(
  context: DraftContext,
  patch: Partial<ScheduleDraft>,
): void {
  update(context, "schedule", patch);
}

export function updateAllowanceDraft(
  context: DraftContext,
  patch: Partial<AllowanceDraft>,
): void {
  update(context, "allowance", patch);
}

function toggleInOrder<T>(
  selected: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const next = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];
  return order.filter((v) => next.includes(v));
}

export function toggleCheck(context: DraftContext, check: Check): void {
  const { checks } = getTaskDrafts(context).browser;
  update(context, "browser", { checks: toggleInOrder(checks, check, CHECKS) });
}

export function toggleProvider(
  context: DraftContext,
  provider: ProviderId,
): void {
  const { providerIds } = getTaskDrafts(context).browser;
  update(context, "browser", {
    providerIds: toggleInOrder(providerIds, provider, PROVIDERS),
  });
}

export function toggleAllowanceProvider(
  context: DraftContext,
  provider: ProviderId,
): void {
  const { providerIds } = getTaskDrafts(context).allowance;
  update(context, "allowance", {
    providerIds: toggleInOrder(providerIds, provider, PROVIDERS),
  });
}

const filled = (value: string) => value.trim() !== "";

export function isBrowserDraftComplete(draft: BrowserDraft): boolean {
  return (
    filled(draft.goal) &&
    draft.checks.length > 0 &&
    draft.providerIds.length > 0 &&
    filled(draft.spendCap)
  );
}

export function isScheduleDraftComplete(draft: ScheduleDraft): boolean {
  return [
    draft.recipient,
    draft.amount,
    draft.start,
    draft.window,
    draft.periods,
  ].every(filled);
}

export type AllowanceField =
  | "periodCap"
  | "spendCap"
  | "maxPayment"
  | "days"
  | "maxPurchases";

const PERIOD_WORD: Record<AllowancePeriod, string> = {
  daily: "day",
  weekly: "week",
};

// Form-level check against the S2 ceilings (plan S9.7). The contract and
// the wallet policy check again; this does not replace either.
export function validateAllowanceDraft(
  draft: AllowanceDraft,
): FormCheck<AllowanceField> {
  const asset = ASSET_LABELS[draft.asset];
  const word = PERIOD_WORD[draft.period];
  const periodCap = checkAmount(
    draft.periodCap,
    asset,
    draft.period === "daily" ? CEILINGS.walletDay : CEILINGS.walletWeek,
  );
  const spendCap = checkAmount(draft.spendCap, asset, null);
  const maxPayment = checkAmount(draft.maxPayment, asset, CEILINGS.perPayment);
  const days = checkCount(draft.days, CEILINGS.allowanceDays, "day");
  const purchases = checkCount(
    draft.maxPurchases,
    CEILINGS.allowanceActions,
    "purchase",
  );
  const errors: Partial<Record<AllowanceField, string>> = {};
  if (periodCap.error) errors.periodCap = periodCap.error;
  if (spendCap.error) errors.spendCap = spendCap.error;
  if (maxPayment.error) errors.maxPayment = maxPayment.error;
  else if (
    maxPayment.units !== null &&
    periodCap.units !== null &&
    maxPayment.units > periodCap.units
  )
    errors.maxPayment = `Cannot be more than the cap per ${word}`;
  if (days.error) errors.days = days.error;
  if (purchases.error) errors.maxPurchases = purchases.error;

  const missing: string[] = [];
  if (!filled(draft.periodCap)) missing.push(`Cap per ${word}`);
  if (!filled(draft.spendCap)) missing.push("Total cap");
  if (!filled(draft.maxPayment)) missing.push("Most per purchase");
  if (draft.providerIds.length === 0) missing.push("A provider");
  if (!filled(draft.days)) missing.push("How long it lasts");
  if (!filled(draft.maxPurchases)) missing.push("Most purchases");
  return formCheck(errors, missing);
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

// The allowance in plain words, or null until the form is complete.
export function allowanceSummary(draft: AllowanceDraft): string[] | null {
  if (!validateAllowanceDraft(draft).complete) return null;
  const asset = ASSET_LABELS[draft.asset];
  const word = PERIOD_WORD[draft.period];
  const amount = (text: string) =>
    `${formatAgentAmount(checkAmount(text, asset, null).units ?? 0n)} ${asset}`;
  const providers = draft.providerIds.map((p) => PROVIDER_LABELS[p]);
  return [
    `Your agent may spend up to ${amount(draft.periodCap)} each ${word}, and ${amount(draft.spendCap)} in total.`,
    `Each purchase is at most ${amount(draft.maxPayment)}, and only from ${providers.join(" or ")}.`,
    `It can make up to ${plural(Number(draft.maxPurchases), "purchase")}. The allowance ends ${plural(Number(draft.days), "day")} after it starts.`,
    `Each ${word} is counted from when the allowance starts, not from midnight. Unused budget does not carry over.`,
  ];
}

// Leaving a form discards its draft; the other forms are kept.
export function clearTaskDraft(
  context: DraftContext,
  kind: TaskDraftKind,
): void {
  const key = contextKey(context);
  const current = drafts.get(key);
  if (!current) return;
  drafts.set(key, { ...current, [kind]: EMPTY_TASK_DRAFTS[kind] });
  notify();
}

// Switching account or network cancels the previous context's drafts.
export function switchTaskContext(from: DraftContext, to: DraftContext): void {
  if (contextKey(from) !== contextKey(to) && drafts.delete(contextKey(from)))
    notify();
}

// App lock, session logout and local wallet removal clear every draft.
export function clearAllTaskDrafts(): void {
  if (drafts.size === 0) return;
  drafts.clear();
  notify();
}

export function subscribeTaskDrafts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
