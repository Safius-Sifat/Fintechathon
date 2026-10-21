import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import {
  BASE_SEPOLIA_USDC,
  QuoteEnvelopeSchema,
  x402Signature,
  type QuoteEnvelope,
} from "@mandate/schema";
import { registerProviderRoutes } from "../src/routes.js";
import { InvoiceStore } from "../src/store.js";
import type { ChainReader } from "../src/payment.js";
import { checkSettlement, type FacilitatorClient } from "../src/x402.js";

// Public Anvil test key #2. Never a real key.
const KEY_A =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const PAYEE = privateKeyToAccount(KEY_A).address;
const WALLET = "0x7777777777777777777777777777777777777777" as const;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const PERMIT = ("0x" + "56".repeat(32)) as Hex;
const SETTLE_TX = ("0x" + "78".repeat(32)) as Hex;
const TOKEN = "worker-token-for-tests";

const usedAbi = parseAbi([
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);

function settlementLogs(amount: bigint, nonce: Hex = REQUEST) {
  return [
    {
      address: BASE_SEPOLIA_USDC,
      topics: encodeEventTopics({
        abi: usedAbi,
        eventName: "AuthorizationUsed",
        args: { authorizer: WALLET, nonce },
      }) as Hex[],
      data: "0x" as Hex,
    },
    {
      address: BASE_SEPOLIA_USDC,
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: WALLET, to: PAYEE },
      }) as Hex[],
      data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    },
  ];
}

function chain(
  logs: ReturnType<typeof settlementLogs>,
  depth = 3n,
): ChainReader {
  return {
    async getTransactionReceipt() {
      return { status: "success", blockNumber: 100n, logs };
    },
    async getBlockNumber() {
      return 100n + depth - 1n;
    },
  };
}

function facilitator(opts: { valid?: boolean } = {}) {
  const calls = { verify: 0, settle: 0 };
  const client = {
    async verify() {
      calls.verify++;
      return opts.valid === false
        ? { isValid: false, invalidReason: "invalid_signature" }
        : { isValid: true, payer: WALLET };
    },
    async settle() {
      calls.settle++;
      return {
        success: true,
        transaction: SETTLE_TX,
        network: "eip155:84532",
        payer: WALLET,
      };
    },
    async getSupported() {
      return { kinds: [], extensions: [], signers: {} };
    },
  } as unknown as FacilitatorClient;
  return { client, calls };
}

async function app(opts: {
  facilitator?: FacilitatorClient;
  chain?: ChainReader;
}) {
  const server = Fastify();
  const dir = await mkdtemp(join(tmpdir(), "provider-x402-"));
  await registerProviderRoutes(server, {
    keys: { a: KEY_A },
    store: new InvoiceStore(dir),
    chain: opts.chain,
    browser: { targetOrigin: "https://127.0.0.1:1", channel: "chrome" },
    workerToken: TOKEN,
    facilitator: opts.facilitator,
    publicUrl: "https://provider.test",
  });
  return server;
}

async function quote(server: Awaited<ReturnType<typeof app>>, asset: string) {
  const res = await server.inject({
    method: "POST",
    url: "/providers/a/check",
    payload: {
      taskId: ("0x" + "aa".repeat(32)) as Hex,
      wallet: WALLET,
      asset,
      targetId: "checkout-healthy",
      checks: ["pageLoad"],
    },
  });
  assert.equal(res.statusCode, 402);
  return { res, quote: QuoteEnvelopeSchema.parse(res.json()) };
}

function payment(
  q: QuoteEnvelope,
  overrides: Partial<Record<string, string>> = {},
) {
  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: q.x402!.network,
      asset: q.x402!.asset,
      amount: q.x402!.amount,
      payTo: q.x402!.payTo,
      maxTimeoutSeconds: q.x402!.maxTimeoutSeconds,
      extra: { ...q.x402!.extra },
    },
    payload: {
      authorization: {
        from: WALLET,
        to: q.invoice.recipient,
        value: q.invoice.amount,
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 60),
        nonce: REQUEST,
        ...overrides,
      },
      signature: x402Signature(REQUEST, PERMIT),
    },
  };
  return encodePaymentSignatureHeader(payload);
}

const pay = (
  server: Awaited<ReturnType<typeof app>>,
  q: QuoteEnvelope,
  header: string,
) =>
  server.inject({
    method: "POST",
    url: "/providers/a/result",
    headers: { authorization: `Bearer ${TOKEN}`, "payment-signature": header },
    payload: { invoiceId: q.invoice.invoiceId, requestId: REQUEST },
  });

test("x402: a USDC quote carries the signed invoice in x402 terms and the PAYMENT-REQUIRED header", async () => {
  const server = await app({});
  const { res, quote: q } = await quote(server, BASE_SEPOLIA_USDC);
  assert.ok(q.x402);
  assert.equal(q.x402.payTo, PAYEE);
  assert.equal(q.x402.amount, q.invoice.amount);
  assert.equal(q.x402.extra.mandateInvoice.invoiceId, q.invoice.invoiceId);
  const required = decodePaymentRequiredHeader(
    res.headers["payment-required"] as string,
  );
  assert.equal(required.x402Version, 2);
  assert.equal(required.accepts[0]!.payTo, PAYEE);
  assert.equal(
    required.resource.url,
    "https://provider.test/providers/a/result",
  );
});

test("x402: a quote in another token offers no x402 terms", async () => {
  const server = await app({});
  const { res, quote: q } = await quote(
    server,
    "0xE030717a657E9194bC086A546fb59aDBc631ad7a",
  );
  assert.equal(q.x402, null);
  assert.equal(res.headers["payment-required"], undefined);
});

test("x402: without a facilitator no payment is taken", async () => {
  const server = await app({ chain: chain(settlementLogs(0n)) });
  const { quote: q } = await quote(server, BASE_SEPOLIA_USDC);
  const res = await pay(server, q, payment(q));
  assert.equal(res.statusCode, 503);
});

test("x402: a payment that does not match the invoice is refused before the facilitator", async () => {
  const f = facilitator();
  const server = await app({
    facilitator: f.client,
    chain: chain(settlementLogs(0n)),
  });
  const { quote: q } = await quote(server, BASE_SEPOLIA_USDC);
  for (const bad of [
    { value: "1" },
    { to: WALLET },
    { nonce: "0x" + "99".repeat(32) },
  ]) {
    const res = await pay(server, q, payment(q, bad));
    assert.equal(res.statusCode, 402, JSON.stringify(bad));
  }
  assert.equal(f.calls.verify, 0);
  assert.equal(f.calls.settle, 0);
});

test("x402: a facilitator refusal is reported and nothing settles", async () => {
  const f = facilitator({ valid: false });
  const server = await app({
    facilitator: f.client,
    chain: chain(settlementLogs(0n)),
  });
  const { quote: q } = await quote(server, BASE_SEPOLIA_USDC);
  const res = await pay(server, q, payment(q));
  assert.equal(res.statusCode, 402);
  assert.match(res.json().error, /invalid_signature/);
  assert.equal(f.calls.settle, 0);
});

test("x402: settlement happens once, and a retry waits for confirmations without settling again", async () => {
  const f = facilitator();
  const shallow = await app({
    facilitator: f.client,
    chain: chain(settlementLogs(200000n), 1n),
  });
  const { quote: q2 } = await quote(shallow, BASE_SEPOLIA_USDC);
  const first = await pay(shallow, q2, payment(q2));
  assert.equal(first.statusCode, 202);
  assert.equal(first.json().settlementTxHash, SETTLE_TX);
  const second = await pay(shallow, q2, payment(q2));
  assert.equal(second.statusCode, 202);
  assert.equal(f.calls.settle, 1);
});

test("x402: a settlement counts only with the transfer and the consumed nonce", async () => {
  const invoice = {
    invoiceId: ("0x" + "12".repeat(32)) as Hex,
    taskId: ("0x" + "aa".repeat(32)) as Hex,
    wallet: WALLET,
    asset: BASE_SEPOLIA_USDC,
    recipient: PAYEE,
    amount: "200000",
    inputHash: ("0x" + "0b".repeat(32)) as Hex,
    issuedAt: "0",
    expiresAt: "60",
  };
  assert.equal(
    (
      await checkSettlement(
        chain(settlementLogs(200000n)),
        invoice,
        REQUEST,
        SETTLE_TX,
      )
    ).state,
    "PAID",
  );
  assert.equal(
    (
      await checkSettlement(
        chain(settlementLogs(1n)),
        invoice,
        REQUEST,
        SETTLE_TX,
      )
    ).state,
    "INVALID",
  );
  assert.equal(
    (
      await checkSettlement(
        chain(settlementLogs(200000n, ("0x" + "99".repeat(32)) as Hex)),
        invoice,
        REQUEST,
        SETTLE_TX,
      )
    ).state,
    "INVALID",
  );
});
