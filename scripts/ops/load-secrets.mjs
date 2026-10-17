// Run only on the app VM, with its managed identity. No GitHub/Azure client secret.
import { readFile, chmod } from "node:fs/promises";
import { managedToken } from "./vm-identity.mjs";
import {
  materializeSecrets,
  validateSecretMap,
  assertPublicCertificates,
} from "./secrets.mjs";

try {
  const map = validateSecretMap(
    JSON.parse(
      await readFile("/opt/mandate/private/key-vault-map.json", "utf8"),
    ),
  );
  const allowed = new Set([
    "runtime.env",
    "migration.env",
    "backup.env",
    "deploy.env",
    "deployer-password",
    "db-ca.crt",
    "backup.pgpass",
  ]);
  if (map.entries.some((x) => !allowed.has(x.file)))
    throw Error("PRIVATE_FILE_NOT_ALLOWED");
  const caId = map.entries.find(
    (entry) => entry.file === "db-ca.crt",
  )?.secretId;
  const token = await managedToken("https://vault.azure.net");
  await materializeSecrets(map, {
    directory: "/opt/mandate/private",
    readSecret: async (secretId) => {
      const response = await fetch(secretId + "?api-version=7.4", {
        headers: { Authorization: "Bearer " + token },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("SECRET_READ_FAILED");
      const value = (await response.json()).value;
      if (typeof value !== "string") throw Error("SECRET_VALUE_INVALID");
      if (secretId === caId) assertPublicCertificates(value);
      return value;
    },
  });
  if (caId) await chmod("/opt/mandate/private/db-ca.crt", 0o644); // Certificates are public; credentials remain0600.
  console.log("App secret files refreshed");
} catch {
  console.error("App secret refresh failed; deployment stopped");
  process.exitCode = 1;
}
