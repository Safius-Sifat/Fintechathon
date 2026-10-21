import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseAbi,
  type Hex,
} from "viem";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import {
  BASE_SEPOLIA_USDC,
  X402_NETWORK,
  type Action,
  type QuoteEnvelope,
  type SettlementReader,
} from "@mandate/schema";
import { providerDeps } from "../src/advance.js";

const WALLET = "0x7777777777777777777777777777777777777777" as Hex;
const PAYEE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const PERMIT = ("0x" + "56".repeat(32)) as Hex;
const SETTLE_TX = ("0x" + "78".repeat(32)) as Hex;
const INVOICE = ("0x" + "12".repeat(32)) as Hex;

const invoice = {
  invoiceId: INVOICE,
  taskId: ("0x" + "aa".repeat(32)) as Hex,
  wallet: WALLET,
  asset: BASE_SEPOLIA_USDC,
  recipient: PAYEE,
  amount: "200000",
  inputHash: ("0x" + "0b".repeat(32)) as Hex,
  issuedAt: "1700000000",
  expiresAt: "1700000060",
};
const signature = ("0x" + "11".repeat(65)) as Hex;
const quote = {
  providerId: "a",
  invoice,
  providerSignature: signature,
  x402: {
    scheme: "exact",
    network: X402_NETWORK,
    amount: invoice.amount,
    asset: invoice.asset,
    payTo: PAYEE,
    maxTimeoutSeconds: 60,
    extra: {
      assetTransferMethod: "eip3009",
      name: "USDC",
      version: "2",
      mandateInvoice: invoice,
      mandateProviderSignature: signature,
    },
  },
} as QuoteEnvelope;
const action: Action = {
  permitId: PERMIT,
  requestId: REQUEST,
  operation: 6,
  target: PAYEE,
  amount: invoice.amount,
  minOutput: "0",
  invoiceId: INVOICE,
  inputHash: invoice.inputHash,
  period: 0,
  issuedAt: "1700000000",
  deadline: "1700000050",
};

const delivery = {
  result: {
    schemaVersion: 4,
    targetId: "checkout-healthy",
    inputHash: invoice.inputHash,
    checkedAt: "1700000040",
    checks: { pageLoad: true },
    screenshotHash: ("0x" + "31".repeat(32)) as Hex,
    logHash: ("0x" + "32".repeat(32)) as Hex,
  },
  receipt: {
    invoiceId: INVOICE,
    requestId: REQUEST,
    inputHash: invoice.inputHash,
    resultHash: ("0x" + "33".repeat(32)) as Hex,
    paymentTxHash: SETTLE_TX,
    completedAt: "1700000040",
  },
  providerSignature: signature,
  artifacts: [],
};

const usedAbi = parseAbi([
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);

function chain(paid: boolean, depth = 3n): SettlementReader {
  const logs = [
    {
      address: BASE_SEPOLIA_USDC,
      topics: encodeEventTopics({
        abi: usedAbi,
        eventName: "AuthorizationUsed",
        args: { authorizer: WALLET, nonce: REQUEST },
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
      data: encodeAbiParameters([{ type: "uint256" }], [paid ? 200000n : 1n]),
    },
  ];
  return {
    async getTransactionReceipt() {
      return { status: "success", blockNumber: 100n, logs };
    },
    async getBlockNumber() {
      return 100n + depth - 1n;
    },
  };
}

async function provider(
  respond: (req: IncomingMessage, body: string) => [number, unknown],
) {
  const seen: { header?: string | undefined; body?: unknown } = {};
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.header = req.headers["payment-signature"] as string | undefined;
      seen.body = JSON.parse(body || "null");
      const [status, json] = respond(req, body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, seen, close: () => server.close() };
}

const ctx = () => ({
  taskId: invoice.taskId,
  wallet: WALLET,
  asset: BASE_SEPOLIA_USDC,
});

test("x402: without x402 enabled the worker offers no x402 payment", () => {
  assert.equal(providerDeps("http://unused", "t", ctx).x402, undefined);
});

test("x402: the worker sends the wallet's authorization and checks the settlement itself", async () => {
  const p = await provider(() => [200, delivery]);
  try {
    const deps = providerDeps(p.url, "t", ctx, { chain: chain(true) });
    const paid = await deps.x402!.pay("a", quote, action);
    assert.equal(paid.state, "DELIVERED");
    assert.deepEqual(p.seen.body, { invoiceId: INVOICE, requestId: REQUEST });
    const payload = decodePaymentSignatureHeader(p.seen.header!);
    const auth = (payload.payload as { authorization: Record<string, string> })
      .authorization;
    assert.equal(auth.from, WALLET);
    assert.equal(auth.to, PAYEE);
    assert.equal(auth.value, "200000");
    assert.equal(auth.validAfter, "0");
    assert.equal(auth.validBefore, action.deadline);
    assert.equal(auth.nonce, REQUEST);
    assert.equal(
      (payload.payload as { signature: string }).signature,
      REQUEST + PERMIT.slice(2) + "01",
    );
  } finally {
    p.close();
  }
});

test("x402: a delivery whose settlement is not on chain is not accepted", async () => {
  const p = await provider(() => [200, delivery]);
  try {
    const wrong = providerDeps(p.url, "t", ctx, { chain: chain(false) });
    assert.equal((await wrong.x402!.pay("a", quote, action)).state, "PENDING");
    const shallow = providerDeps(p.url, "t", ctx, { chain: chain(true, 1n) });
    assert.equal(
      (await shallow.x402!.pay("a", quote, action)).state,
      "PENDING",
    );
  } finally {
    p.close();
  }
});

test("x402: a pending or refused settlement keeps the task waiting with the reason", async () => {
  const p = await provider(() => [
    402,
    { error: "The facilitator refused the payment: invalid_signature" },
  ]);
  try {
    const deps = providerDeps(p.url, "t", ctx, { chain: chain(true) });
    const paid = await deps.x402!.pay("a", quote, action);
    assert.equal(paid.state, "PENDING");
    assert.match((paid as { reason: string }).reason, /invalid_signature/);
  } finally {
    p.close();
  }
});

test("x402: the shop's signed order is paid the same way and parsed as an order", async () => {
  const order = {
    order: {
      schemaVersion: 4,
      orderId: INVOICE,
      inputHash: invoice.inputHash,
      productId: "aero-runner",
      name: "Aero Runner",
      size: "42",
      amount: invoice.amount,
      deliveryHash: ("0x" + "ab".repeat(32)) as Hex,
      testShop: true,
      placedAt: "1700000040",
    },
    receipt: delivery.receipt,
    providerSignature: signature,
  };
  const p = await provider((req) => [
    req.url === "/providers/shop/check" ? 402 : 200,
    req.url === "/providers/shop/check"
      ? { ...quote, providerId: "shop" }
      : order,
  ]);
  try {
    const deps = providerDeps(p.url, "t", ctx, { chain: chain(true) });
    const q = await deps.shop!.quote({
      productId: "aero-runner",
      size: "42",
      deliveryHash: ("0x" + "ab".repeat(32)) as Hex,
    });
    assert.equal(q.providerId, "shop");
    const paid = await deps.shop!.payX402!(q, action);
    assert.equal(paid.state, "DELIVERED");
    assert.equal(
      (paid as { delivery: { order: { productId: string } } }).delivery.order
        .productId,
      "aero-runner",
    );
    assert.equal(providerDeps(p.url, "t", ctx).shop!.payX402, undefined);
  } finally {
    p.close();
  }
});
