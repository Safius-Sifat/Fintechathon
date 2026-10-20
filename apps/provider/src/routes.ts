import { randomBytes } from "node:crypto";
import { type FastifyInstance } from "fastify";
import {
  CheckRequestSchema,
  QuoteEnvelopeSchema,
  ResultRequestSchema,
  buildTypedData,
  hashCanonical,
  invoiceDomain,
  type QuoteEnvelope,
} from "@mandate/schema";
import { bytesToHex, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

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
        return reply
          .code(503)
          .send({
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
      // 402: payment is required before any work is done.
      return reply.code(402).send(QuoteEnvelopeSchema.parse(quote));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/providers/:id/result",
    async (request, reply) => {
      if (!CATALOG[request.params.id as ProviderId])
        return reply
          .code(404)
          .send({ error: `Provider ${request.params.id} not found` });
      const parsed = ResultRequestSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.message });
      // Paid delivery needs on-chain payment verification and the browser
      // runner. Neither is built, so no result is returned or invented.
      return reply.code(501).send({
        error:
          "Paid result delivery is not available: payment verification and the browser runner are not built",
      });
    },
  );
}
