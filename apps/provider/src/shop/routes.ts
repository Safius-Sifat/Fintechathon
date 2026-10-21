import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import {
  BASE_SEPOLIA_USDC,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  invoiceDomain,
  OrderDeliverySchema,
  QuoteEnvelopeSchema,
  ResultRequestSchema,
  ShopOrderRequestSchema,
  X402ResultRequestSchema,
  type OrderDelivery,
  type QuoteEnvelope,
} from "@mandate/schema";
import { bytesToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkPayment, type ChainReader } from "../payment.js";
import type { RecordStore } from "../store.js";
import {
  asRequirements,
  settleOnce,
  x402Accepts,
  type FacilitatorClient,
} from "../x402.js";
import { CATALOG, productById, searchCatalog } from "./catalog.js";
import { productSvg } from "./images.js";

// Quotes live at most 60 seconds, like every invoice (S2).
const QUOTE_SECONDS = 60;

export interface OrderRecord {
  quote: QuoteEnvelope;
  productId: string;
  size: string | null;
  deliveryHash: Hex;
  delivery: OrderDelivery | null;
  settlementTxHash?: Hex | null;
}

export interface ShopConfig {
  // The shop's signing key; its address is where it is paid.
  key?: Hex | undefined;
  store: RecordStore<OrderRecord>;
  chain?: ChainReader | undefined;
  facilitator?: FacilitatorClient | undefined;
  workerToken?: string | undefined;
  publicUrl?: string | undefined;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// The Mandate demo shop (plan 05): a trusted merchant selling sample products
// for test USDC with x402. Orders are real signed receipts for real payments;
// the goods are samples and nothing ships.
export async function registerShopRoutes(
  app: FastifyInstance,
  config: ShopConfig,
) {
  const signer = config.key ? privateKeyToAccount(config.key) : null;

  app.get<{
    Querystring: {
      q?: string;
      category?: string;
      size?: string;
      maxPrice?: string;
      limit?: string;
    };
  }>("/shop/catalog", async (request) => ({
    shop: {
      name: "Mandate Test Shop",
      payTo: signer?.address ?? null,
      available: signer !== null,
      notice: "Sample products for test USDC. No goods ship.",
    },
    products: searchCatalog({
      ...request.query,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
    }),
  }));

  app.get<{ Params: { id: string } }>(
    "/shop/catalog/:id",
    async (request, reply) => {
      const p = productById(request.params.id);
      return p ? p : reply.code(404).send({ error: "Unknown product" });
    },
  );

  app.get<{ Params: { file: string } }>(
    "/shop/images/:file",
    async (request, reply) => {
      const id = request.params.file.replace(/\.svg$/, "");
      const p = CATALOG.find((x) => x.productId === id);
      if (!p) return reply.code(404).send({ error: "Unknown image" });
      return reply
        .header("content-type", "image/svg+xml")
        .header("cache-control", "public, max-age=86400")
        .send(productSvg(p));
    },
  );

  // 402 quote for one order, signed as a Mandate invoice and offered with
  // x402 terms. Nothing is charged here.
  app.post("/providers/shop/check", async (request, reply) => {
    if (!signer)
      return reply.code(503).send({
        error: "The shop has no signing key configured; no quote is issued",
      });
    const parsed = ShopOrderRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.message });
    const req = parsed.data;
    const product = productById(req.productId);
    if (!product) return reply.code(404).send({ error: "Unknown product" });
    if (product.sizes.length > 0 && !product.sizes.includes(req.size ?? ""))
      return reply
        .code(400)
        .send({ error: `Size ${req.size ?? "none"} is not available` });
    if (!same(req.asset, BASE_SEPOLIA_USDC))
      return reply.code(400).send({ error: "The shop accepts only USDC" });
    const now = Math.floor(Date.now() / 1000);
    const lifetime = Math.max(QUOTE_SECONDS, req.reviewWindowSeconds ?? 0);
    const invoice = {
      invoiceId: bytesToHex(randomBytes(32)),
      taskId: req.taskId,
      wallet: req.wallet,
      asset: req.asset,
      recipient: signer.address,
      amount: product.price,
      inputHash: hashCanonical({
        productId: req.productId,
        size: req.size,
        deliveryHash: req.deliveryHash,
      }),
      issuedAt: String(now),
      expiresAt: String(now + lifetime),
    };
    const providerSignature = await signer.signTypedData(
      buildTypedData("Invoice", invoice, invoiceDomain(req.wallet)) as never,
    );
    const quote: QuoteEnvelope = {
      providerId: "shop",
      invoice,
      providerSignature,
      x402: x402Accepts(invoice, providerSignature, lifetime),
    };
    await config.store.put({
      quote,
      productId: req.productId,
      size: req.size,
      deliveryHash: req.deliveryHash,
      delivery: null,
    });
    reply.header(
      "PAYMENT-REQUIRED",
      encodePaymentRequiredHeader({
        x402Version: 2,
        resource: {
          url: `${config.publicUrl ?? ""}/providers/shop/result`,
          description: `${product.name} from the Mandate Test Shop`,
          mimeType: "application/json",
        },
        accepts: [asRequirements(quote.x402!)],
      }),
    );
    return reply.code(402).send(QuoteEnvelopeSchema.parse(quote));
  });

  // Retrieval after payment: x402 (PAYMENT-SIGNATURE) or a normal PAY
  // (paymentTxHash). Either way the order is placed once.
  app.post("/providers/shop/result", async (request, reply) => {
    if (!config.workerToken || !config.chain || !signer)
      return reply.code(503).send({
        error:
          "Order delivery is not configured: worker token, chain reader or signing key missing",
      });
    if (request.headers.authorization !== `Bearer ${config.workerToken}`)
      return reply.code(401).send({ error: "Worker credential required" });
    const header = request.headers["payment-signature"];
    if (typeof header === "string")
      return payWithX402(header, request.body, reply);
    const parsed = ResultRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.message });
    const { invoiceId, requestId, paymentTxHash } = parsed.data;
    const record = await config.store.get(invoiceId);
    if (!record) return reply.code(404).send({ error: "Unknown invoice" });
    const repeated = repeat(record, requestId, reply);
    if (repeated) return repeated;
    const payment = await checkPayment(
      config.chain,
      record.quote.invoice,
      requestId,
      paymentTxHash,
    );
    if (payment.state === "PENDING")
      return reply.code(202).send({ state: "PENDING", reason: payment.reason });
    if (payment.state === "INVALID")
      return reply.code(402).send({ error: payment.reason });
    return reply.code(200).send(await place(record, requestId, paymentTxHash));
  });

  async function payWithX402(
    header: string,
    body: unknown,
    reply: FastifyReply,
  ) {
    if (!config.facilitator)
      return reply.code(503).send({
        error: "x402 settlement is not configured; no payment was taken",
      });
    const parsed = X402ResultRequestSchema.safeParse(body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.message });
    const { invoiceId, requestId } = parsed.data;
    const record = await config.store.get(invoiceId);
    if (!record || !record.quote.x402)
      return reply.code(404).send({ error: "Unknown invoice" });
    const repeated = repeat(record, requestId, reply);
    if (repeated) return repeated;
    const outcome = await settleOnce({
      facilitator: config.facilitator,
      chain: config.chain!,
      accepts: record.quote.x402,
      invoice: record.quote.invoice,
      requestId,
      header,
      recorded: record.settlementTxHash ?? null,
      record: (txHash) =>
        config.store.put({ ...record, settlementTxHash: txHash }),
    });
    if (outcome.state === "REFUSED")
      return reply.code(outcome.status).send({ error: outcome.error });
    if (outcome.state === "PENDING")
      return reply.code(202).send({
        state: "PENDING",
        reason: outcome.reason,
        settlementTxHash: outcome.txHash,
      });
    reply.header("PAYMENT-RESPONSE", outcome.responseHeader);
    return reply.code(200).send(await place(record, requestId, outcome.txHash));
  }

  // A repeat request returns the original order; it never charges twice.
  function repeat(record: OrderRecord, requestId: Hex, reply: FastifyReply) {
    if (!record.delivery) return null;
    if (!same(record.delivery.receipt.requestId, requestId))
      return reply
        .code(409)
        .send({ error: "This invoice was fulfilled for another request" });
    return reply.code(200).send(record.delivery);
  }

  const placing = new Map<string, Promise<OrderDelivery>>();
  function place(record: OrderRecord, requestId: Hex, paymentTxHash: Hex) {
    const id = record.quote.invoice.invoiceId;
    let job = placing.get(id);
    if (!job) {
      job = sign(record, requestId, paymentTxHash).finally(() =>
        placing.delete(id),
      );
      placing.set(id, job);
    }
    return job;
  }

  async function sign(
    record: OrderRecord,
    requestId: Hex,
    paymentTxHash: Hex,
  ): Promise<OrderDelivery> {
    const product = productById(record.productId)!;
    const now = String(Math.floor(Date.now() / 1000));
    const order = {
      schemaVersion: 4 as const,
      orderId: record.quote.invoice.invoiceId,
      inputHash: record.quote.invoice.inputHash,
      productId: record.productId,
      name: product.name,
      size: record.size,
      amount: record.quote.invoice.amount,
      deliveryHash: record.deliveryHash,
      testShop: true as const,
      placedAt: now,
    };
    const receipt = {
      invoiceId: record.quote.invoice.invoiceId,
      requestId,
      inputHash: record.quote.invoice.inputHash,
      resultHash: hashCanonical(order),
      paymentTxHash,
      completedAt: now,
    };
    const providerSignature = await signer!.signTypedData(
      buildTypedData(
        "DeliveryReceipt",
        receipt,
        deliveryDomain(record.quote.invoice.wallet),
      ) as never,
    );
    const delivery = OrderDeliverySchema.parse({
      order,
      receipt,
      providerSignature,
    });
    await config.store.put({ ...record, delivery });
    return delivery;
  }
}
