import {
  EvidenceBundleSchema,
  type EvidenceBundle,
} from "@mandate/schema";
import { readFile } from "node:fs/promises";

export async function loadBundle(input: string | object): Promise<EvidenceBundle> {
  let data: unknown;
  if (typeof input === "string") {
    // If it's a JSON string or file path
    if (input.trim().startsWith("{")) {
      data = JSON.parse(input);
    } else {
      const raw = await readFile(input, "utf-8");
      data = JSON.parse(raw);
    }
  } else {
    data = input;
  }

  return EvidenceBundleSchema.parse(data);
}
