import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { WalletViewSchema } from "@mandate/schema";
import type { AgentClient } from "../../src/business/conversations.js";
import {
  admin,
  apiEnvironment,
  insertTask,
  ownerA,
  ownerB,
} from "./support.js";

after(() => admin.end());

const DELIVERY = "0x" + "ab".repeat(32);

// A stand-in for the chat agent service that records what it was given and
// streams a fixed reply, including a purchase for a real task.
function fakeAgent(taskId: () => string) {
  const seen: {
    token: string;
    history: unknown[];
    deliveryHash: string | null;
  }[] = [];
  const client: AgentClient = {
    async reply(request, onEvent) {
      seen.push({
        token: request.token,
        history: request.history,
        deliveryHash: request.deliveryHash,
      });
      onEvent({
        type: "step",
        id: "s1",
        label: "Searching the shop",
        state: "started",
      });
      onEvent({
        type: "step",
        id: "s1",
        label: "Searching the shop",
        state: "done",
        detail: "1 found",
      });
      onEvent({
        type: "products",
        note: "One pick",
        products: [{ productId: "aero-runner" }],
      });
      onEvent({ type: "text_delta", text: "Ready " });
      onEvent({
        type: "purchase",
        taskId: taskId(),
        product: { productId: "aero-runner", name: "Aero Runner" },
        size: "42",
        amount: "450000",
      });
      onEvent({ type: "invented", text: "dropped" });
      onEvent({ type: "agent", text: "Ready to approve." });
    },
  };
  return { client, seen };
}

async function setup(agent: AgentClient | null) {
  const e = await apiEnvironment({ business: { chain: null, agent } });
  const owner = await e.login(ownerA);
  const walletId = WalletViewSchema.parse(
    (await e.call("POST", "/v1/wallets", owner, {})).json(),
  ).walletId;
  await e.pool.query(
    "UPDATE wallets SET wallet_address=$2,deployment_block=1 WHERE id=$1",
    [walletId, "0x" + randomBytes(20).toString("hex")],
  );
  const chat = async () =>
    (await e.call("POST", "/v1/conversations", owner, { walletId })).json()
      .conversationId as string;
  const idle = async (id: string) => {
    for (let i = 0; i < 100; i++) {
      const r = await e.pool.query(
        "SELECT replying FROM conversations WHERE id=$1",
        [id],
      );
      if (!r.rows[0].replying) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("reply did not finish");
  };
  return { e, owner, walletId, chat, idle };
}

test("conversations: without the agent service a message is refused, not answered", async () => {
  const s = await setup(null);
  try {
    const id = await s.chat();
    const res = await s.e.call(
      "POST",
      `/v1/conversations/${id}/messages`,
      s.owner,
      {
        text: "buy shoes",
        deliveryHash: null,
      },
    );
    assert.equal(res.statusCode, 503);
  } finally {
    await s.e.close();
  }
});

test("conversations: a reply is stored in order, links its task and uses a scoped token that is revoked", async () => {
  let taskId = "";
  const agent = fakeAgent(() => taskId);
  const s = await setup(agent.client);
  try {
    taskId = await insertTask(s.e.pool, s.walletId, s.e.now());
    await s.e.pool.query(
      "UPDATE tasks SET outcome_state='AWAITING_OWNER' WHERE id=$1",
      [taskId],
    );
    const id = await s.chat();
    const posted = await s.e.call(
      "POST",
      `/v1/conversations/${id}/messages`,
      s.owner,
      {
        text: "Buy me running shoes size 42",
        deliveryHash: DELIVERY,
      },
    );
    assert.equal(posted.statusCode, 200, posted.body);
    await s.idle(id);

    const events = (
      await s.e.call("GET", `/v1/conversations/${id}/events`, s.owner)
    ).json().events as {
      seq: number;
      type: string;
      payload: Record<string, unknown>;
    }[];
    assert.deepEqual(
      events.map((e) => e.type),
      ["user", "step", "step", "products", "purchase", "agent"],
    );
    assert.deepEqual(
      events.map((e) => e.seq),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(events.at(-1)!.payload.text, "Ready to approve.");

    // The agent got the history and the delivery hash, and a read/prepare token
    // for this wallet that no longer works after the reply.
    assert.equal(agent.seen[0]!.deliveryHash, DELIVERY);
    assert.deepEqual(agent.seen[0]!.history, [
      { role: "user", text: "Buy me running shoes size 42" },
    ]);
    const token = await s.e.pool.query(
      "SELECT scopes,task_id,revoked_at FROM agent_tokens WHERE wallet_id=$1",
      [s.walletId],
    );
    assert.deepEqual(token.rows[0].scopes, ["read", "prepare"]);
    assert.equal(token.rows[0].task_id, null);
    assert.ok(token.rows[0].revoked_at);
    const replay = await s.e.call(
      "GET",
      `/v1/tasks/${taskId}`,
      `Bearer ${agent.seen[0]!.token}`,
    );
    assert.equal(replay.statusCode, 401);

    const list = (await s.e.call("GET", "/v1/conversations", s.owner)).json()
      .conversations;
    assert.equal(list[0].title, "Buy me running shoes size 42");
    assert.equal(list[0].status, "needs_you");

    // Deleting a chat whose task can still spend is refused.
    await s.e.pool.query(
      "UPDATE tasks SET authority_state='ACTIVE',outcome_state='RUNNING' WHERE id=$1",
      [taskId],
    );
    assert.equal(
      (await s.e.call("DELETE", `/v1/conversations/${id}`, s.owner)).statusCode,
      409,
    );
    await s.e.pool.query(
      "UPDATE tasks SET outcome_state='COMPLETED' WHERE id=$1",
      [taskId],
    );
    assert.equal(
      (await s.e.call("DELETE", `/v1/conversations/${id}`, s.owner)).statusCode,
      200,
    );
    assert.equal(
      (await s.e.call("GET", "/v1/conversations", s.owner)).json().conversations
        .length,
      0,
    );
  } finally {
    await s.e.close();
  }
});

test("conversations: another owner cannot read or post, and a second message waits for the reply", async () => {
  let release: () => void = () => {};
  const slow: AgentClient = {
    reply: async (_r, onEvent) => {
      await new Promise<void>((r) => (release = r));
      onEvent({ type: "agent", text: "done" });
    },
  };
  const s = await setup(slow);
  try {
    const id = await s.chat();
    const other = await s.e.login(ownerB);
    assert.equal(
      (await s.e.call("GET", `/v1/conversations/${id}/events`, other))
        .statusCode,
      403,
    );
    const first = await s.e.call(
      "POST",
      `/v1/conversations/${id}/messages`,
      s.owner,
      {
        text: "hello",
        deliveryHash: null,
      },
    );
    assert.equal(first.statusCode, 200);
    const second = await s.e.call(
      "POST",
      `/v1/conversations/${id}/messages`,
      s.owner,
      {
        text: "again",
        deliveryHash: null,
      },
    );
    assert.equal(second.statusCode, 409);
    release();
    await s.idle(id);
  } finally {
    await s.e.close();
  }
});

test("conversations: the stream sends stored events, then live text", async () => {
  let release: () => void = () => {};
  const agent: AgentClient = {
    reply: async (_r, onEvent) => {
      await new Promise<void>((r) => (release = r));
      onEvent({ type: "text_delta", text: "Hel" });
      onEvent({ type: "agent", text: "Hello" });
    },
  };
  const s = await setup(agent);
  try {
    await s.e.app.listen({ port: 0, host: "127.0.0.1" });
    const port = (s.e.app.server.address() as AddressInfo).port;
    const id = await s.chat();
    await s.e.call("POST", `/v1/conversations/${id}/messages`, s.owner, {
      text: "hi",
      deliveryHash: null,
    });
    const received = await new Promise<string>((resolve, reject) => {
      let data = "";
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: `/v1/conversations/${id}/stream?after=0`,
          headers: { authorization: s.owner },
        },
        (res) => {
          assert.equal(res.headers["content-type"], "text/event-stream");
          res.on("data", (chunk) => {
            data += chunk;
            if (data.includes('"type":"user"')) release();
            if (data.includes('"type":"agent"')) {
              req.destroy();
              resolve(data);
            }
          });
        },
      );
      req.on("error", (e) =>
        e.message.includes("aborted") ? null : reject(e),
      );
      req.end();
    });
    assert.match(received, /id: 1\ndata: .*"type":"user"/);
    assert.match(received, /"live":\{"type":"text_delta","text":"Hel"\}/);
    assert.match(received, /"type":"agent".*"Hello"/);
    await s.idle(id);
  } finally {
    await s.e.close();
  }
});
