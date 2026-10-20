import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { recoverTypedDataAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildTypedData, hashCanonical, invoiceDomain } from "@mandate/schema";
import { registerProviderRoutes } from "../src/routes.js";

// Public Anvil test keys #2 and #3. Never real keys.
const KEY_A =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const KEY_B =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex;

async function app(keys: { a?: Hex; b?: Hex }) {
  const server = Fastify();
  await registerProviderRoutes(server, { keys });
  return server;
}

const body = (checks: string[]) => ({
  taskId: ("0x" + "aa".repeat(32)) as Hex,
  wallet: "0x7777777777777777777777777777777777777777",
  asset: "0x2222222222222222222222222222222222222222",
  targetId: "checkout-healthy",
  checks,
});

test("provider: lists providers and marks those without a key unavailable", async () => {
  const server = await app({ a: KEY_A });
  const json = (
    await server.inject({ method: "GET", url: "/providers" })
  ).json();
  assert.equal(json[0].available, true);
  assert.equal(json[0].recipient, privateKeyToAccount(KEY_A).address);
  assert.equal(json[1].available, false);
  assert.equal(json[1].recipient, null);
});

test("provider: without a signing key no quote is issued", async () => {
  const server = await app({});
  const res = await server.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: body(["pageLoad"]),
  });
  assert.equal(res.statusCode, 503);
});

test("provider: quotes are signed by the paid provider, short-lived and unique", async () => {
  const server = await app({ a: KEY_A, b: KEY_B });
  const res = await server.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: body(["pageLoad", "title"]),
  });
  assert.equal(res.statusCode, 402);
  const quote = res.json();
  assert.equal(quote.invoice.recipient, privateKeyToAccount(KEY_A).address);
  assert.equal(quote.invoice.amount, "200000");
  assert.equal(
    quote.invoice.inputHash,
    hashCanonical({
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title"],
    }),
  );
  assert.ok(
    Number(quote.invoice.expiresAt) - Number(quote.invoice.issuedAt) <= 60,
  );
  const signer = await recoverTypedDataAddress({
    ...(buildTypedData(
      "Invoice",
      quote.invoice,
      invoiceDomain(quote.invoice.wallet),
    ) as never),
    signature: quote.providerSignature,
  });
  assert.equal(signer, quote.invoice.recipient);
  const again = (
    await server.inject({
      method: "POST",
      url: "/providers/a/check",
      payload: body(["pageLoad", "title"]),
    })
  ).json();
  assert.notEqual(again.invoice.invoiceId, quote.invoice.invoiceId);
});

test("provider: A refuses formSubmit and B quotes it at 350000", async () => {
  const server = await app({ a: KEY_A, b: KEY_B });
  const a = await server.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: body(["formSubmit"]),
  });
  assert.equal(a.statusCode, 400);
  const b = await server.inject({
    method: "POST",
    url: "/providers/b/check",
    payload: body(["formSubmit"]),
  });
  assert.equal(b.statusCode, 402);
  assert.equal(b.json().invoice.amount, "350000");
});

test("provider: results are refused until payment checks and the browser runner exist", async () => {
  const server = await app({ a: KEY_A });
  const res = await server.inject({
    method: "POST",
    url: "/providers/a/result",
    payload: {
      invoiceId: ("0x" + "12".repeat(32)) as Hex,
      requestId: ("0x" + "34".repeat(32)) as Hex,
      paymentTxHash: ("0x" + "56".repeat(32)) as Hex,
    },
  });
  assert.equal(res.statusCode, 501);
});
