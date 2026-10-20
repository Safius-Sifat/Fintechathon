import test from "node:test";
import assert from "node:assert/strict";
import { MandateClient } from "../src/index.js";

test("sdk: calls API endpoints with Bearer auth and parses response", async () => {
  const calls: { url: string; headers: Headers; body?: string }[] = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = input.toString();
    calls.push({
      url,
      headers: new Headers(init?.headers),
      body: init?.body ? String(init.body) : undefined,
    });

    if (url.includes("/v1/wallets/")) {
      return new Response(
        JSON.stringify({
          walletId: "11111111-1111-4111-8111-111111111111",
          owner: "0x1111111111111111111111111111111111111111",
          address: "0x7777777777777777777777777777777777777777",
          chainId: 84532,
          provisioningState: "READY",
          executorAddress: "0x3333333333333333333333333333333333333333",
          paused: false,
          frozen: false,
          epoch: "1",
          policyVersion: "1",
          inhibited: false,
          assets: [],
          liquidUnits: "1000000",
          floorUnits: "0",
          reservedUnits: "0",
          vaultAssetsUnits: "0",
          spendableUnits: "1000000",
          budgets: {
            day: "19000",
            walletSpentUnits: "0",
            executorSpentUnits: "0",
            walletRemainingUnits: "1000000",
            executorRemainingUnits: "500000",
          },
          asOfBlock: "100",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.endsWith("/v1/tasks") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          taskId: "test-task",
          chainTaskId: "0x1111",
          permitId: "0x2222",
          conditions: {},
          needsOwnerReview: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const client = new MandateClient({
    baseUrl: "https://api.mandate.example",
    token: "test-agent-jwt",
    fetch: mockFetch,
  });

  const wallet = await client.getWallet("11111111-1111-4111-8111-111111111111");
  assert.equal(wallet.address, "0x7777777777777777777777777777777777777777");
  assert.equal(calls[0]?.headers.get("Authorization"), "Bearer test-agent-jwt");

  const prep = await client.createTask(
    {
      walletId: "11111111-1111-4111-8111-111111111111",
      runbookId: "browser-check",
      goal: "Check the checkout page loads",
      input: { targetId: "checkout-healthy", checks: ["pageLoad"] },
    },
    "retry-key-1",
  );
  assert.equal(prep.taskId, "test-task");
  const createCall = calls.find((c) => c.url.endsWith("/v1/tasks"));
  assert.equal(createCall?.headers.get("Idempotency-Key"), "retry-key-1");
});
