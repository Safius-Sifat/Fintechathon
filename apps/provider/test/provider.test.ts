import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerProviderRoutes } from "../src/routes.js";
import { ZERO_HASH } from "@mandate/schema";
import { type Hex } from "viem";

async function buildTestApp() {
  const app = Fastify();
  await registerProviderRoutes(app);
  return app;
}

test("provider: GET /providers lists both providers with correct capabilities", async () => {
  const app = await buildTestApp();
  const res = await app.inject({
    method: "GET",
    url: "/providers",
  });

  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.equal(json.length, 2);
  assert.equal(json[0].providerId, "a");
  assert.deepEqual(json[0].capabilities, ["pageLoad", "title"]);
  assert.equal(json[0].price, "200000");

  assert.equal(json[1].providerId, "b");
  assert.deepEqual(json[1].capabilities, ["pageLoad", "title", "formSubmit"]);
  assert.equal(json[1].price, "350000");
});

test("provider: POST /providers/a/check accepts pageLoad and rejects formSubmit", async () => {
  const app = await buildTestApp();

  const validBody = {
    taskId: ("0x" + "aa".repeat(32)) as Hex,
    wallet: "0x7777777777777777777777777777777777777777",
    asset: "0x2222222222222222222222222222222222222222",
    targetId: "checkout-healthy",
    checks: ["pageLoad", "title"],
  };

  const validRes = await app.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: validBody,
  });

  assert.equal(validRes.statusCode, 200);
  const quote = validRes.json();
  assert.equal(quote.providerId, "a");
  assert.equal(quote.invoice.amount, "200000");
  assert.equal(quote.invoice.recipient, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");

  // Invalid: asking provider 'a' for formSubmit
  const invalidBody = {
    ...validBody,
    checks: ["pageLoad", "title", "formSubmit"],
  };

  const invalidRes = await app.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: invalidBody,
  });

  assert.equal(invalidRes.statusCode, 400);
  assert.ok(invalidRes.json().error.includes("does not support requested check"));
});

test("provider: POST /providers/b/check accepts formSubmit at 350000", async () => {
  const app = await buildTestApp();

  const body = {
    taskId: ("0x" + "aa".repeat(32)) as Hex,
    wallet: "0x7777777777777777777777777777777777777777",
    asset: "0x2222222222222222222222222222222222222222",
    targetId: "checkout-healthy",
    checks: ["pageLoad", "title", "formSubmit"],
  };

  const res = await app.inject({
    method: "POST",
    url: "/providers/b/check",
    payload: body,
  });

  assert.equal(res.statusCode, 200);
  const quote = res.json();
  assert.equal(quote.providerId, "b");
  assert.equal(quote.invoice.amount, "350000");
  assert.equal(quote.invoice.recipient, "0x6666666666666666666666666666666666666666");
});

test("provider: POST /providers/a/result returns DeliveryEnvelope", async () => {
  const app = await buildTestApp();

  const body = {
    invoiceId: ("0x" + "11".repeat(32)) as Hex,
    requestId: ("0x" + "22".repeat(32)) as Hex,
    paymentTxHash: ("0x" + "33".repeat(32)) as Hex,
  };

  const res = await app.inject({
    method: "POST",
    url: "/providers/a/result",
    payload: body,
  });

  assert.equal(res.statusCode, 200);
  const delivery = res.json();
  assert.equal(delivery.receipt.invoiceId, body.invoiceId);
  assert.equal(delivery.receipt.paymentTxHash, body.paymentTxHash);
  assert.equal(delivery.result.targetId, "checkout-healthy");
  assert.equal(delivery.result.checks.pageLoad, true);
});
