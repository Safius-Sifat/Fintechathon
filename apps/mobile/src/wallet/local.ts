// Non-secret data kept on this phone: account names, contacts, and the
// transactions this phone sent. Never holds phrases, seeds or keys.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Address, Hash } from "viem";

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
const write = (key: string, value: unknown) =>
  AsyncStorage.setItem(key, JSON.stringify(value));

export interface AccountMeta {
  index: number;
  label: string;
  address: Address;
}
export interface Profile {
  accounts: AccountMeta[];
  current: number;
  backupConfirmed: boolean;
}
const PROFILE = "mandate.profile.v1";
export const readProfile = () => read<Profile | null>(PROFILE, null);
export const writeProfile = (p: Profile) => write(PROFILE, p);

export interface Contact {
  name: string;
  address: Address;
}
const CONTACTS = "mandate.contacts.v1";
export const readContacts = () => read<Contact[]>(CONTACTS, []);
export const writeContacts = (c: Contact[]) => write(CONTACTS, c);

export interface SentTx {
  hash: Hash;
  from: Address;
  to: Address;
  symbol: string;
  amount: string;
  kind: "send" | "admin" | "owner";
  label: string;
  createdAt: number;
}
const SENT = "mandate.sent.v1";
export const readSent = () => read<SentTx[]>(SENT, []);
export async function addSent(tx: SentTx) {
  const all = await readSent();
  await write(SENT, [tx, ...all].slice(0, 200));
}

// The allow and block lists this phone last signed for an agent wallet. The
// chain stores them as lookups only, so this is how the editor shows them.
export interface SignedLists {
  version: string;
  allowlist: Address[];
  blocklist: Address[];
}
const listsKey = (wallet: Address) => `mandate.policy.${wallet.toLowerCase()}`;
export const readSignedLists = (wallet: Address) =>
  read<SignedLists | null>(listsKey(wallet), null);
export const writeSignedLists = (wallet: Address, l: SignedLists) =>
  write(listsKey(wallet), l);

export async function clearLocal() {
  await AsyncStorage.multiRemove([PROFILE, CONTACTS, SENT]);
}
