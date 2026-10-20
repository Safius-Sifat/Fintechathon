import {
  createDecipheriv,
  pbkdf2Sync,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { getAddress, hexToBytes, keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

type KeystoreV3 = {
  version: 3;
  crypto: {
    cipher: "aes-128-ctr";
    ciphertext: string;
    cipherparams: { iv: string };
    kdf: "scrypt" | "pbkdf2";
    kdfparams: Record<string, number | string>;
    mac: string;
  };
};

// Owner-only files: a group/world-readable keystore or password is refused.
async function privateFile(path: string): Promise<Buffer> {
  const info = await stat(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0)
    throw new Error(
      "Signer files must be regular files readable only by their owner",
    );
  return readFile(path);
}

const bytes = (hex: string) =>
  Buffer.from(hexToBytes(("0x" + hex.replace(/^0x/, "")) as `0x${string}`));

function derive(keystore: KeystoreV3, password: string): Buffer {
  const p = keystore.crypto.kdfparams;
  const salt = bytes(String(p.salt));
  const dklen = Number(p.dklen);
  if (dklen !== 32) throw new Error("Unsupported keystore key length");
  if (keystore.crypto.kdf === "scrypt") {
    const N = Number(p.n);
    const r = Number(p.r);
    return scryptSync(password, salt, dklen, {
      N,
      r,
      p: Number(p.p),
      maxmem: 256 * N * r + 1024 * 1024,
    });
  }
  if (p.prf !== "hmac-sha256") throw new Error("Unsupported keystore PRF");
  return pbkdf2Sync(password, salt, Number(p.c), dklen, "sha256");
}

// Loads one lane signer. The private key never leaves this function except as
// a viem account; the expected address must match before the account is usable.
export async function loadKeystoreSigner(options: {
  keystoreFile: string;
  passwordFile: string;
  expectedAddress: Address;
}): Promise<PrivateKeyAccount> {
  const keystore = JSON.parse(
    (await privateFile(options.keystoreFile)).toString("utf8"),
  ) as KeystoreV3;
  if (
    keystore.version !== 3 ||
    keystore.crypto.cipher !== "aes-128-ctr" ||
    !["scrypt", "pbkdf2"].includes(keystore.crypto.kdf)
  )
    throw new Error("Unsupported keystore format");
  const password = (await privateFile(options.passwordFile))
    .toString("utf8")
    .replace(/\r?\n$/, "");
  const derived = derive(keystore, password);
  const ciphertext = bytes(keystore.crypto.ciphertext);
  const mac = bytes(
    keccak256(Buffer.concat([derived.subarray(16, 32), ciphertext])),
  );
  const expectedMac = bytes(keystore.crypto.mac);
  if (mac.length !== expectedMac.length || !timingSafeEqual(mac, expectedMac))
    throw new Error("Keystore password is incorrect or the file is corrupted");
  const decipher = createDecipheriv(
    "aes-128-ctr",
    derived.subarray(0, 16),
    bytes(keystore.crypto.cipherparams.iv),
  );
  const key = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const account = privateKeyToAccount(toHex(key));
  key.fill(0);
  derived.fill(0);
  if (getAddress(account.address) !== getAddress(options.expectedAddress))
    throw new Error("Keystore signer does not match the configured address");
  return account;
}
