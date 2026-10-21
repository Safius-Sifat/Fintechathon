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
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import {
  BASE_SEPOLIA_USDC,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  OrderDeliverySchema,
  QuoteEnvelopeSchema,
  x402Signature,
  type QuoteEnvelope,
} from "@mandate/schema";
import { RecordStore } from "../src/store.js";
import { registerShopRoutes, type OrderRecord } from "../src/shop/routes.js";
import { CATALOG, searchCatalog } from "../src/shop/catalog.js";
import type { ChainReader } from "../src/payment.js";
import type { FacilitatorClient } from "../src/x402.js";

// Public Anvil test key #4. Never a real key.
const SHOP_KEY =
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as Hex;
const SHOP = privateKeyToAccount(SHOP_KEY).address;
const WALLET = "0x7777777777777777777777777777777777777777" as const;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const PERMIT = ("0x" + "56".repeat(32)) as Hex;
const SETTLE_TX = ("0x" + "78".repeat(32)) as Hex;
const DELIVERY = ("0x" + "ab".repeat(32)) as Hex;
const TOKEN = "worker-token-for-tests";

const usedAbi = parseAbi([
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);
const settledChain = (amount: bigint): ChainReader => ({
  async getTransactionReceipt() {
    return {
      status: "success",
      blockNumber: 100n,
      logs: [
        {
          address: BASE_SEPOLIA_USDC,
          topics: encodeEventTopics({
            abi: usedAbi,
            eventName: "AuthorizationUsed",
            args: { authorizer: WALLET, nonce: REQUEST },
          }) as Hex[],
          data: "0x",
        },
        {
          address: BASE_SEPOLIA_USDC,
          topics: encodeEventTopics({
            abi: erc20Abi,
            eventName: "Transfer",
            args: { from: WALLET, to: SHOP },
          }) as Hex[],
          data: encodeAbiParameters([{ type: "uint256" }], [amount]),
        },
      ],
    };
  },
  async getBlockNumber() {
    return 102n;
  },
});

function facilitator() {
  const calls = { settle: 0 };
  const client = {
    async verify() {
      return { isValid: true, payer: WALLET };
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

async function shop(
  opts: {
    key?: Hex;
    chain?: ChainReader;
    facilitator?: FacilitatorClient;
  } = {},
) {
  const app = Fastify();
  const dir = await mkdtemp(join(tmpdir(), "shop-"));
  await registerShopRoutes(app, {
    key: "key" in opts ? opts.key : SHOP_KEY,
    store: new RecordStore<OrderRecord>(dir),
    chain: opts.chain,
    facilitator: opts.facilitator,
    workerToken: TOKEN,
    publicUrl: "https://provider.test",
  });
  return app;
}

const order = (overrides: Record<string, unknown> = {}) => ({
  taskId: ("0x" + "aa".repeat(32)) as Hex,
  wallet: WALLET,
  asset: BASE_SEPOLIA_USDC,
  productId: "aero-runner",
  size: "42",
  deliveryHash: DELIVERY,
  ...overrides,
});

function pay(q: QuoteEnvelope) {
  return encodePaymentSignatureHeader({
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
      },
      signature: x402Signature(REQUEST, PERMIT),
    },
  });
}

test("shop: every product costs at most the 0.50 per-payment ceiling", () => {
  assert.ok(CATALOG.length >= 10);
  for (const p of CATALOG) assert.ok(BigInt(p.price) <= 500000n, p.productId);
});

test("shop: search narrows by words, price and size", () => {
  const running = searchCatalog({ q: "running shoes" });
  assert.ok(running.length > 0);
  assert.ok(running.every((p) => p.category === "running"));
  const cheap = searchCatalog({ q: "shoes", maxPrice: "250000", limit: 12 });
  assert.ok(cheap.every((p) => BigInt(p.price) <= 250000n));
  assert.equal(searchCatalog({ q: "submarine" }).length, 0);
});

test("shop: catalogue and images are served, and say no goods ship", async () => {
  const app = await shop();
  const res = await app.inject({ method: "GET", url: "/shop/catalog?q=trail" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.shop.payTo, SHOP);
  assert.match(body.shop.notice, /No goods ship/);
  assert.ok(body.products.length > 0);
  const img = await app.inject({ method: "GET", url: body.products[0].image });
  assert.equal(img.headers["content-type"], "image/svg+xml");
  assert.match(img.body, /^<svg/);
});

test("shop: a quote is a signed USDC invoice with x402 terms for the product price", async () => {
  const app = await shop();
  const res = await app.inject({
    method: "POST",
    url: "/providers/shop/check",
    payload: order(),
  });
  assert.equal(res.statusCode, 402);
  const q = QuoteEnvelopeSchema.parse(res.json());
  assert.equal(q.providerId, "shop");
  assert.equal(
    q.invoice.amount,
    CATALOG.find((p) => p.productId === "aero-runner")!.price,
  );
  assert.equal(q.invoice.recipient, SHOP);
  assert.equal(
    q.invoice.inputHash,
    hashCanonical({
      productId: "aero-runner",
      size: "42",
      deliveryHash: DELIVERY,
    }),
  );
  assert.ok(q.x402);
  assert.ok(res.headers["payment-required"]);
});

test("shop: no key, an unknown product or size, or a non-USDC asset get no quote", async () => {
  const keyless = await shop({ key: undefined });
  assert.equal(
    (
      await keyless.inject({
        method: "POST",
        url: "/providers/shop/check",
        payload: order(),
      })
    ).statusCode,
    503,
  );
  const app = await shop();
  for (const [payload, status] of [
    [order({ productId: "submarine" }), 404],
    [order({ size: "50" }), 400],
    [order({ asset: "0xE030717a657E9194bC086A546fb59aDBc631ad7a" }), 400],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/providers/shop/check",
      payload,
    });
    assert.equal(res.statusCode, status, JSON.stringify(payload));
  }
});

test("shop: an x402 payment places exactly one signed order", async () => {
  const f = facilitator();
  const app = await shop({
    facilitator: f.client,
    chain: settledChain(450000n),
  });
  const q = QuoteEnvelopeSchema.parse(
    (
      await app.inject({
        method: "POST",
        url: "/providers/shop/check",
        payload: order(),
      })
    ).json(),
  );
  const request = () =>
    app.inject({
      method: "POST",
      url: "/providers/shop/result",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "payment-signature": pay(q),
      },
      payload: { invoiceId: q.invoice.invoiceId, requestId: REQUEST },
    });
  const first = await request();
  assert.equal(first.statusCode, 200);
  assert.ok(first.headers["payment-response"]);
  const delivery = OrderDeliverySchema.parse(first.json());
  assert.equal(delivery.order.productId, "aero-runner");
  assert.equal(delivery.order.testShop, true);
  assert.equal(delivery.receipt.paymentTxHash, SETTLE_TX);
  assert.equal(delivery.receipt.resultHash, hashCanonical(delivery.order));
  const signer = await recoverTypedDataAddress({
    ...(buildTypedData(
      "DeliveryReceipt",
      delivery.receipt,
      deliveryDomain(WALLET),
    ) as never),
    signature: delivery.providerSignature,
  });
  assert.equal(signer, SHOP);
  const second = await request();
  assert.deepEqual(second.json(), first.json());
  assert.equal(f.calls.settle, 1);
});

test("shop: an order is not placed for a settlement that does not pay its invoice", async () => {
  const app = await shop({
    facilitator: facilitator().client,
    chain: settledChain(1n),
  });
  const q = QuoteEnvelopeSchema.parse(
    (
      await app.inject({
        method: "POST",
        url: "/providers/shop/check",
        payload: order(),
      })
    ).json(),
  );
  const res = await app.inject({
    method: "POST",
    url: "/providers/shop/result",
    headers: { authorization: `Bearer ${TOKEN}`, "payment-signature": pay(q) },
    payload: { invoiceId: q.invoice.invoiceId, requestId: REQUEST },
  });
  assert.equal(res.statusCode, 402);
});
