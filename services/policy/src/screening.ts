import { readFile } from "node:fs/promises";
import { z } from "zod";
import { hashCanonical } from "@mandate/schema";

const ListSchema = z
  .object({
    listId: z.literal("demo-screening-v1"),
    note: z.string(),
    addresses: z.array(z.string().regex(/^0x[0-9a-f]{40}$/)),
  })
  .strict();

// Loads the screening list only if its canonical hash is the one the trusted
// manifest names; a mismatched list must not silently change decisions.
export async function loadScreening(
  path: string,
  expectedHash: string,
): Promise<ReadonlySet<string>> {
  const list = ListSchema.parse(JSON.parse(await readFile(path, "utf8")));
  if (hashCanonical(list) !== expectedHash.toLowerCase())
    throw new Error(
      "Screening list hash does not match the deployment manifest",
    );
  return new Set(list.addresses);
}
