// The only file that reads or writes wallet secrets. The phrase and the seed
// live in the platform keychain (expo-secure-store) and are read only after
// the owner passes Face ID, Touch ID or the device passcode. Nothing here is
// logged, sent to the network or written to AsyncStorage.
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { bytesToHex, hexToBytes, type Hex } from "viem";
import { phraseToSeed } from "./core";

const PHRASE_KEY = "mandate.phrase.v1";
const SEED_KEY = "mandate.seed.v1";
const DEVICE_KEY = "mandate.device.v1";
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class AuthError extends Error {}

// Asks for Face ID, Touch ID or the device passcode. Fails explicitly when
// the phone has no screen lock, because the wallet would be unprotected.
export async function confirmOwner(reason: string): Promise<void> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE)
    throw new AuthError(
      "Set a screen lock on this phone first. Mandate needs it to protect your wallet.",
    );
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
  });
  if (!result.success) throw new AuthError("Not confirmed. Nothing was done.");
}

export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SEED_KEY, options)) !== null;
}

// Saves a checked phrase. The passphrase is folded into the seed and is not
// stored on its own.
export async function saveWallet(phrase: string, passphrase: string) {
  const seed = phraseToSeed(phrase, passphrase);
  await SecureStore.setItemAsync(PHRASE_KEY, phrase, options);
  await SecureStore.setItemAsync(SEED_KEY, bytesToHex(seed), options);
  return seed;
}

export async function readSeed(): Promise<Uint8Array> {
  await confirmOwner("Unlock Mandate");
  const hex = await SecureStore.getItemAsync(SEED_KEY, options);
  if (!hex) throw new AuthError("No wallet on this phone.");
  return hexToBytes(hex as Hex);
}

export async function readPhrase(): Promise<string> {
  await confirmOwner("Show your recovery phrase");
  const phrase = await SecureStore.getItemAsync(PHRASE_KEY, options);
  if (!phrase) throw new AuthError("No wallet on this phone.");
  return phrase;
}

// Removes the wallet from this phone only. Funds and agent permissions stay
// on the chain.
export async function removeWallet() {
  await confirmOwner("Remove the wallet from this phone");
  await SecureStore.deleteItemAsync(PHRASE_KEY, options);
  await SecureStore.deleteItemAsync(SEED_KEY, options);
}

// A random per-install id for signed login. Not a secret.
export async function deviceId(): Promise<Hex> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY, options);
  if (existing) return existing as Hex;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const id = bytesToHex(bytes);
  await SecureStore.setItemAsync(DEVICE_KEY, id, options);
  return id;
}
