import { randomBytes } from "node:crypto";
import { type FastifyInstance } from "fastify";
import {
  CheckRequestSchema,
  DeliveryEnvelopeSchema,
  QuoteEnvelopeSchema,
  ResultRequestSchema,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  invoiceDomain,
  type DeliveryEnvelope,
  type QuoteEnvelope,
} from "@mandate/schema";
import { bytesToHex, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { runChecks, type BrowserConfig } from "./browser.js";
import { checkPayment, type ChainReader } from "./payment.js";
import type { InvoiceStore } from "./store.js";

type ProviderId = "a" | "b";

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
  store: InvoiceStore;
  // Reads Base Sepolia to confirm payments. Without it no result is delivered.
  chain?: ChainReader | undefined;
  // Where the fixed checkout pages are served and how to start Chrome.
  browser?: BrowserConfig | undefined;
  // Bearer token the Mandate worker uses to fetch results.
  workerToken?: string | undefined;
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

  app.get("/providers", async () =>
    (["a", "b"] as const).map((providerId) => ({
      providerId,
      recipient: signers[providerId]?.address ?? null,
      capabilities: CATALOG[providerId].capabilities,
      price: CATALOG[providerId].price,
      available: signers[providerId] !== undefined,
    })),
  );

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
        x402: null,
      };
      await config.store.put({
        quote,
        targetId: req.targetId,
        checks: req.checks,
        delivery: null,
      });
      // 402: payment is required before any work is done.
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
        config.chain,
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

      let job = running.get(req.invoiceId);
      if (!job) {
        job = fulfil(
          record.quote,
          record.targetId,
          record.checks,
          req.requestId,
          req.paymentTxHash,
        );
        running.set(req.invoiceId, job);
      }
      try {
        return reply.code(200).send(await job);
      } finally {
        running.delete(req.invoiceId);
      }
    },
  );

  async function fulfil(
    quote: QuoteEnvelope,
    targetId: "checkout-healthy" | "checkout-broken",
    checks: ("pageLoad" | "title" | "formSubmit")[],
    requestId: Hex,
    paymentTxHash: Hex,
  ): Promise<DeliveryEnvelope> {
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
