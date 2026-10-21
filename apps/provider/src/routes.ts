import { randomBytes } from "node:crypto";
import { type FastifyInstance, type FastifyReply } from "fastify";
import {
  CheckRequestSchema,
  DeliveryEnvelopeSchema,
  MAX_SHOP_PRICE,
  QuoteEnvelopeSchema,
  ResultRequestSchema,
  X402ResultRequestSchema,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  invoiceDomain,
  type DeliveryEnvelope,
  type QuoteEnvelope,
} from "@mandate/schema";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { bytesToHex, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { runChecks, type BrowserConfig } from "./browser.js";
import { checkPayment, type ChainReader } from "./payment.js";
import type { InvoiceRecord, InvoiceStore } from "./store.js";
import {
  asRequirements,
  settleOnce,
  x402Accepts,
  type FacilitatorClient,
} from "./x402.js";

type ProviderId = "a" | "b";
const isBrowserProvider = (id: string): id is ProviderId =>
  id === "a" || id === "b";

// Prices and capabilities are fixed by the plan (P4-01). Each provider's
// payment recipient is the address of its own signing key.
const CATALOG: Record<
  ProviderId,
  {
    capabilities: readonly ("pageLoad" | "title" | "formSubmit")[];
    price: string;
  }
> = {
  a: { capabilities: ["pageLoad", "title"], price: "200000" },
  b: { capabilities: ["pageLoad", "title", "formSubmit"], price: "350000" },
};

// Quotes live at most 60 seconds.
const QUOTE_SECONDS = 60;

export interface ProviderConfig {
  // Provider signing keys, from the environment. A provider without a key is
  // listed as unavailable and refuses to quote.
  keys: { [K in ProviderId]?: Hex | undefined };
  // The Mandate Test Shop's key, so the shop is listed with the providers.
  shopKey?: Hex | undefined;
  store: InvoiceStore;
  // Reads Base Sepolia to confirm payments. Without it no result is delivered.
  chain?: ChainReader | undefined;
  // Where the fixed checkout pages are served and how to start Chrome.
  browser?: BrowserConfig | undefined;
  // Bearer token the Mandate worker uses to fetch results.
  workerToken?: string | undefined;
  // x402 facilitator that verifies and settles USDC payments (S9.10). Without
  // it an x402 payment is refused; invoices still advertise x402 terms.
  facilitator?: FacilitatorClient | undefined;
  // Public URL of this service, named in the x402 PAYMENT-REQUIRED resource.
  publicUrl?: string | undefined;
}

export async function registerProviderRoutes(
  app: FastifyInstance,
  config: ProviderConfig,
) {
  const signers: Partial<Record<ProviderId, PrivateKeyAccount>> = {};
  for (const id of ["a", "b"] as const) {
    const key = config.keys[id];
    if (key) signers[id] = privateKeyToAccount(key);
  }

  const shop = config.shopKey ? privateKeyToAccount(config.shopKey) : null;
  app.get("/providers", async () => [
    ...(["a", "b"] as const).map((providerId) => ({
      providerId,
      recipient: signers[providerId]?.address ?? null,
      capabilities: CATALOG[providerId].capabilities,
      price: CATALOG[providerId].price,
      available: signers[providerId] !== undefined,
    })),
    // Each order has its own price; this is the most any product costs.
    {
      providerId: "shop",
      recipient: shop?.address ?? null,
      capabilities: ["order"],
      price: MAX_SHOP_PRICE,
      available: shop !== null,
    },
  ]);

  app.post<{ Params: { id: string } }>(
    "/providers/:id/check",
    async (request, reply) => {
      const providerId = request.params.id as ProviderId;
      const catalog = CATALOG[providerId];
      if (!catalog)
        return reply
          .code(404)
          .send({ error: `Provider ${request.params.id} not found` });
      const signer = signers[providerId];
      if (!signer)
        return reply.code(503).send({
          error: `Provider ${providerId} has no signing key configured; no quote is issued`,
        });

      const parsed = CheckRequestSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.message });
      const req = parsed.data;
      for (const check of req.checks) {
        if (!catalog.capabilities.includes(check))
          return reply.code(400).send({
            error: `Provider '${providerId}' does not support requested check '${check}'`,
          });
      }

      const now = Math.floor(Date.now() / 1000);
      const invoice = {
        invoiceId: bytesToHex(randomBytes(32)),
        taskId: req.taskId,
        wallet: req.wallet,
        asset: req.asset,
        recipient: signer.address,
        amount: catalog.price,
        inputHash: hashCanonical({
          targetId: req.targetId,
          checks: req.checks,
        }),
        issuedAt: String(now),
        expiresAt: String(now + QUOTE_SECONDS),
      };
      const providerSignature = await signer.signTypedData(
        buildTypedData("Invoice", invoice, invoiceDomain(req.wallet)) as never,
      );
      const quote: QuoteEnvelope = {
        providerId,
        invoice,
        providerSignature,
        x402: x402Accepts(invoice, providerSignature, QUOTE_SECONDS),
      };
      await config.store.put({
        quote,
        targetId: req.targetId,
        checks: req.checks,
        delivery: null,
      });
      // 402: payment is required before any work is done. A USDC invoice is
      // also offered in the official x402 PAYMENT-REQUIRED header.
      if (quote.x402)
        reply.header(
          "PAYMENT-REQUIRED",
          encodePaymentRequiredHeader({
            x402Version: 2,
            resource: {
              url: `${config.publicUrl ?? ""}/providers/${providerId}/result`,
              description: `Browser check by provider ${providerId}`,
              mimeType: "application/json",
            },
            accepts: [asRequirements(quote.x402)],
          }),
        );
      return reply.code(402).send(QuoteEnvelopeSchema.parse(quote));
    },
  );

  // One fulfillment per paid invoice, even under concurrent retrievals.
  const running = new Map<string, Promise<DeliveryEnvelope>>();

  app.post<{ Params: { id: string } }>(
    "/providers/:id/result",
    async (request, reply) => {
      const providerId = request.params.id as ProviderId;
      if (!CATALOG[providerId])
        return reply
          .code(404)
          .send({ error: `Provider ${request.params.id} not found` });
      if (
        !config.workerToken ||
        !config.chain ||
        !config.browser ||
        !signers[providerId]
      )
        return reply.code(503).send({
          error:
            "Result delivery is not configured: worker token, chain reader, browser or signing key missing",
        });
      if (request.headers.authorization !== `Bearer ${config.workerToken}`)
        return reply.code(401).send({ error: "Worker credential required" });
      const header = request.headers["payment-signature"];
      if (typeof header === "string")
        return payWithX402(providerId, header, request.body, reply);
      const parsed = ResultRequestSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.message });
      const req = parsed.data;

      const record = await config.store.get(req.invoiceId);
      if (!record || record.quote.providerId !== providerId)
        return reply.code(404).send({ error: "Unknown invoice" });
      // A repeat request returns the original result; it never charges or runs again.
      if (record.delivery) {
        if (
          record.delivery.receipt.requestId.toLowerCase() !==
          req.requestId.toLowerCase()
        )
          return reply
            .code(409)
            .send({ error: "This invoice was fulfilled for another request" });
        return reply.code(200).send(record.delivery);
      }

      const payment = await checkPayment(
        config.chain!,
        record.quote.invoice,
        req.requestId,
        req.paymentTxHash,
      );
      if (payment.state === "PENDING")
        return reply
          .code(202)
          .send({ state: "PENDING", reason: payment.reason });
      if (payment.state === "INVALID")
        return reply.code(402).send({ error: payment.reason });
      return reply
        .code(200)
        .send(await deliverOnce(record, req.requestId, req.paymentTxHash));
    },
  );

  // One fulfillment per paid invoice, shared by concurrent retrievals.
  async function deliverOnce(
    record: InvoiceRecord,
    requestId: Hex,
    paymentTxHash: Hex,
  ) {
    const invoiceId = record.quote.invoice.invoiceId;
    let job = running.get(invoiceId);
    if (!job) {
      job = fulfil(
        record.quote,
        record.targetId,
        record.checks,
        requestId,
        paymentTxHash,
      ).finally(() => running.delete(invoiceId));
      running.set(invoiceId, job);
    }
    return job;
  }

  // x402 (S9.10): verify the wallet's authorization, have the facilitator
  // settle it once, confirm the settlement on chain, then deliver once.
  async function payWithX402(
    providerId: ProviderId,
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
    if (!record || record.quote.providerId !== providerId)
      return reply.code(404).send({ error: "Unknown invoice" });
    if (!record.quote.x402)
      return reply
        .code(400)
        .send({ error: "This invoice is not payable with x402" });
    if (record.delivery) {
      if (
        record.delivery.receipt.requestId.toLowerCase() !==
        requestId.toLowerCase()
      )
        return reply
          .code(409)
          .send({ error: "This invoice was fulfilled for another request" });
      return reply.code(200).send(record.delivery);
    }
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
    const txHash = outcome.txHash;
    return reply.code(200).send(await deliverOnce(record, requestId, txHash));
  }

  async function fulfil(
    quote: QuoteEnvelope,
    targetId: "checkout-healthy" | "checkout-broken",
    checks: ("pageLoad" | "title" | "formSubmit")[],
    requestId: Hex,
    paymentTxHash: Hex,
  ): Promise<DeliveryEnvelope> {
    if (!isBrowserProvider(quote.providerId))
      throw new Error("Only browser providers run checks");
    const signer = signers[quote.providerId]!;
    const run = await runChecks(targetId, checks, config.browser!);
    const now = String(Math.floor(Date.now() / 1000));
    const result = {
      schemaVersion: 4 as const,
      targetId,
      inputHash: quote.invoice.inputHash,
      checkedAt: now,
      checks: run.checks,
      screenshotHash: run.screenshotHash,
      logHash: run.logHash,
    };
    const receipt = {
      invoiceId: quote.invoice.invoiceId,
      requestId,
      inputHash: quote.invoice.inputHash,
      resultHash: hashCanonical(result),
      paymentTxHash,
      completedAt: now,
    };
    const providerSignature = await signer.signTypedData(
      buildTypedData(
        "DeliveryReceipt",
        receipt,
        deliveryDomain(quote.invoice.wallet),
      ) as never,
    );
    const delivery = DeliveryEnvelopeSchema.parse({
      result,
      receipt,
      providerSignature,
      artifacts: [
        {
          artifactId: "screenshot",
          mediaType: "image/png",
          sha256: run.screenshotHash,
          base64: run.screenshot.toString("base64"),
        },
        {
          artifactId: "log",
          mediaType: "text/plain",
          sha256: run.logHash,
          base64: Buffer.from(run.log).toString("base64"),
        },
      ],
    });
    await config.store.put({ quote, targetId, checks, delivery });
    return delivery;
  }
}
