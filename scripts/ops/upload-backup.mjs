import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { managedToken } from "./vm-identity.mjs";
const path = process.argv[2];
try {
  if (!path || !/^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{40}\.dump$/.test(basename(path)))
    throw Error("BACKUP_NAME_INVALID");
  const size = (await stat(path)).size;
  if (size < 1) throw Error("BACKUP_EMPTY");
  const token = await managedToken("https://storage.azure.com/");
  const url =
    "https://mandatebackup04323111.blob.core.windows.net/dbbackups/postgres/" +
    basename(path);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "x-ms-version": "2023-11-03",
      "x-ms-blob-type": "BlockBlob",
      "Content-Length": String(size),
      "If-None-Match": "*",
    },
    body: createReadStream(path),
    duplex: "half",
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  if (response.status !== 201) throw Error("BACKUP_UPLOAD_FAILED");
  console.log("Encrypted Azure Blob backup stored: " + basename(path));
} catch {
  console.error("Off-VM backup failed; deployment stopped");
  process.exitCode = 1;
}
