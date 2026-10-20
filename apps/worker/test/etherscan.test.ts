import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EtherscanClient,
  IndexerUnavailable,
} from "../src/history/etherscan.js";

const client = (status: number, body: unknown) =>
  new EtherscanClient(
    "key",
    "https://indexer.invalid/v2/api",
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
  );
const page = (c: EtherscanClient) =>
  c.page("txlist", "0x" + "11".repeat(20), 0n, 10n, 1);

test("indexer error, quota, rate and malformed envelopes raise instead of returning empty history", async () => {
  for (const [status, body, reason] of [
    [429, {}, "RATE_LIMIT"],
    [500, {}, "ERROR"],
    [
      200,
      {
        status: "0",
        message: "NOTOK",
        result: "Max calls per sec rate limit reached",
      },
      "RATE_LIMIT",
    ],
    [
      200,
      { status: "0", message: "NOTOK", result: "Daily quota exceeded" },
      "QUOTA",
    ],
    [
      200,
      { status: "0", message: "NOTOK", result: "Invalid API Key" },
      "ERROR",
    ],
    [200, "not json", "MALFORMED"],
    [200, { status: "1", message: "OK", result: "x" }, "MALFORMED"],
  ] as const)
    await assert.rejects(
      page(client(status, body)),
      (e: unknown) => e instanceof IndexerUnavailable && e.reason === reason,
    );
  const unreachable = new EtherscanClient(
    "key",
    "https://indexer.invalid/v2/api",
    async () => {
      throw new TypeError("fetch failed");
    },
  );
  await assert.rejects(
    page(unreachable),
    (e: unknown) =>
      e instanceof IndexerUnavailable && e.reason === "UNREACHABLE",
  );
});

test("only the explicit no-transactions envelope is an empty page", async () => {
  assert.deepEqual(
    await page(
      client(200, {
        status: "0",
        message: "No transactions found",
        result: [],
      }),
    ),
    [],
  );
  const items = await page(
    client(200, {
      status: "1",
      message: "OK",
      result: [
        {
          blockNumber: "5",
          hash: "0x" + "ab".repeat(32),
          from: "0x" + "11".repeat(20),
          to: "0x" + "22".repeat(20),
          value: "7",
        },
      ],
    }),
  );
  assert.equal(items.length, 1);
});
