// In-memory store and rules for the wallet policy editor (plan S9.4, P3-A02).
// The form holds public text only and is never written to disk. A policy
// takes effect only when the owner signs it on the native confirmation
// screen, which recomputes the list hashes, and it is applied on chain. This
// module computes a local preview of the changes; it never signs or sends.
//
// Pure TypeScript with no React Native imports, so Node tests can load it.

import {
  CEILINGS,
  checkAmount,
  formCheck,
  type FormCheck,
} from "../config/agentLimits";
import { ASSET_LABELS, PROVIDER_LABELS } from "../config/taskLabels";
import { formatAgentAmount, parseAgentAmount } from "../domain/amounts";
import { contextKey, type DraftContext } from "./sendDraft";
import { PROVIDERS, type AgentAsset, type ProviderId } from "./taskDraft";

export const AGENT_ASSETS = [
  "DemoUSD",
  "USDC",
] as const satisfies readonly AgentAsset[];

export type RecipientChoice = "allowed" | "none" | "blocked";
export type CapField = "perTx" | "daily" | "weekly";
export type ReviewMode = "above" | "never";

export interface AssetCapForm {
  enabled: boolean;
  perTx: string;
  daily: string;
  weekly: string;
}

export interface PolicyForm {
  caps: Record<AgentAsset, AssetCapForm>;
  recipients: Record<ProviderId, RecipientChoice>;
  review: { mode: ReviewMode; amount: string };
}

export interface CapUnits {
  perTx: bigint;
  daily: bigint;
  weekly: bigint;
}

// A policy in base units. reviewThreshold null means no payment waits for
// the owner (2^256-1 on chain).
export interface PolicySnapshot {
  caps: Partial<Record<AgentAsset, CapUnits>>;
  allowlist: readonly ProviderId[];
  blocklist: readonly ProviderId[];
  reviewThreshold: bigint | null;
}

// An x402 payment the contract has authorized but that has not settled
// (plan S9.10). It follows the current policy until it settles or expires.
export interface OutstandingAuthorization {
  id: string;
  recipient: ProviderId;
  asset: AgentAsset;
  amount: bigint;
  ownerApproved: boolean;
}

const EMPTY_CAP: AssetCapForm = Object.freeze({
  enabled: false,
  perTx: "",
  daily: "",
  weekly: "",
});

// The current policy cannot be read, so nothing is filled in for the owner.
// DemoUSD is on because every policy needs at least one asset; USDC needs
// its own cap before agents can use it.
export const EMPTY_POLICY_FORM: PolicyForm = Object.freeze({
  caps: Object.freeze({
    DemoUSD: Object.freeze({ ...EMPTY_CAP, enabled: true }),
    USDC: EMPTY_CAP,
  }),
  recipients: Object.freeze({ a: "none", b: "none" }),
  review: Object.freeze({ mode: "never", amount: "" }),
});

export function formFromSnapshot(snapshot: PolicySnapshot): PolicyForm {
  const cap = (asset: AgentAsset): AssetCapForm => {
    const units = snapshot.caps[asset];
    return units
      ? {
          enabled: true,
          perTx: formatAgentAmount(units.perTx),
          daily: formatAgentAmount(units.daily),
          weekly: formatAgentAmount(units.weekly),
        }
      : EMPTY_CAP;
  };
  const choice = (p: ProviderId): RecipientChoice =>
    snapshot.blocklist.includes(p)
      ? "blocked"
      : snapshot.allowlist.includes(p)
        ? "allowed"
        : "none";
  return {
    caps: { DemoUSD: cap("DemoUSD"), USDC: cap("USDC") },
    recipients: { a: choice("a"), b: choice("b") },
    review:
      snapshot.reviewThreshold === null
        ? { mode: "never", amount: "" }
        : {
            mode: "above",
            amount: formatAgentAmount(snapshot.reviewThreshold),
          },
  };
}

// Limits as "per payment · per day · per week". An asset with no AssetCap
// cannot be spent by agents at all (plan S9.4), so it never reads as
// unlimited.
export function capSummary(cap: CapUnits | undefined): string {
  return cap
    ? `${formatAgentAmount(cap.perTx)} · ${formatAgentAmount(cap.daily)} · ${formatAgentAmount(cap.weekly)}`
    : "Agent spending disabled";
}

export type PolicyField = `${AgentAsset}.${CapField}` | "review";

const CAP_CEILING: Record<CapField, bigint> = {
  perTx: CEILINGS.perPayment,
  daily: CEILINGS.walletDay,
  weekly: CEILINGS.walletWeek,
};

const CAP_WORDS: Record<CapField, string> = {
  perTx: "per payment",
  daily: "per day",
  weekly: "per week",
};

// Form-level check (plan S9.4, P3-A02.T02 form side). Native signing and the
// contract check again. snapshot is set only when the form is complete.
export function validatePolicyForm(
  form: PolicyForm,
): FormCheck<PolicyField> & { snapshot: PolicySnapshot | null } {
  const errors: Partial<Record<PolicyField, string>> = {};
  const missing: string[] = [];
  const caps: Partial<Record<AgentAsset, CapUnits>> = {};

  for (const asset of AGENT_ASSETS) {
    const entry = form.caps[asset];
    if (!entry.enabled) continue;
    const label = ASSET_LABELS[asset];
    const units: Partial<Record<CapField, bigint>> = {};
    for (const field of ["perTx", "daily", "weekly"] as const) {
      const check = checkAmount(entry[field], label, CAP_CEILING[field]);
      if (check.error) errors[`${asset}.${field}`] = check.error;
      else if (check.units !== null) units[field] = check.units;
      else missing.push(`${label} ${CAP_WORDS[field]}`);
    }
    const { perTx, daily, weekly } = units;
    if (perTx !== undefined && daily !== undefined && perTx > daily)
      errors[`${asset}.daily`] = "Cannot be less than per payment";
    if (daily !== undefined && weekly !== undefined && daily > weekly)
      errors[`${asset}.weekly`] = "Cannot be less than per day";
    if (perTx !== undefined && daily !== undefined && weekly !== undefined)
      caps[asset] = { perTx, daily, weekly };
  }
  if (!AGENT_ASSETS.some((asset) => form.caps[asset].enabled))
    missing.push("Limits for at least one asset");

  let reviewThreshold: bigint | null = null;
  if (form.review.mode === "above") {
    if (form.review.amount.trim() === "") missing.push("Review amount");
    else {
      reviewThreshold = parseAgentAmount(form.review.amount);
      if (reviewThreshold === null)
        errors.review = "Use digits with up to six decimals, like 0.25";
    }
  }

  const check = formCheck(errors, missing);
  return {
    ...check,
    snapshot: check.complete
      ? {
          caps,
          allowlist: PROVIDERS.filter((p) => form.recipients[p] === "allowed"),
          blocklist: PROVIDERS.filter((p) => form.recipients[p] === "blocked"),
          reviewThreshold,
        }
      : null,
  };
}

// An empty allowlist turns allowlist filtering off (plan S9.4).
export function allowlistState(form: PolicyForm): "on" | "off" {
  return PROVIDERS.some((p) => form.recipients[p] === "allowed") ? "on" : "off";
}

// True when this change removes the last allowed recipient, which relaxes
// the policy rather than tightening it. Unknown when the current policy is.
export function allowlistTurnsOff(
  baseline: PolicySnapshot | null,
  form: PolicyForm,
): boolean {
  return (
    baseline !== null &&
    baseline.allowlist.length > 0 &&
    allowlistState(form) === "off"
  );
}

export interface PolicyChange {
  text: string;
  // true tightens, false loosens. Tightening applies at once to active
  // permissions; loosening never enlarges a permission's own terms.
  tightens: boolean;
}

const names = (ids: readonly ProviderId[]) =>
  ids.map((p) => PROVIDER_LABELS[p]).join(", ");

export function policyChanges(
  baseline: PolicySnapshot,
  next: PolicySnapshot,
): PolicyChange[] {
  const changes: PolicyChange[] = [];
  const fmt = formatAgentAmount;

  for (const asset of AGENT_ASSETS) {
    const label = ASSET_LABELS[asset];
    const before = baseline.caps[asset];
    const after = next.caps[asset];
    if (!before && after)
      changes.push({
        text: `Lets agents spend ${label}: up to ${fmt(after.perTx)} per payment, ${fmt(after.daily)} per day and ${fmt(after.weekly)} per week`,
        tightens: false,
      });
    else if (before && !after)
      changes.push({
        text: `Stops all agent spending of ${label}`,
        tightens: true,
      });
    else if (before && after)
      for (const field of ["perTx", "daily", "weekly"] as const)
        if (before[field] !== after[field])
          changes.push({
            text: `${label} ${CAP_WORDS[field]} limit from ${fmt(before[field])} to ${fmt(after[field])}`,
            tightens: after[field] < before[field],
          });
  }

  const allowWasOn = baseline.allowlist.length > 0;
  const allowIsOn = next.allowlist.length > 0;
  if (allowWasOn && !allowIsOn)
    changes.push({
      text: "Allowlist off: agents can pay any recipient a task names, unless it is blocked",
      tightens: false,
    });
  else if (!allowWasOn && allowIsOn)
    changes.push({
      text: `Allowlist on: agents can pay only ${names(next.allowlist)}`,
      tightens: true,
    });
  else if (allowIsOn)
    for (const p of PROVIDERS) {
      const was = baseline.allowlist.includes(p);
      const is = next.allowlist.includes(p);
      if (!was && is)
        changes.push({ text: `Allows ${PROVIDER_LABELS[p]}`, tightens: false });
      if (was && !is)
        changes.push({
          text: `Stops payments to ${PROVIDER_LABELS[p]} (removed from the allowlist)`,
          tightens: true,
        });
    }

  for (const p of PROVIDERS) {
    const was = baseline.blocklist.includes(p);
    const is = next.blocklist.includes(p);
    if (!was && is)
      changes.push({ text: `Blocks ${PROVIDER_LABELS[p]}`, tightens: true });
    if (was && !is)
      changes.push({ text: `Unblocks ${PROVIDER_LABELS[p]}`, tightens: false });
  }

  const before = baseline.reviewThreshold;
  const after = next.reviewThreshold;
  if (before === null && after !== null)
    changes.push({
      text: `Payments above ${fmt(after)} wait for your approval`,
      tightens: true,
    });
  else if (before !== null && after === null)
    changes.push({
      text: "No payment waits for your approval any more",
      tightens: false,
    });
  else if (before !== null && after !== null && before !== after)
    changes.push({
      text: `Review threshold from ${fmt(before)} to ${fmt(after)}`,
      tightens: after < before,
    });

  return changes;
}

// Outstanding x402 authorizations that would fail under the new policy
// (plan S9.10): asset cap, per-payment cap, allowlist, blocklist and review
// threshold are rechecked. Daily, weekly and period caps are not, because
// the amount was already charged to them.
export function stoppedAuthorizations(
  next: PolicySnapshot,
  outstanding: readonly OutstandingAuthorization[],
): { id: string; reasons: string[] }[] {
  const stopped: { id: string; reasons: string[] }[] = [];
  for (const auth of outstanding) {
    const reasons: string[] = [];
    const label = ASSET_LABELS[auth.asset];
    const provider = PROVIDER_LABELS[auth.recipient];
    const cap = next.caps[auth.asset];
    if (!cap)
      reasons.push(`Agent spending of ${label} is disabled in the new policy`);
    else if (auth.amount > cap.perTx)
      reasons.push(
        `Above the new ${formatAgentAmount(cap.perTx)} ${label} per-payment limit`,
      );
    if (next.blocklist.includes(auth.recipient))
      reasons.push(`${provider} is blocked`);
    else if (
      next.allowlist.length > 0 &&
      !next.allowlist.includes(auth.recipient)
    )
      reasons.push(`${provider} is no longer on the allowlist`);
    if (
      next.reviewThreshold !== null &&
      auth.amount > next.reviewThreshold &&
      !auth.ownerApproved
    )
      reasons.push(
        "Above the new review threshold, and you did not approve it",
      );
    if (reasons.length > 0) stopped.push({ id: auth.id, reasons });
  }
  return stopped;
}

// Store. baseline is the policy the form started from; null while the
// current policy cannot be read.

export interface PolicyEditor {
  form: PolicyForm;
  baseline: PolicySnapshot | null;
}

const EMPTY_EDITOR: PolicyEditor = Object.freeze({
  form: EMPTY_POLICY_FORM,
  baseline: null,
});

type Listener = () => void;

const editors = new Map<string, PolicyEditor>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

// Returns the same object until the draft changes, as useSyncExternalStore
// requires.
export function getPolicyEditor(context: DraftContext): PolicyEditor {
  return editors.get(contextKey(context)) ?? EMPTY_EDITOR;
}

function setForm(context: DraftContext, form: PolicyForm) {
  const current = getPolicyEditor(context);
  editors.set(contextKey(context), { ...current, form });
  notify();
}

export function loadPolicyForm(
  context: DraftContext,
  form: PolicyForm,
  baseline: PolicySnapshot | null,
): void {
  editors.set(contextKey(context), { form, baseline });
  notify();
}

export function updatePolicyCap(
  context: DraftContext,
  asset: AgentAsset,
  patch: Partial<AssetCapForm>,
): void {
  const { form } = getPolicyEditor(context);
  setForm(context, {
    ...form,
    caps: { ...form.caps, [asset]: { ...form.caps[asset], ...patch } },
  });
}

// One choice per recipient, so it is never both allowed and blocked.
export function setRecipientChoice(
  context: DraftContext,
  provider: ProviderId,
  choice: RecipientChoice,
): void {
  const { form } = getPolicyEditor(context);
  setForm(context, {
    ...form,
    recipients: { ...form.recipients, [provider]: choice },
  });
}

export function updatePolicyReview(
  context: DraftContext,
  patch: Partial<PolicyForm["review"]>,
): void {
  const { form } = getPolicyEditor(context);
  setForm(context, { ...form, review: { ...form.review, ...patch } });
}

export function clearPolicyForm(context: DraftContext): void {
  if (editors.delete(contextKey(context))) notify();
}

// Switching account or network cancels the previous context's draft.
export function switchPolicyContext(
  from: DraftContext,
  to: DraftContext,
): void {
  if (contextKey(from) !== contextKey(to)) clearPolicyForm(from);
}

// App lock, session logout and local wallet removal clear every draft.
export function clearAllPolicyForms(): void {
  if (editors.size === 0) return;
  editors.clear();
  notify();
}

export function subscribePolicyForms(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
