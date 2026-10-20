// Pure wallet logic with no React Native imports, so Node tests can load it.
// Holds no state: callers pass seeds in and get accounts or typed data out.
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import {
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { HDKey, hdKeyToAccount, type HDAccount } from "viem/accounts";
import { CHAIN_ID, MAX_ACCOUNT_INDEX } from "./config";

export function newPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

// Lower-case, single spaces. Returns null when the words are not a valid
// English BIP39 phrase of 12 or 24 words.
export function normalizePhrase(input: string): string | null {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) return null;
  const phrase = words.join(" ");
  return validateMnemonic(phrase, wordlist) ? phrase : null;
}

export function phraseToSeed(phrase: string, passphrase = ""): Uint8Array {
  return mnemonicToSeedSync(phrase, passphrase);
}

export function deriveAccount(seed: Uint8Array, index: number): HDAccount {
  if (!Number.isInteger(index) || index < 0 || index > MAX_ACCOUNT_INDEX)
    throw new Error("Account index must be 0..19");
  return hdKeyToAccount(HDKey.fromMasterSeed(seed), { addressIndex: index });
}

// Three distinct word positions (0-based) for the backup quiz.
export function quizPositions(count: number, random = Math.random): number[] {
  const picks = new Set<number>();
  while (picks.size < 3) picks.add(Math.floor(random() * count));
  return [...picks].sort((a, b) => a - b);
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkAddress(text: string): Checked<Address> {
  const t = text.trim();
  if (!t) return { ok: false, error: "Enter an address." };
  if (!isAddress(t, { strict: false }))
    return { ok: false, error: "This is not an Ethereum address." };
  // Mixed case must match the checksum; all-lower or all-upper has none.
  const hasCase =
    t.slice(2) !== t.slice(2).toLowerCase() &&
    t.slice(2) !== t.slice(2).toUpperCase();
  if (hasCase && !isAddress(t, { strict: true }))
    return {
      ok: false,
      error: "The address checksum is wrong. Check for a typo.",
    };
  if (t.toLowerCase() === zeroAddress)
    return { ok: false, error: "The zero address cannot receive funds." };
  return { ok: true, value: getAddress(t) };
}

export function checkAmount(text: string, decimals: number): Checked<bigint> {
  const t = text.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".")
    return { ok: false, error: "Enter an amount." };
  const [, frac = ""] = t.split(".");
  if (frac.length > decimals)
    return { ok: false, error: `At most ${decimals} decimal places.` };
  const value = parseUnits(t, decimals);
  if (value <= 0n) return { ok: false, error: "Enter an amount above zero." };
  return { ok: true, value };
}

// EIP-712 definitions. They must match packages/schema (checked by tests).
export const ADMIN_TYPES = {
  Admin: [
    { name: "command", type: "uint8" },
    { name: "permitId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export const LOGIN_TYPES = {
  Login: [
    { name: "origin", type: "string" },
    { name: "nonce", type: "bytes32" },
    { name: "deviceId", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const walletDomain = (wallet: Address) =>
  ({
    name: "MandateWallet",
    version: "5",
    chainId: CHAIN_ID,
    verifyingContract: wallet,
  }) as const;

export const loginDomain = {
  name: "MandateLogin",
  version: "2",
  chainId: CHAIN_ID,
  verifyingContract: zeroAddress,
} as const;

// Only these owner commands are offered from the phone. REVOKE needs a
// specific permit and comes with the task screens.
export const ADMIN_COMMANDS = {
  PAUSE: 0,
  UNPAUSE: 1,
  FREEZE: 5,
  UNFREEZE: 6,
} as const;
export type AdminCommandName = keyof typeof ADMIN_COMMANDS;
export const MAX_ADMIN_SECONDS = 1800n;

const ZERO32 = `0x${"00".repeat(32)}` as Hex;

export interface AdminMessage {
  command: number;
  permitId: Hex;
  nonce: bigint;
  issuedAt: bigint;
  deadline: bigint;
}

export function buildAdmin(
  command: AdminCommandName,
  nonce: bigint,
  nowSeconds: bigint,
): AdminMessage {
  return {
    command: ADMIN_COMMANDS[command],
    permitId: ZERO32,
    nonce,
    issuedAt: nowSeconds,
    deadline: nowSeconds + MAX_ADMIN_SECONDS,
  };
}

export interface LoginTypedData {
  domain: Record<string, unknown>;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

// Checks a server-provided Login request before the phone signs it. Anything
// other than an exact MandateLogin v2 for this origin and device is refused.
export function checkLoginRequest(
  data: LoginTypedData,
  expected: { origin: string; deviceId: Hex; nowSeconds: bigint },
): Checked<{
  origin: string;
  nonce: Hex;
  deviceId: Hex;
  issuedAt: bigint;
  expiresAt: bigint;
}> {
  const d = data.domain;
  if (
    d.name !== loginDomain.name ||
    d.version !== loginDomain.version ||
    Number(d.chainId) !== CHAIN_ID ||
    String(d.verifyingContract).toLowerCase() !== zeroAddress
  )
    return { ok: false, error: "The sign-in request has the wrong domain." };
  if (data.primaryType !== "Login")
    return { ok: false, error: "This is not a sign-in request." };
  const fields = (data.types.Login ?? []).map((f) => `${f.name}:${f.type}`);
  const want = LOGIN_TYPES.Login.map((f) => `${f.name}:${f.type}`);
  if (fields.join() !== want.join())
    return { ok: false, error: "The sign-in request has unexpected fields." };
  const m = data.message;
  if (m.origin !== expected.origin)
    return { ok: false, error: "The sign-in request is for another site." };
  if (String(m.deviceId).toLowerCase() !== expected.deviceId.toLowerCase())
    return { ok: false, error: "The sign-in request is for another device." };
  const issuedAt = BigInt(String(m.issuedAt));
  const expiresAt = BigInt(String(m.expiresAt));
  if (expiresAt <= issuedAt || expiresAt - issuedAt > 300n)
    return { ok: false, error: "The sign-in request lasts too long." };
  if (expected.nowSeconds > expiresAt || issuedAt > expected.nowSeconds + 60n)
    return { ok: false, error: "The sign-in request has expired." };
  return {
    ok: true,
    value: {
      origin: String(m.origin),
      nonce: m.nonce as Hex,
      deviceId: m.deviceId as Hex,
      issuedAt,
      expiresAt,
    },
  };
}

// Reads a scanned code: a plain address or an EIP-681 "ethereum:" link. A
// link for another chain is reported, never silently accepted.
export function parseScan(
  text: string,
): { address: Address; wrongChain: boolean } | null {
  const t = text.trim();
  const m = /^(?:ethereum:)?(0x[0-9a-fA-F]{40})(?:@(\d+))?/.exec(t);
  if (!m) return null;
  const checked = checkAddress(m[1]!);
  if (!checked.ok) return null;
  return {
    address: checked.value,
    wrongChain: m[2] !== undefined && Number(m[2]) !== CHAIN_ID,
  };
}
