// In-memory wallet session. While unlocked it holds the HD seed so the phone
// can sign; locking drops it. Screens read the public state with useWallet()
// and never see the seed.
import { useSyncExternalStore } from "react";
import type { HDAccount } from "viem/accounts";
import { deriveAccount } from "./core";
import {
  clearLocal,
  readProfile,
  writeProfile,
  type AccountMeta,
  type Profile,
} from "./local";
import * as vault from "./vault";

export type WalletStatus = "loading" | "none" | "locked" | "unlocked";
export interface WalletState {
  status: WalletStatus;
  profile: Profile | null;
}

let state: WalletState = { status: "loading", profile: null };
let seed: Uint8Array | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<WalletState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useWallet(): WalletState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getWalletState = () => state;
export function subscribeWallet(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentAccount(): AccountMeta | null {
  const p = state.profile;
  return p ? (p.accounts.find((a) => a.index === p.current) ?? null) : null;
}

export async function loadWallet() {
  const exists = await vault.hasWallet();
  set({
    status: exists ? "locked" : "none",
    profile: exists ? await readProfile() : null,
  });
}

async function start(newSeed: Uint8Array, backupConfirmed: boolean) {
  seed = newSeed;
  const first = deriveAccount(newSeed, 0);
  const profile: Profile = {
    accounts: [{ index: 0, label: "Account 1", address: first.address }],
    current: 0,
    backupConfirmed,
  };
  await writeProfile(profile);
  set({ status: "unlocked", profile });
}

export async function createWallet(phrase: string, passphrase: string) {
  await vault.confirmOwner("Save your new wallet");
  await start(await vault.saveWallet(phrase, passphrase), true);
}

export async function restoreWallet(phrase: string, passphrase: string) {
  await vault.confirmOwner("Restore your wallet");
  await start(await vault.saveWallet(phrase, passphrase), true);
}

// When the owner last unlocked with Face ID, Touch ID or the passcode.
let unlockedAt = 0;
// How long after an unlock the service sign-in may reuse it.
const SIGN_IN_AFTER_UNLOCK_MS = 60_000;

export async function unlock() {
  seed = await vault.readSeed();
  unlockedAt = Date.now();
  set({ status: "unlocked" });
}

export function lock() {
  seed = null;
  unlockedAt = 0;
  if (state.status === "unlocked") set({ status: "locked" });
}

async function updateProfile(change: (p: Profile) => Profile) {
  if (!state.profile) return;
  const profile = change(state.profile);
  await writeProfile(profile);
  set({ profile });
}

export async function addAccount() {
  if (!seed) throw new vault.AuthError("Unlock the wallet first.");
  const p = state.profile!;
  const index = Math.max(...p.accounts.map((a) => a.index)) + 1;
  const account = deriveAccount(seed, index);
  await updateProfile((prev) => ({
    ...prev,
    accounts: [
      ...prev.accounts,
      { index, label: `Account ${index + 1}`, address: account.address },
    ],
    current: index,
  }));
}

export const switchAccount = (index: number) =>
  updateProfile((p) => ({ ...p, current: index }));

export const renameAccount = (index: number, label: string) =>
  updateProfile((p) => ({
    ...p,
    accounts: p.accounts.map((a) =>
      a.index === index
        ? { ...a, label: label.trim().slice(0, 64) || a.label }
        : a,
    ),
  }));

export async function removeWallet() {
  await vault.removeWallet();
  await clearLocal();
  seed = null;
  set({ status: "none", profile: null });
}

// Backup screen only: reads the words after the owner confirms.
export const readPhraseForBackup = () => vault.readPhrase();

export async function confirmBackup() {
  await updateProfile((p) => ({ ...p, backupConfirmed: true }));
}

// For the signer module only: confirms with the owner, then returns the
// current account's signer. Screens never call this.
export async function signerForCurrent(
  reason: string,
  // Only for the service sign-in: the unlock a moment ago already confirmed
  // the owner. Payments, permissions and limits always ask again.
  options: { reuseRecentUnlock?: boolean } = {},
): Promise<HDAccount> {
  const meta = currentAccount();
  if (!seed || !meta) throw new vault.AuthError("Unlock the wallet first.");
  const unlockedSeed = seed;
  if (
    !options.reuseRecentUnlock ||
    Date.now() - unlockedAt > SIGN_IN_AFTER_UNLOCK_MS
  )
    await vault.confirmOwner(reason);
  if (
    state.status !== "unlocked" ||
    seed !== unlockedSeed ||
    currentAccount()?.address !== meta.address
  )
    throw new vault.AuthError(
      "The wallet was locked or the account changed. Nothing was signed.",
    );
  return deriveAccount(unlockedSeed, meta.index);
}
