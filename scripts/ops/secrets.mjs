import {
  mkdir,
  open,
  rename,
  lstat,
  realpath,
  rm,
  chmod,
} from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { randomUUID, X509Certificate } from "node:crypto";
export function validateSecretMap(input) {
  if (
    !input ||
    Object.keys(input).sort().join() !== "entries,schemaVersion" ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.entries) ||
    !input.entries.length
  )
    throw Error("SECRET_MAP_INVALID");
  const names = new Set();
  for (const x of input.entries) {
    if (
      !x ||
      Object.keys(x).sort().join() !== "file,secretId" ||
      !/^[-a-z0-9_.]{1,64}$/.test(x.file) ||
      x.file !== basename(x.file) ||
      x.file === "." ||
      x.file === ".." ||
      names.has(x.file)
    )
      throw Error("SECRET_TARGET_INVALID");
    if (
      !/^https:\/\/[a-z0-9-]{3,24}\.vault\.azure\.net\/secrets\/[A-Za-z0-9-]{1,127}\/[a-f0-9]{32}$/.test(
        x.secretId,
      )
    )
      throw Error("VERSIONED_KEY_VAULT_SECRET_REQUIRED");
    names.add(x.file);
  }
  return input;
}
export async function materializeSecrets(input, { directory, readSecret }) {
  const map = validateSecretMap(input);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink())
    throw Error("SECRET_DIRECTORY_SYMLINK");
  directory = await realpath(directory);
  await chmod(directory, 0o700);
  const entries = []; // Fetch all before replacing any file. Rotation still needs a coordinated service release.
  for (const item of map.entries) {
    const value = await readSecret(item.secretId);
    if (typeof value !== "string" || !value.length)
      throw Error("SECRET_VALUE_UNAVAILABLE");
    entries.push({ ...item, value });
  }
  for (const item of entries) {
    const target = join(directory, item.file);
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink())
        throw Error("SECRET_TARGET_NOT_REGULAR");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const temp = join(directory, "." + randomUUID());
    let file;
    try {
      file = await open(temp, "wx", 0o600);
      await file.writeFile(item.value, "utf8");
      await file.sync();
      await file.close();
      file = null;
      await rename(temp, target);
    } finally {
      await file?.close();
      await rm(temp, { force: true });
    }
  }
  return { files: entries.map((x) => x.file), count: entries.length }; // No secret values or hashes in logs.
}

export function assertPublicCertificates(value) {
  if (typeof value !== "string") throw Error("PUBLIC_CERTIFICATE_REQUIRED");
  const pattern =
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const certificates = value.match(pattern);
  if (!certificates?.length || value.replace(pattern, "").trim())
    throw Error("PUBLIC_CERTIFICATE_REQUIRED");
  try {
    for (const certificate of certificates) new X509Certificate(certificate);
  } catch {
    throw Error("PUBLIC_CERTIFICATE_INVALID");
  }
  return value;
}
