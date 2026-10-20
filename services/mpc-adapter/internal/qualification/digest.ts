import { readFileSync, writeFileSync } from "node:fs";
import { hashDigest } from "../../../../packages/schema/src/hashing.js";

// Only the checked-in public fixture is accepted. Production uses independently
// loaded immutable financial records and the shared schema's validation.
const fixture: unknown = JSON.parse(
  readFileSync(
    new URL(
      "../../../../packages/schema/fixtures/action-v7.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
if (
  typeof fixture !== "object" ||
  fixture === null ||
  !("valid" in fixture) ||
  !Array.isArray(fixture.valid)
) {
  throw new Error("Invalid shared fixture");
}
const vectors = fixture.valid.map((entry: unknown) => {
  if (
    typeof entry !== "object" ||
    entry === null ||
    !("id" in entry) ||
    typeof entry.id !== "string" ||
    !("digest" in entry) ||
    typeof entry.digest !== "string" ||
    !("message" in entry) ||
    !("domain" in entry)
  ) {
    throw new Error("Invalid Action vector");
  }
  const digest = hashDigest("Action", entry.message, entry.domain);
  if (digest !== entry.digest) throw new Error("Shared Action digest mismatch");
  return { id: entry.id, digest, expectedDigest: entry.digest };
});
const output = process.env.MPC_DIGEST_OUTPUT;
if (!output) throw new Error("MPC_DIGEST_OUTPUT required");
writeFileSync(output, JSON.stringify(vectors));
