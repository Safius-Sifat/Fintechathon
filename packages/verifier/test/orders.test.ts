import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_SEPOLIA_USDC,
  buildTypedData,
  deliveryDomain,
  hashCanonical,
  type EvidenceBundle,
} from "@mandate/schema";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainFacts, ReceiptFact } from "../src/context.js";
import { checkDelivery } from "../src/delivery.js";

// Public Anvil test key #3 stands in for the shop.
const SHOP = privateKeyToAccount(
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
);
const WALLET = "0x1111111111111111111111111111111111111111" as Hex;
const REQUEST = ("0x" + "34".repeat(32)) as Hex;
const INVOICE = ("0x" + "12".repeat(32)) as Hex;
const INPUT = ("0x" + "56".repeat(32)) as Hex;
const ACTION_TX = ("0x" + "a1".repeat(32)) as Hex;
const SETTLE_TX = ("0x" + "b2".repeat(32)) as Hex;
const AMOUNT = "450000";

const order = {
  schemaVersion: 4 as const,
  orderId: ("0x" + "0d".repeat(32)) as Hex,
  inputHash: INPUT,
  productId: "aero-runner",
  name: "Aero Runner",
  size: "42",
  amount: AMOUNT,
  deliveryHash: ("0x" + "de".repeat(32)) as Hex,
  testShop: true as const,
  placedAt: "1793000100",
};

async function bundle(changed: Partial<typeof order> = {}) {
  const receipt = {
    invoiceId: INVOICE,
    requestId: REQUEST,
    inputHash: INPUT,
    resultHash: hashCanonical(order),
    paymentTxHash: SETTLE_TX,
    completedAt: "1793000100",
  };
  const providerSignature = await SHOP.signTypedData(
    buildTypedData("DeliveryReceipt", receipt, deliveryDomain(WALLET)) as never,
  );
  return {
    manifest: { wallet: WALLET },
    // As the worker records it: the delivery is the event's payload.
    events: [
      {
        eventId: "22222222-2222-4222-8222-222222222220",
        payload: {
          order: { ...order, ...changed },
          receipt,
          providerSignature,
        },
      },
    ],
    transactions: [{ txHash: ACTION_TX, requestId: REQUEST }],
  } as unknown as EvidenceBundle;
}

const actionAbi = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
]);
const tokenAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)",
]);

function facts(
  opts: {
    operation?: number;
    executed?: bigint;
    transferred?: bigint;
    settled?: boolean;
  } = {},
): ChainFacts {
  const action: ReceiptFact = {
    status: "success",
    blockNumber: 100n,
    to: WALLET,
    logs: [
      {
        address: WALLET,
        topics: encodeEventTopics({
          abi: actionAbi,
          eventName: "ActionExecuted",
          args: {
            permitId: ("0x" + "01".repeat(32)) as Hex,
            requestId: REQUEST,
          },
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
            opts.operation ?? 6,
            BASE_SEPOLIA_USDC,
            SHOP.address,
            opts.executed ?? 0n,
            0n,
            INVOICE,
            INPUT,
            ("0x" + "02".repeat(32)) as Hex,
            false,
          ],
        ),
      },
    ],
  };
  const settlement: ReceiptFact = {
    status: "success",
    blockNumber: 101n,
    to: BASE_SEPOLIA_USDC,
    logs: [
      {
        address: BASE_SEPOLIA_USDC,
        topics: encodeEventTopics({
          abi: tokenAbi,
          eventName: "Transfer",
          args: { from: WALLET, to: SHOP.address },
        }) as Hex[],
        data: encodeAbiParameters(
          [{ type: "uint256" }],
          [opts.transferred ?? BigInt(AMOUNT)],
        ),
      },
      {
        address: BASE_SEPOLIA_USDC,
        topics: encodeEventTopics({
          abi: tokenAbi,
          eventName: "AuthorizationUsed",
          args: { authorizer: WALLET, nonce: REQUEST },
        }) as Hex[],
        data: "0x",
      },
    ],
  };
  return {
    latestBlock: 110n,
    walletOwner: null,
    anchorReceipt: null,
    receipts: new Map([
      [ACTION_TX, action],
      ...(opts.settled === false
        ? []
        : [[SETTLE_TX, settlement] as [string, ReceiptFact]]),
    ]),
  };
}

const verify = async (
  b: EvidenceBundle,
  chain: ChainFacts,
): Promise<{ state: string; ruleId: string }> =>
  checkDelivery(b, { trustedEvidenceKey: null, chain });

test("orders: a signed order whose x402 transfer settled passes", async () => {
  const f = await verify(await bundle(), facts());
  assert.equal(f.state, "PASS", f.ruleId);
});

test("orders: the transfer must move exactly the order amount", async () => {
  const f = await verify(
    await bundle(),
    facts({ transferred: BigInt(AMOUNT) - 1n }),
  );
  assert.deepEqual([f.state, f.ruleId], ["FAIL", "DELIVERY_ORDER_NOT_SETTLED"]);
});

test("orders: an unsettled payment is pending, not passed", async () => {
  const f = await verify(await bundle(), facts({ settled: false }));
  assert.deepEqual(
    [f.state, f.ruleId],
    ["PENDING", "DELIVERY_ORDER_SETTLEMENT_PENDING"],
  );
});

test("orders: a changed order fails its signed hash", async () => {
  const f = await verify(await bundle({ size: "43" }), facts());
  assert.deepEqual([f.state, f.ruleId], ["FAIL", "DELIVERY_ORDER_CHANGED"]);
});

test("orders: a direct payment must match the order amount", async () => {
  assert.equal(
    (
      await verify(
        await bundle(),
        facts({ operation: 0, executed: BigInt(AMOUNT) }),
      )
    ).state,
    "PASS",
  );
  const f = await verify(await bundle(), facts({ operation: 0, executed: 1n }));
  assert.deepEqual([f.state, f.ruleId], ["FAIL", "DELIVERY_ORDER_AMOUNT"]);
});
