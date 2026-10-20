import { type FastifyInstance } from "fastify";
import {
  CheckRequestSchema,
  ResultRequestSchema,
  QuoteEnvelopeSchema,
  DeliveryEnvelopeSchema,
  type QuoteEnvelope,
  type DeliveryEnvelope,
  hashCanonical,
} from "@mandate/schema";
import { type Hex } from "viem";

const PROVIDERS = {
  a: {
    providerId: "a" as const,
    recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const,
    capabilities: ["pageLoad", "title"] as const,
    price: "200000",
  },
  b: {
    providerId: "b" as const,
    recipient: "0x6666666666666666666666666666666666666666" as const,
    capabilities: ["pageLoad", "title", "formSubmit"] as const,
    price: "350000",
  },
};

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get("/providers", async () => {
    return Object.values(PROVIDERS);
  });

  app.post<{ Params: { id: string } }>("/providers/:id/check", async (request, reply) => {
    const providerId = request.params.id as "a" | "b";
    const provider = PROVIDERS[providerId];
    if (!provider) {
      return reply.code(404).send({ error: `Provider ${providerId} not found` });
    }

    const parseResult = CheckRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: parseResult.error.message });
    }
    const checkReq = parseResult.data;

    // Capability check
    for (const chk of checkReq.checks) {
      if (!provider.capabilities.includes(chk as any)) {
        return reply.code(400).send({
          error: `Provider '${providerId}' does not support requested check '${chk}'`,
        });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const windowSec = checkReq.reviewWindowSeconds ?? 600;
    const inputHash = hashCanonical({ targetId: checkReq.targetId, checks: checkReq.checks }) as Hex;
    const invoiceId = hashCanonical({ taskId: checkReq.taskId, now, providerId }) as Hex;

    const quote: QuoteEnvelope = {
      providerId,
      invoice: {
        invoiceId,
        taskId: checkReq.taskId,
        wallet: checkReq.wallet,
        asset: checkReq.asset,
        recipient: provider.recipient,
        amount: provider.price,
        inputHash,
        issuedAt: String(now),
        expiresAt: String(now + windowSec),
      },
      providerSignature: ("0x" + "aa".repeat(65)) as Hex,
      x402: null,
    };

    return reply.code(200).send(QuoteEnvelopeSchema.parse(quote));
  });

  app.post<{ Params: { id: string } }>("/providers/:id/result", async (request, reply) => {
    const providerId = request.params.id as "a" | "b";
    const provider = PROVIDERS[providerId];
    if (!provider) {
      return reply.code(404).send({ error: `Provider ${providerId} not found` });
    }

    const parseResult = ResultRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: parseResult.error.message });
    }
    const req = parseResult.data;

    const now = Math.floor(Date.now() / 1000);
    const inputHash = hashCanonical({ targetId: "checkout-healthy", checks: ["pageLoad", "title"] }) as Hex;
    const resultHash = hashCanonical({ pageLoad: true, title: "Checkout" }) as Hex;

    const delivery: DeliveryEnvelope = {
      result: {
        schemaVersion: 4,
        targetId: "checkout-healthy",
        inputHash,
        checkedAt: String(now),
        checks: {
          pageLoad: true,
          title: { actual: "Checkout", expected: "Checkout", pass: true },
          ...(providerId === "b" ? { formSubmit: true } : {}),
        },
        screenshotHash: ("0x" + "11".repeat(32)) as Hex,
        logHash: ("0x" + "22".repeat(32)) as Hex,
      },
      receipt: {
        invoiceId: req.invoiceId,
        requestId: req.requestId,
        inputHash,
        resultHash,
        paymentTxHash: req.paymentTxHash,
        completedAt: String(now),
      },
      providerSignature: ("0x" + "bb".repeat(65)) as Hex,
      artifacts: [],
    };

    return reply.code(200).send(DeliveryEnvelopeSchema.parse(delivery));
  });
}
