// In-memory store for the Send form. It lives outside the screens so a draft
// survives the navigation remount that follows a system font-size change,
// and Send -> Review -> Edit. It is never written to disk.
//
// Drafts are keyed by account and network: a draft belongs to exactly one
// context and is never shown in another. It holds only public form input
// (recipient text, amount text and two choices). Recovery words,
// credentials, keys, signatures and native security state never go here.
//
// Pure TypeScript with no React Native imports, so Node tests can load it.

import type { TransferAsset, TransferSource } from "../config/transfer";

export interface SendDraft {
  source: TransferSource;
  asset: TransferAsset;
  recipient: string;
  amount: string;
}

export interface DraftContext {
  // null while no account exists on this phone.
  accountId: string | null;
  chainId: number;
}

export const EMPTY_DRAFT: SendDraft = Object.freeze({
  source: "personal",
  asset: "ETH",
  recipient: "",
  amount: "",
});

type Listener = () => void;

const drafts = new Map<string, SendDraft>();
const listeners = new Set<Listener>();

export function contextKey({ accountId, chainId }: DraftContext): string {
  return `${accountId ?? "no-account"}@${chainId}`;
}

function notify() {
  for (const listener of listeners) listener();
}

// Returns the same object until the draft changes, as useSyncExternalStore
// requires.
export function getDraft(context: DraftContext): SendDraft {
  return drafts.get(contextKey(context)) ?? EMPTY_DRAFT;
}

export function updateDraft(
  context: DraftContext,
  patch: Partial<SendDraft>,
): void {
  const key = contextKey(context);
  drafts.set(key, { ...(drafts.get(key) ?? EMPTY_DRAFT), ...patch });
  notify();
}

export function isDraftComplete(draft: SendDraft): boolean {
  return draft.recipient.trim() !== "" && draft.amount.trim() !== "";
}

// Cancelling the form discards its draft (plan S8.2: local cancellation
// before signing discards the draft).
export function clearDraft(context: DraftContext): void {
  if (drafts.delete(contextKey(context))) notify();
}

// Switching account or network cancels the previous context's draft
// (plan P3-W01: switching accounts cancels the old draft and context).
export function switchContext(from: DraftContext, to: DraftContext): void {
  if (contextKey(from) !== contextKey(to)) clearDraft(from);
}

// App lock, session logout and local wallet removal clear every draft.
export function clearAllDrafts(): void {
  if (drafts.size === 0) return;
  drafts.clear();
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
