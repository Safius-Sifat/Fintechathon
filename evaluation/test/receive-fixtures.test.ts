import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AddressSchema } from "@mandate/schema";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

test("receive fixtures: requests.json is valid and contains expected valid/invalid cases", async () => {
  const filePath = resolve(__dirname, "../../demo/wallet-requests/requests.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  assert.equal(data.schema, "mandate-payment-requests/1");
  assert.equal(data.chainId, 84532);
  assert.ok(Array.isArray(data.requests));
  assert.ok(data.requests.length >= 7, "Must contain all required valid and rejected scenarios");

  const validReqs = data.requests.filter((r: { valid: boolean }) => r.valid);
  const invalidReqs = data.requests.filter((r: { valid: boolean }) => !r.valid);

  assert.ok(validReqs.length >= 2, "Must contain at least valid ETH and valid DemoUSD");
  assert.ok(invalidReqs.length >= 5, "Must contain all standard error types");

  const expectedErrors = new Set([
    "ERC681_UNSUPPORTED_CHAIN",
    "ERC681_DUPLICATE_PARAM",
    "ERC681_UNKNOWN_FUNCTION",
    "ERC681_INVALID_AMOUNT",
    "ERC681_INVALID_ADDRESS",
  ]);

  for (const inv of invalidReqs) {
    assert.ok(expectedErrors.has(inv.error), `Unexpected error code: ${inv.error}`);
    expectedErrors.delete(inv.error);
  }
  assert.equal(expectedErrors.size, 0, "All required error scenarios must be present");
});

test("receive fixtures: wallet scenarios are defined with valid addresses", async () => {
  const filePath = resolve(__dirname, "../../demo/wallet-scenarios.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  assert.equal(data.schema, "mandate-wallet-scenarios/1");
  assert.equal(data.chainId, 84532);
  assert.ok(Array.isArray(data.scenarios));

  for (const s of data.scenarios) {
    assert.ok(s.id, "Scenario must have an ID");
    assert.ok(s.name, "Scenario must have a name");
    if (s.recipientAddress) {
      assert.doesNotThrow(() => AddressSchema.parse(s.recipientAddress));
    }
  }
});
