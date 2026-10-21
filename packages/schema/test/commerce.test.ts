import test from "node:test";
import assert from "node:assert/strict";
import {
  ConditionsSchema,
  ProviderSchema,
  ShopProductSchema,
  hashCanonical,
} from "../src/index.js";

const browser = {
  schemaVersion: 4,
  runbookId: "browser-check",
  browser: {
    targetId: "checkout-healthy",
    checks: ["pageLoad"],
    providerIds: ["a", "b"],
    maxPaidAttempts: 3,
    maxSteps: 8,
    taskDeadline: "1800000000",
    resultMaxAgeSeconds: 300,
  },
  liquidity: null,
  schedule: null,
  allowance: null,
  calls: null,
} as const;

const commerce = {
  schemaVersion: 4,
  runbookId: "commerce-buy",
  browser: null,
  liquidity: null,
  schedule: null,
  allowance: null,
  calls: null,
  commerce: {
    providerId: "shop",
    productId: "aero-runner",
    size: "42",
    maxAmount: "450000",
    deliveryHash: "0x" + "ab".repeat(32),
    taskDeadline: "1800000000",
  },
} as const;

test("commerce: other runbooks' conditions parse and hash exactly as before", () => {
  const parsed = ConditionsSchema.parse(browser);
  assert.equal("commerce" in parsed, false);
  assert.equal(hashCanonical(parsed), hashCanonical(browser));
});

test("commerce: an order needs exactly the commerce branch", () => {
  assert.ok(ConditionsSchema.safeParse(commerce).success);
  assert.equal(
    ConditionsSchema.safeParse({ ...commerce, commerce: undefined }).success,
    false,
  );
  assert.equal(
    ConditionsSchema.safeParse({ ...browser, commerce: commerce.commerce })
      .success,
    false,
  );
});

test("commerce: only the shop offers orders, and prices stay within the 0.50 ceiling", () => {
  const recipient = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  assert.ok(
    ProviderSchema.safeParse({
      providerId: "shop",
      recipient,
      capabilities: ["order"],
    }).success,
  );
  assert.equal(
    ProviderSchema.safeParse({
      providerId: "a",
      recipient,
      capabilities: ["order"],
    }).success,
    false,
  );
  assert.equal(
    ProviderSchema.safeParse({
      providerId: "shop",
      recipient,
      capabilities: ["pageLoad"],
    }).success,
    false,
  );
  const product = {
    productId: "aero-runner",
    name: "Aero Runner",
    brand: "Mandate Test",
    category: "running",
    colors: ["blue"],
    sizes: ["41", "42"],
    price: "450000",
    description: "Sample product.",
    image: "/shop/images/aero-runner.svg",
  };
  assert.ok(ShopProductSchema.safeParse(product).success);
  assert.equal(
    ShopProductSchema.safeParse({ ...product, price: "500001" }).success,
    false,
  );
});
