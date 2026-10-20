import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { getAddress } from "viem";
import {
  buildTypedData,
  hashAction,
  walletDomain,
  WalletViewSchema,
  ApprovalRequestSchema,
} from "@mandate/schema";
import { notifyOwner, transaction } from "@mandate/platform";
import {
  reserve,
  ReservationDenied,
} from "../../../worker/src/reservations.js";
import { approvalGate } from "../../../worker/src/approvals.js";
import {
  admin,
  apiEnvironment,
  insertTask,
  ownerA,
  ownerB,
} from "./support.js";

after(() => admin.end());
const deviceId = "0x" + "de".repeat(32);
const DUSD = "0xe030717a657e9194bc086a546fb59adbc631ad7a";
const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

async function setup() {
  const e = await apiEnvironment({
    clock: () => Math.floor(Date.now() / 1000),
  });
  const owner = await e.login(ownerA);
  const walletId = WalletViewSchema.parse(
    (await e.call("POST", "/v1/wallets", owner, {})).json(),
  ).walletId;
  const wallet = getAddress("0x" + randomBytes(20).toString("hex"));
  await e.pool.query(
    "UPDATE wallets SET wallet_address=$2,deployment_block=1 WHERE id=$1",
    [walletId, wallet.toLowerCase()],
  );
  const taskId = await insertTask(e.pool, walletId, e.now());
  const permitId = "0x" + randomBytes(32).toString("hex");
  const draftId = randomUUID();
  await e.pool.query(
    "INSERT INTO permit_drafts(id,wallet_id,task_id,typed_data,scope,digest,permit_id,nonce,epoch,state,expires_at,created_at) VALUES($1,$2,$3,'{}','{}',$4,$4,1,0,'ACTIVATED',$5,$5)",
    [draftId, walletId, taskId, permitId, e.now()],
  );
  await e.pool.query(
    "INSERT INTO permits(permit_id,wallet_id,task_id,draft_id,permit,owner_signature,authority_state,spend_cap,period_cap,period_seconds,max_payment,created_at) VALUES($1,$2,$3,$4,'{\"reviewThreshold\":\"100000\"}',$5,'ACTIVE',2000000,0,0,500000,$6)",
    [permitId, walletId, taskId, draftId, "0x" + "11".repeat(65), e.now()],
  );
  const action = async (amount: bigint, asset = DUSD) => {
    const id = randomUUID();
    const now = e.now();
    const a = {
      permitId,
      requestId: "0x" + randomBytes(32).toString("hex"),
      operation: 0,
      target: "0x" + "33".repeat(20),
      amount: amount.toString(),
      minOutput: "0",
      invoiceId: "0x" + randomBytes(32).toString("hex"),
      inputHash: "0x" + randomBytes(32).toString("hex"),
      period: 0,
      issuedAt: String(now),
      deadline: String(now + 600),
    };
    const digest = hashAction(a, walletDomain(wallet));
    await e.pool.query(
      "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,$10,$11,'RESERVED',$12,$12)",
      [
        id,
        taskId,
        walletId,
        permitId,
        "k" + id,
        a.requestId,
        a.invoiceId,
        asset,
        amount.toString(),
        a,
        digest,
        now,
      ],
    );
    await e.pool.query(
      "INSERT INTO reservations(action_id,wallet_id,permit_id,asset,kind,amount,chain_day,state,created_at,updated_at) VALUES($1,$2,$3,$4,'OUTFLOW',$5,1,'RESERVED',$6,$6)",
      [id, walletId, permitId, asset, amount.toString(), now],
    );
    return { id, digest, deadline: BigInt(a.deadline), requestId: a.requestId };
  };
  const gate = (x: Awaited<ReturnType<typeof action>>, amount: bigint) =>
    transaction(e.pool, (c) =>
      approvalGate(
        c,
        {
          id: x.id,
          walletId,
          taskId,
          owner: ownerA.address.toLowerCase(),
          digest: x.digest,
          amount,
          deadline: x.deadline,
          permitThreshold: 100000n,
          requestId: x.requestId,
          permitId,
        },
        null,
        e.now(),
      ),
    );
  return { e, owner, walletId, wallet, taskId, permitId, action, gate };
}

test("P2-A02.T01/T02/T03 above-threshold Action waits for the owner; wrong digest or expiry is refused; rejection releases", async () => {
  const s = await setup();
  try {
    const small = await s.action(50_000n);
    assert.equal(await s.gate(small, 50_000n), "PROCEED");
    const big = await s.action(200_000n);
    assert.equal(await s.gate(big, 200_000n), "WAIT");
    assert.equal(await s.gate(big, 200_000n), "WAIT");
    assert.equal(
      (await s.e.pool.query("SELECT state FROM actions WHERE id=$1", [big.id]))
        .rows[0].state,
      "AWAITING_APPROVAL",
    );
    assert.equal(
      (await s.e.pool.query("SELECT 1 FROM signing_attempts")).rowCount,
      0,
    );
    const list = (await s.e.call("GET", "/v1/approvals", s.owner)).json() as {
      items: unknown[];
    };
    assert.equal(list.items.length, 1);
    const approval = ApprovalRequestSchema.parse(list.items[0]);
    assert.equal(approval.rationaleUntrusted, true);
    // Signature over another digest is refused.
    const wrong = await ownerA.signTypedData(
      buildTypedData(
        "Approval",
        { actionDigest: "0x" + "99".repeat(32), expiresAt: approval.expiresAt },
        approval.typedData.domain,
      ) as never,
    );
    assert.equal(
      (
        await s.e.call(
          "POST",
          `/v1/approvals/${approval.approvalId}/sign`,
          s.owner,
          { ownerSignature: wrong },
        )
      ).statusCode,
      422,
    );
    const byOther = await ownerB.signTypedData(
      buildTypedData(
        "Approval",
        approval.typedData.message,
        approval.typedData.domain,
      ) as never,
    );
    assert.equal(
      (
        await s.e.call(
          "POST",
          `/v1/approvals/${approval.approvalId}/sign`,
          s.owner,
          { ownerSignature: byOther },
        )
      ).statusCode,
      422,
    );
    const good = await ownerA.signTypedData(
      buildTypedData(
        "Approval",
        approval.typedData.message,
        approval.typedData.domain,
      ) as never,
    );
    assert.equal(
      (
        await s.e.call(
          "POST",
          `/v1/approvals/${approval.approvalId}/sign`,
          await s.e.login(ownerB),
          { ownerSignature: good },
        )
      ).statusCode,
      403,
    );
    const signed = await s.e.call(
      "POST",
      `/v1/approvals/${approval.approvalId}/sign`,
      s.owner,
      { ownerSignature: good },
    );
    assert.deepEqual(signed.json(), { state: "APPROVED" });
    assert.equal(await s.gate(big, 200_000n), "PROCEED");

    const rejected = await s.action(300_000n);
    await s.gate(rejected, 300_000n);
    const id = (
      await s.e.pool.query(
        "SELECT approval_id FROM approval_requests WHERE action_id=$1",
        [rejected.id],
      )
    ).rows[0].approval_id;
    assert.deepEqual(
      (
        await s.e.call("POST", `/v1/approvals/${id}/reject`, s.owner, {})
      ).json(),
      { state: "REJECTED" },
    );
    assert.equal(await s.gate(rejected, 300_000n), "REJECTED");
    const row = (
      await s.e.pool.query(
        "SELECT a.state,r.state AS r,r.release_reason FROM actions a JOIN reservations r ON r.action_id=a.id WHERE a.id=$1",
        [rejected.id],
      )
    ).rows[0];
    assert.deepEqual(row, {
      state: "REJECTED",
      r: "RELEASED",
      release_reason: "REJECTED",
    });
    const types = (
      await s.e.pool.query(
        "SELECT type FROM evidence_events WHERE task_id=$1 ORDER BY sequence",
        [s.taskId],
      )
    ).rows.map((r) => r.type);
    assert.deepEqual(types, [
      "APPROVAL_REQUESTED",
      "APPROVAL_REQUESTED",
      "OWNER_REJECTION",
    ]);
    // An approval cannot be signed after it expires.
    const late = await s.action(250_000n);
    await s.gate(late, 250_000n);
    await s.e.pool.query(
      "UPDATE approval_requests SET expires_at=$2 WHERE action_id=$1",
      [late.id, Math.floor(Date.now() / 1000) - 1],
    );
    const lateId = (
      await s.e.pool.query(
        "SELECT approval_id FROM approval_requests WHERE action_id=$1",
        [late.id],
      )
    ).rows[0].approval_id;
    assert.equal(
      (
        await s.e.call("POST", `/v1/approvals/${lateId}/sign`, s.owner, {
          ownerSignature: good,
        })
      ).statusCode,
      409,
    );
    assert.equal(await s.gate(late, 250_000n), "REJECTED");
  } finally {
    await s.e.close();
  }
});

test("P2-A02.T07 agent tokens cannot reach approval, policy, admin, push or inhibit routes", async () => {
  const s = await setup();
  try {
    const agent =
      "Bearer " +
      (
        (
          await s.e.call("POST", "/v1/agent-tokens", s.owner, {
            walletId: s.walletId,
            taskId: null,
            scopes: ["read", "prepare", "run", "evidence"],
            expiresAt: String(s.e.now() + 3600),
          })
        ).json() as { token: string }
      ).token;
    for (const [method, path, body] of [
      ["GET", "/v1/approvals", undefined],
      ["POST", `/v1/approvals/${randomUUID()}/reject`, {}],
      [
        "POST",
        `/v1/wallets/${s.walletId}/policy/draft`,
        {
          policy: { reviewThreshold: "1" },
          lists: {
            assetCaps: [{ asset: DUSD, perTx: "1", daily: "1", weekly: "1" }],
            allowlist: [],
            blocklist: [],
            templates: [],
          },
        },
      ],
      [
        "POST",
        `/v1/wallets/${s.walletId}/admin/draft`,
        { command: 5, permitId: "0x" + "00".repeat(32) },
      ],
      [
        "POST",
        "/v1/devices/push",
        { deviceId, platform: "android", pushToken: "t".repeat(32) },
      ],
      [
        "POST",
        `/v1/wallets/${s.walletId}/inhibit/clear`,
        { alertId: randomUUID() },
      ],
    ] as const)
      assert.equal(
        (await s.e.call(method, path, agent, body)).statusCode,
        403,
        path,
      );
  } finally {
    await s.e.close();
  }
});

test("P2-A02 push registration is bound to the session device, removed on logout, and reports unsupported delivery", async () => {
  const s = await setup();
  try {
    assert.equal(
      (
        await s.e.call("POST", "/v1/devices/push", s.owner, {
          deviceId: "0x" + "ab".repeat(32),
          platform: "ios",
          pushToken: "t".repeat(32),
        })
      ).statusCode,
      403,
    );
    assert.deepEqual(
      (
        await s.e.call("POST", "/v1/devices/push", s.owner, {
          deviceId,
          platform: "android",
          pushToken: "t".repeat(32),
        })
      ).json(),
      { registered: true },
    );
    const owner = ownerA.address.toLowerCase();
    assert.equal(
      await notifyOwner(
        s.e.pool,
        null,
        owner,
        "APPROVAL",
        randomUUID(),
        s.e.now(),
      ),
      "UNSUPPORTED",
    );
    const sent: unknown[] = [];
    assert.equal(
      await notifyOwner(
        s.e.pool,
        async (_d, payload) => void sent.push(payload),
        owner,
        "ALERT",
        randomUUID(),
        s.e.now(),
      ),
      "SENT",
    );
    assert.deepEqual(Object.keys(sent[0] as object).sort(), ["id", "kind"]);
    assert.equal(
      (await s.e.call("POST", "/v1/auth/logout", s.owner, {})).statusCode,
      200,
    );
    assert.equal(
      (await s.e.pool.query("SELECT 1 FROM push_devices")).rowCount,
      0,
    );
    assert.equal(
      await notifyOwner(
        s.e.pool,
        null,
        owner,
        "ALERT",
        randomUUID(),
        s.e.now(),
      ),
      "NO_DEVICE",
    );
  } finally {
    await s.e.close();
  }
});

test("P2-A03.T04 only the owner with a fresh signed login clears an inhibit", async () => {
  const e = await apiEnvironment();
  try {
    const owner = await e.login(ownerA);
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", owner, {})).json(),
    ).walletId;
    const alertId = randomUUID();
    await e.pool.query(
      "INSERT INTO financial_alerts(id,wallet_id,kind,details,created_at) VALUES($1,$2,'RISK','{}',$3)",
      [alertId, walletId, e.now()],
    );
    await e.pool.query("UPDATE wallets SET inhibited=true WHERE id=$1", [
      walletId,
    ]);
    const clear = (auth: string) =>
      e.call("POST", `/v1/wallets/${walletId}/inhibit/clear`, auth, {
        alertId,
      });
    assert.equal((await clear(await e.login(ownerB))).statusCode, 403);
    e.advance(301);
    const stale = await clear(owner);
    assert.equal(stale.statusCode, 401);
    assert.equal(stale.json().code, "REAUTH_REQUIRED");
    assert.equal(
      (
        await e.pool.query("SELECT inhibited FROM wallets WHERE id=$1", [
          walletId,
        ])
      ).rows[0].inhibited,
      true,
    );
    assert.deepEqual((await clear(await e.login(ownerA))).json(), {
      inhibited: false,
    });
    assert.equal(
      (
        await e.pool.query("SELECT inhibited FROM wallets WHERE id=$1", [
          walletId,
        ])
      ).rows[0].inhibited,
      false,
    );
  } finally {
    await e.close();
  }
});

test("P2-A02.T06 DemoUSD and USDC reservations are independent", async () => {
  const s = await setup();
  try {
    const limits = {
      maxPayment: 500_000n,
      spendCap: 10_000_000n,
      dailyCap: 500_000n,
      liquidFloor: 0n,
    };
    const chain = {
      day: 1n,
      permitGross: 0n,
      walletDayGross: 0n,
      liquid: 1_000_000n,
    };
    const tryReserve = (id: string, asset: string, amount: bigint) =>
      transaction(s.e.pool, (c) =>
        reserve(
          c,
          {
            actionId: id,
            walletId: s.walletId,
            permitId: s.permitId,
            asset,
            kind: "OUTFLOW",
            amount,
          },
          chain,
          limits,
          s.e.now(),
        ),
      ).then(
        () => "OK",
        (e) => (e instanceof ReservationDenied ? e.code : Promise.reject(e)),
      );
    const mk = async (asset: string) => {
      const id = randomUUID();
      await s.e.pool.query(
        "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,1,0,'{}',$9,'PROPOSED',1,1)",
        [
          id,
          s.taskId,
          s.walletId,
          s.permitId,
          "k" + id,
          "0x" + randomBytes(32).toString("hex"),
          "0x" + randomBytes(32).toString("hex"),
          asset,
          "0x" + randomBytes(32).toString("hex"),
        ],
      );
      return id;
    };
    const [d1, u1, d2] = [await mk(DUSD), await mk(USDC), await mk(DUSD)];
    assert.deepEqual(
      await Promise.all([
        tryReserve(d1, DUSD, 400_000n),
        tryReserve(u1, USDC, 400_000n),
      ]),
      ["OK", "OK"],
    );
    assert.equal(await tryReserve(d2, DUSD, 200_000n), "DAILY_CAP");
  } finally {
    await s.e.close();
  }
});
