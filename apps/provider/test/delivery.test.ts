import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize, resolve } from "node:path";
import Fastify from "fastify";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseAbi,
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import { buildTypedData, deliveryDomain, hashCanonical } from "@mandate/schema";
import { runChecks } from "../src/browser.js";
import {
  checkPayment,
  type ChainReader,
  type PaidInvoice,
} from "../src/payment.js";
import { registerProviderRoutes } from "../src/routes.js";
import { InvoiceStore } from "../src/store.js";

// Public Anvil test key #2. Never a real key.
const KEY_A =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const TARGETS = resolve("../../demo/targets");
const BROWSER = { channel: "chrome" };

// Serves the fixed checkout pages over HTTP for the real browser.
async function serveTargets(): Promise<{ origin: string; server: Server }> {
  const server = createServer(async (req, res) => {
    const path = normalize(
      join(TARGETS, decodeURIComponent(new URL(req.url!, "http://x").pathname)),
    );
    if (!path.startsWith(TARGETS)) return res.writeHead(403).end();
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": "text/html" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${port}`, server };
}

test("browser: the healthy checkout passes every check", async () => {
  const { origin, server } = await serveTargets();
  try {
    const run = await runChecks(
      "checkout-healthy",
      ["pageLoad", "title", "formSubmit"],
      {
        targetOrigin: origin,
        ...BROWSER,
      },
    );
    assert.equal(run.checks.pageLoad, true);
    assert.equal(run.checks.title?.pass, true);
    assert.equal(run.checks.formSubmit, true);
    assert.ok(run.screenshot.length > 1000);
    assert.match(run.log, /form outcome confirmation/);
  } finally {
    server.close();
  }
});

test("browser: the broken checkout loads but its form fails", async () => {
  const { origin, server } = await serveTargets();
  try {
    const run = await runChecks("checkout-broken", ["pageLoad", "formSubmit"], {
      targetOrigin: origin,
      ...BROWSER,
    });
    assert.equal(run.checks.pageLoad, true);
    assert.equal(run.checks.formSubmit, false);
    assert.match(run.log, /form outcome error/);
  } finally {
    server.close();
  }
});

const WALLET = "0x7777777777777777777777777777777777777777" as const;
const ASSET = "0xE030717a657E9194bC086A546fb59aDBc631ad7a" as const;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const TX = ("0x" + "56".repeat(32)) as Hex;
const actionAbi = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
]);

// Builds the two logs a real PAY emits: the wallet's ActionExecuted and the
// token's Transfer.
function payLogs(
  invoice: PaidInvoice,
  overrides: { amount?: bigint; withTransfer?: boolean } = {},
) {
  const amount = overrides.amount ?? BigInt(invoice.amount);
  const logs = [
    {
      address: invoice.wallet,
      topics: encodeEventTopics({
        abi: actionAbi,
        eventName: "ActionExecuted",
        args: { permitId: ("0x" + "01".repeat(32)) as Hex, requestId: REQUEST },
      }) as Hex[],
      data: encodeAbiParameters(
        [
          { type: "uint8" },
          { type: "address" },
          { type: "address" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bool" },
        ],
        [
          0,
          invoice.asset,
          invoice.recipient,
          amount,
          0n,
          invoice.invoiceId,
          invoice.inputHash,
          ("0x" + "02".repeat(32)) as Hex,
          false,
        ],
      ),
    },
  ];
  if (overrides.withTransfer !== false)
    logs.push({
      address: invoice.asset,
      topics: encodeEventTopics({
        abi: erc20Abi,
        eventName: "Transfer",
        args: { from: invoice.wallet, to: invoice.recipient },
      }) as Hex[],
      data: encodeAbiParameters([{ type: "uint256" }], [amount]),
    });
  return logs;
}

function fakeChain(
  logs: ReturnType<typeof payLogs> | null,
  opts: { status?: "success" | "reverted"; depth?: bigint } = {},
): ChainReader {
  return {
    async getTransactionReceipt() {
      if (!logs) throw new Error("not found");
      return { status: opts.status ?? "success", blockNumber: 100n, logs };
    },
    async getBlockNumber() {
      return 100n + (opts.depth ?? 3n) - 1n;
    },
  };
}

const invoice: PaidInvoice = {
  invoiceId: ("0x" + "12".repeat(32)) as Hex,
  wallet: WALLET,
  asset: ASSET,
  recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  amount: "200000",
  inputHash: hashCanonical({
    targetId: "checkout-healthy",
    checks: ["pageLoad"],
  }),
};

test("payment: only a confirmed PAY for exactly this invoice counts", async () => {
  assert.equal(
    (await checkPayment(fakeChain(null), invoice, REQUEST, TX)).state,
    "PENDING",
  );
  assert.equal(
    (
      await checkPayment(
        fakeChain(payLogs(invoice), { status: "reverted" }),
        invoice,
        REQUEST,
        TX,
      )
    ).state,
    "INVALID",
  );
  assert.equal(
    (
      await checkPayment(
        fakeChain(payLogs(invoice), { depth: 1n }),
        invoice,
        REQUEST,
        TX,
      )
    ).state,
    "PENDING",
  );
  assert.equal(
    (
      await checkPayment(
        fakeChain(payLogs(invoice, { amount: 1n })),
        invoice,
        REQUEST,
        TX,
      )
    ).state,
    "INVALID",
  );
  assert.equal(
    (
      await checkPayment(
        fakeChain(payLogs(invoice, { withTransfer: false })),
        invoice,
        REQUEST,
        TX,
      )
    ).state,
    "INVALID",
  );
  assert.equal(
    (
      await checkPayment(
        fakeChain(payLogs(invoice)),
        invoice,
        ("0x" + "99".repeat(32)) as Hex,
        TX,
      )
    ).state,
    "INVALID",
  );
  assert.equal(
    (await checkPayment(fakeChain(payLogs(invoice)), invoice, REQUEST, TX))
      .state,
    "PAID",
  );
});

test("provider: a paid invoice is checked once in a real browser and signed", async () => {
  const { origin, server } = await serveTargets();
  try {
    const app = Fastify();
    let chain: ChainReader = fakeChain(null);
    await registerProviderRoutes(app, {
      keys: { a: KEY_A },
      store: new InvoiceStore(await mkdtemp(join(tmpdir(), "provider-"))),
      chain: {
        getTransactionReceipt: (a) => chain.getTransactionReceipt(a),
        getBlockNumber: () => chain.getBlockNumber(),
      },
      browser: { targetOrigin: origin, ...BROWSER },
      workerToken: "worker-secret",
    });
    const quote = (
      await app.inject({
        method: "POST",
        url: "/providers/a/check",
        payload: {
          taskId: ("0x" + "aa".repeat(32)) as Hex,
          wallet: WALLET,
          asset: ASSET,
          targetId: "checkout-healthy",
          checks: ["pageLoad", "title"],
        },
      })
    ).json();
    const body = {
      invoiceId: quote.invoice.invoiceId,
      requestId: REQUEST,
      paymentTxHash: TX,
    };
    const ask = (token = "worker-secret") =>
      app.inject({
        method: "POST",
        url: "/providers/a/result",
        payload: body,
        headers: { authorization: `Bearer ${token}` },
      });

    assert.equal((await ask("wrong")).statusCode, 401);
    assert.equal((await ask()).statusCode, 202); // not paid yet
    chain = fakeChain(payLogs(quote.invoice));

    const [first, second] = await Promise.all([ask(), ask()]);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json(), second.json()); // one fulfillment
    const delivery = first.json();
    assert.equal(delivery.result.checks.pageLoad, true);
    assert.equal(delivery.result.checks.title.pass, true);
    assert.equal(delivery.receipt.resultHash, hashCanonical(delivery.result));
    const signer = await recoverTypedDataAddress({
      ...(buildTypedData(
        "DeliveryReceipt",
        delivery.receipt,
        deliveryDomain(WALLET),
      ) as never),
      signature: delivery.providerSignature,
    });
    assert.equal(signer, quote.invoice.recipient);
    const again = (await ask()).json();
    assert.deepEqual(again, delivery); // a repeat never runs or charges again
  } finally {
    server.close();
  }
});
