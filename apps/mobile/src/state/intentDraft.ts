// In-memory store for the intent flow (plan S9.3, P3-A02): the owner's goal,
// the draft the compiler proposed and the owner's edits to it. The compiled
// draft is kept unchanged so the review can mark every edited term; the
// terms shown for signing are always the edited ones. Never written to disk.
// Nothing here is a permission: the service drafts the exact terms and the
// native confirmation screen shows what is signed.
//
// Pure TypeScript with no React Native imports, so Node tests can load it.

import type { Terms } from "@mandate/schema";
import {
  CEILINGS,
  checkAmount,
  formCheck,
  type FormCheck,
} from "../config/agentLimits";
import {
  ASSET_LABELS,
  CHECK_LABELS,
  PROVIDER_LABELS,
  TARGET_LABELS,
} from "../config/taskLabels";
import { formatAgentAmount, parseAgentAmount } from "../domain/amounts";
import { contextKey, type DraftContext } from "./sendDraft";
import {
  PROVIDERS,
  type AgentAsset,
  type Check,
  type ProviderId,
  type TargetId,
} from "./taskDraft";

export type TermKey = keyof Terms;

// The shared Terms fields in schema order (tested against TermsSchema).
export const TERM_ORDER = [
  "asset",
  "startsAt",
  "expiresAt",
  "maxActions",
  "maxPayments",
  "maxPayment",
  "spendCap",
  "liquidFloor",
  "depositCap",
  "withdrawCap",
  "reviewThreshold",
  "periodCap",
  "periodSeconds",
  "recipients",
  "schedule",
  "templateIds",
] as const satisfies readonly TermKey[];

export const TERM_LABELS: Record<TermKey, string> = {
  asset: "Asset",
  startsAt: "Starts",
  expiresAt: "Expires",
  maxActions: "Most actions",
  maxPayments: "Most payments",
  maxPayment: "Most per payment",
  spendCap: "Total spend cap",
  liquidFloor: "Minimum balance kept",
  depositCap: "Vault deposit cap",
  withdrawCap: "Vault withdrawal cap",
  reviewThreshold: "Needs your approval above",
  periodCap: "Cap per period",
  periodSeconds: "Period",
  recipients: "Recipients",
  schedule: "Schedule",
  templateIds: "Contract calls",
};

// Terms the owner can change in the draft form, in TERM_ORDER.
export const EDITABLE_TERMS = [
  "asset",
  "expiresAt",
  "maxPayments",
  "maxPayment",
  "spendCap",
  "reviewThreshold",
  "recipients",
] as const satisfies readonly TermKey[];

export type EditableTerm = (typeof EDITABLE_TERMS)[number];

// A permission lasts at most 24 hours (plan S2).
export type IntentLifetime = "60" | "480" | "1440";

export interface IntentTerms {
  asset: AgentAsset;
  lifetimeMinutes: IntentLifetime;
  maxActions: string;
  maxPayments: "1" | "2" | "3";
  maxPayment: string;
  spendCap: string;
  liquidFloor: string;
  // Empty: no payment waits for the owner.
  reviewThreshold: string;
  providerIds: readonly ProviderId[];
}

// What the compiler returns, reduced to the browser-check runbook, which is
// the only kind the preview drafts. Addresses are never shown as hex here.
export interface CompiledIntent {
  label: string;
  goal: string;
  runbookId: "browser-check";
  input: { targetId: TargetId; checks: readonly Check[] };
  explanation: string;
  warnings: readonly string[];
  terms: IntentTerms;
}

export interface IntentState {
  goal: string;
  compiled: CompiledIntent | null;
  // The owner's edited copy of compiled.terms.
  terms: IntentTerms | null;
}

const EMPTY_STATE: IntentState = Object.freeze({
  goal: "",
  compiled: null,
  terms: null,
});

const sameAmount = (a: string, b: string) => {
  const ua = parseAgentAmount(a);
  const ub = parseAgentAmount(b);
  return ua !== null && ub !== null ? ua === ub : a.trim() === b.trim();
};

const EDIT_CHECKS: Record<
  EditableTerm,
  (a: IntentTerms, b: IntentTerms) => boolean
> = {
  asset: (a, b) => a.asset === b.asset,
  expiresAt: (a, b) => a.lifetimeMinutes === b.lifetimeMinutes,
  maxPayments: (a, b) => a.maxPayments === b.maxPayments,
  maxPayment: (a, b) => sameAmount(a.maxPayment, b.maxPayment),
  spendCap: (a, b) => sameAmount(a.spendCap, b.spendCap),
  reviewThreshold: (a, b) => sameAmount(a.reviewThreshold, b.reviewThreshold),
  recipients: (a, b) => a.providerIds.join() === b.providerIds.join(),
};

export function editedTerms(state: IntentState): EditableTerm[] {
  const { compiled, terms } = state;
  if (!compiled || !terms) return [];
  return EDITABLE_TERMS.filter((k) => !EDIT_CHECKS[k](compiled.terms, terms));
}

export interface ReviewRow {
  key: TermKey;
  label: string;
  value: string;
  edited: boolean;
}

const NOT_USED = "Not used by this task";

const LIFETIME_TEXT: Record<IntentLifetime, string> = {
  "60": "1 hour after it starts",
  "480": "8 hours after it starts",
  "1440": "24 hours after it starts",
};

function termValues(t: IntentTerms): Record<TermKey, string> {
  const asset = ASSET_LABELS[t.asset];
  const amount = (text: string) => {
    const units = parseAgentAmount(text);
    return units === null
      ? `Not valid: ${text.trim() || "empty"}`
      : `${formatAgentAmount(units)} ${asset}`;
  };
  return {
    asset,
    startsAt: "When you approve",
    expiresAt: LIFETIME_TEXT[t.lifetimeMinutes],
    maxActions: t.maxActions,
    maxPayments: t.maxPayments,
    maxPayment: amount(t.maxPayment),
    spendCap: amount(t.spendCap),
    liquidFloor: amount(t.liquidFloor),
    depositCap: NOT_USED,
    withdrawCap: NOT_USED,
    reviewThreshold:
      t.reviewThreshold.trim() === ""
        ? "Never asks you"
        : amount(t.reviewThreshold),
    periodCap: NOT_USED,
    periodSeconds: NOT_USED,
    recipients:
      t.providerIds.map((p) => PROVIDER_LABELS[p]).join(", ") || "None",
    schedule: NOT_USED,
    templateIds: "None. This task makes no contract calls.",
  };
}

// Every shared Terms field, showing the owner's edited terms.
export function reviewRows(state: IntentState): ReviewRow[] {
  const edited = new Set<TermKey>(editedTerms(state));
  const values = state.terms ? termValues(state.terms) : null;
  return TERM_ORDER.map((key) => ({
    key,
    label: TERM_LABELS[key],
    value: values ? values[key] : "Not drafted yet",
    edited: edited.has(key),
  }));
}

export function inputSummary(input: CompiledIntent["input"]): {
  page: string;
  checks: string;
} {
  return {
    page: TARGET_LABELS[input.targetId],
    checks: input.checks.map((c) => CHECK_LABELS[c].label).join(", "),
  };
}

export type IntentField = "maxPayment" | "spendCap" | "reviewThreshold";

// Form-level check of the edited terms against the S2 ceilings for a
// browser check. The service and the contract check again.
export function validateIntentTerms(t: IntentTerms): FormCheck<IntentField> {
  const asset = ASSET_LABELS[t.asset];
  const maxPayment = checkAmount(t.maxPayment, asset, CEILINGS.perPayment);
  const spendCap = checkAmount(t.spendCap, asset, CEILINGS.taskSpend);
  const errors: Partial<Record<IntentField, string>> = {};
  if (maxPayment.error) errors.maxPayment = maxPayment.error;
  if (spendCap.error) errors.spendCap = spendCap.error;
  else if (
    spendCap.units !== null &&
    maxPayment.units !== null &&
    spendCap.units < maxPayment.units
  )
    errors.spendCap = "Cannot be less than one payment";
  if (
    t.reviewThreshold.trim() !== "" &&
    parseAgentAmount(t.reviewThreshold) === null
  )
    errors.reviewThreshold = "Use digits with up to six decimals, like 0.25";

  const missing: string[] = [];
  if (t.maxPayment.trim() === "") missing.push("Most per payment");
  if (t.spendCap.trim() === "") missing.push("Total spend cap");
  if (t.providerIds.length === 0) missing.push("A provider");
  return formCheck(errors, missing);
}

type Listener = () => void;

const states = new Map<string, IntentState>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

// Returns the same object until the draft changes, as useSyncExternalStore
// requires.
export function getIntentDraft(context: DraftContext): IntentState {
  return states.get(contextKey(context)) ?? EMPTY_STATE;
}

function set(context: DraftContext, patch: Partial<IntentState>) {
  states.set(contextKey(context), { ...getIntentDraft(context), ...patch });
  notify();
}

export function setIntentGoal(context: DraftContext, goal: string): void {
  set(context, { goal });
}

export function loadCompiledIntent(
  context: DraftContext,
  compiled: CompiledIntent,
): void {
  set(context, { compiled, terms: { ...compiled.terms } });
}

export function updateIntentTerms(
  context: DraftContext,
  patch: Partial<IntentTerms>,
): void {
  const { terms } = getIntentDraft(context);
  if (terms) set(context, { terms: { ...terms, ...patch } });
}

export function toggleIntentProvider(
  context: DraftContext,
  provider: ProviderId,
): void {
  const { terms } = getIntentDraft(context);
  if (!terms) return;
  const next = terms.providerIds.includes(provider)
    ? terms.providerIds.filter((p) => p !== provider)
    : [...terms.providerIds, provider];
  set(context, {
    terms: { ...terms, providerIds: PROVIDERS.filter((p) => next.includes(p)) },
  });
}

// Discards the compiled draft and the edits, keeping the goal.
export function discardCompiledIntent(context: DraftContext): void {
  set(context, { compiled: null, terms: null });
}

export function clearIntentDraft(context: DraftContext): void {
  if (states.delete(contextKey(context))) notify();
}

// Switching account or network cancels the previous context's draft.
export function switchIntentContext(
  from: DraftContext,
  to: DraftContext,
): void {
  if (contextKey(from) !== contextKey(to)) clearIntentDraft(from);
}

// App lock, session logout and local wallet removal clear every draft.
export function clearAllIntentDrafts(): void {
  if (states.size === 0) return;
  states.clear();
  notify();
}

export function subscribeIntentDrafts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
