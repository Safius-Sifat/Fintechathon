import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encodeFunctionData, getAddress, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  ApiErrorSchema,
  buildTypedData,
  mandateWalletAbi,
  OwnerApprovalSchema,
  TaskViewSchema,
  walletFactoryAbi,
  WalletViewSchema,
  ZERO_HASH,
  ZERO_SCHEDULE,
  type RunbookDecision,
} from "@mandate/schema";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import { testManifest } from "../../../../services/policy/test/db/fixture.js";
import { admin, apiEnvironment, ownerA } from "./support.js";
import { anvilAccount, forkChain } from "../../../worker/test/db/support.js";
import { DEFAULT_BUDGETS, Relayer } from "../../../worker/src/relayer.js";
import { OwnerCommandRelay } from "../../../worker/src/owner-commands.js";
import { activatePermit, advanceTask } from "../../../worker/src/advance.js";
import { ControlService } from "../../src/business/controls.js";
import { TaskService } from "../../src/business/tasks.js";

const FACTORY = getAddress(deployment.contracts.factory.address);
const DUSD = getAddress(deployment.contracts.token.address);
// prepareTask binds provider a to this recipient.
const PROVIDER_A = getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
let chain: Awaited<ReturnType<typeof forkChain>>;
before(async () => {
  chain = await forkChain();
});
after(async () => {
  await chain?.close();
  await admin.end();
});
const now = () => Math.floor(Date.now() / 1000);

async function send(to: Hex, data: Hex) {
  const sender = anvilAccount(5);
  const fees = await chain.client.estimateFeesPerGas();
  await chain.client.sendRawTransaction({
    serializedTransaction: await sender.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to,
      data,
      nonce: await chain.client.getTransactionCount({
        address: sender.address,
        blockTag: "pending",
      }),
      gas: 6_000_000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    }),
  });
  await chain.mine(1);
}

test("P2-03/P2-04 task create, owner Permit draft and activation on chain, run, and one Action per decision", async () => {
  // Fixture runbook manifest with non-zero artifact hashes stands in for a built release.
  const fixture = testManifest(PROVIDER_A);
  const built = {
    ...fixture,
    runbooks: [
      ...fixture.runbooks,
      { ...fixture.runbooks[0]!, runbookId: "commerce-buy" as const },
    ],
  };
  const unbuilt = {
    ...built,
    runbooks: built.runbooks.map((r) => ({
      ...r,
      entryArtifactHash: ZERO_HASH,
    })),
  };
  const e = await apiEnvironment({
    clock: now,
    business: {
      chain: {
        client: chain.client,
        assets: [{ address: DUSD, symbol: "DUSD" }],
      },
      manifest: built,
    },
  });
  try {
    const auth = await e.login(ownerA);
    const walletId = WalletViewSchema.parse(
      (await e.call("POST", "/v1/wallets", auth, {})).json(),
    ).walletId;
    if (
      /^0x0{40}$/i.test(
        await chain.client.readContract({
          address: FACTORY,
          abi: walletFactoryAbi,
          functionName: "walletForOwner",
          args: [ownerA.address],
        }),
      )
    )
      await send(
        FACTORY,
        encodeFunctionData({
          abi: walletFactoryAbi,
          functionName: "createWallet",
          args: [ownerA.address],
        }),
      );
    const wallet = await chain.client.readContract({
      address: FACTORY,
      abi: walletFactoryAbi,
      functionName: "walletForOwner",
      args: [ownerA.address],
    });
    const executor = privateKeyToAccount(generatePrivateKey());
    // Provisioning is covered elsewhere; the wallet row is marked READY with a test executor.
    await e.pool.query(
      "UPDATE wallets SET provisioning_state='READY',wallet_address=$2,deployment_block=$3,code_hash=$4,mpc_wallet_id=gen_random_uuid(),executor_address=$5,executor_public_key=$6,key_version=1 WHERE id=$1",
      [
        walletId,
        wallet.toLowerCase(),
        deployment.contracts.factory.deploymentBlock,
        "0x" + "11".repeat(32),
        executor.address.toLowerCase(),
        executor.publicKey.toLowerCase(),
      ],
    );
    const relayer = new Relayer(
      e.pool,
      chain.client,
      84532,
      {
        normal: { account: anvilAccount(8), ...DEFAULT_BUDGETS.normal },
        emergency: { account: anvilAccount(7), ...DEFAULT_BUDGETS.emergency },
      },
      now,
    );
    await relayer.register();
    // Owner-signed WalletPolicy with a DemoUSD cap, relayed and confirmed.
    const principal = {
      kind: "owner" as const,
      owner: ownerA.address.toLowerCase(),
      session: {
        sessionId: crypto.randomUUID(),
        ownerAddress: ownerA.address.toLowerCase(),
        deviceId: "0x" + "de".repeat(32),
        authTime: now(),
      },
    };
    const controls = new ControlService(e.pool, chain.client, now);
    const draft = await controls.policyDraft(principal, walletId, {
      policy: { reviewThreshold: "500000" },
      lists: {
        assetCaps: [
          { asset: DUSD, perTx: "400000", daily: "1000000", weekly: "5000000" },
        ],
        allowlist: [],
        blocklist: [],
        templates: [],
      },
    });
    const typed = draft.typedData as { message: unknown; domain: unknown };
    await controls.submitCommand(principal, walletId, "POLICY", {
      draftId: draft.draftId,
      ownerSignature: await ownerA.signTypedData(
        buildTypedData("WalletPolicy", typed.message, typed.domain) as never,
      ),
    });
    const commands = new OwnerCommandRelay(e.pool, chain.client, relayer, now);
    for (
      let i = 0;
      i < 10 && (await commands.advance(draft.draftId)) !== "INCLUDED";
      i++
    )
      await chain.mine(1);

    const created = await e.call("POST", "/v1/tasks", auth, {
      walletId,
      runbookId: "browser-check",
      goal: "Check the checkout page",
      input: {
        targetId: "checkout-healthy",
        checks: ["pageLoad", "title"],
        maxPaidAttempts: 1,
        maxSteps: 4,
        taskDeadline: String(now() + 3600),
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const task = TaskViewSchema.parse(created.json());
    assert.equal(task.outcomeState, "AWAITING_OWNER");
    const bad = await e.call("POST", "/v1/tasks", auth, {
      walletId,
      runbookId: "browser-check",
      goal: "x",
      input: { targetId: "nowhere" },
    });
    assert.equal(bad.statusCode, 422);

    const terms = {
      asset: DUSD,
      startsAt: String(now()),
      expiresAt: String(now() + 3600),
      maxActions: 5,
      maxPayments: 3,
      maxPayment: "400000",
      spendCap: "1000000",
      liquidFloor: "3000000",
      depositCap: "0",
      withdrawCap: "0",
      reviewThreshold: "500000",
      periodCap: "0",
      periodSeconds: 0,
      recipients: [PROVIDER_A],
      schedule: ZERO_SCHEDULE,
      templateIds: [],
    };
    // An unbuilt runbook cannot be approved.
    await assert.rejects(
      new TaskService(e.pool, chain.client, unbuilt, now).draft(principal, {
        taskId: task.taskId,
        terms,
      }),
      (error: { code?: string }) => error.code === "RUNBOOK_VERSION",
    );
    assert.equal(
      (
        await e.call("POST", "/v1/permits/draft", auth, {
          taskId: task.taskId,
          terms: {
            ...terms,
            recipients: ["0x000000000000000000000000000000000000dEaD"],
          },
        })
      ).statusCode,
      422,
    );
    // An order may only pay the shop bound to it.
    const order = await e.call("POST", "/v1/tasks", auth, {
      walletId,
      runbookId: "commerce-buy",
      goal: "Buy the Aero Runner",
      input: {
        productId: "aero-runner",
        size: "42",
        maxAmount: "450000",
        deliveryHash: "0x" + "ab".repeat(32),
        taskDeadline: String(now() + 3600),
      },
    });
    assert.equal(order.statusCode, 200, order.body);
    await assert.rejects(
      new TaskService(e.pool, chain.client, built, now).draft(principal, {
        taskId: TaskViewSchema.parse(order.json()).taskId,
        terms: { ...terms, maxPayments: 1, recipients: [PROVIDER_A] },
      }),
      (error: { code?: string }) => error.code === "RECIPIENT_DENIED",
    );
    const drafted = await e.call("POST", "/v1/permits/draft", auth, {
      taskId: task.taskId,
      terms,
    });
    assert.equal(drafted.statusCode, 200, drafted.body);
    const approval = OwnerApprovalSchema.parse(drafted.json());
    const signature = await ownerA.signTypedData(
      buildTypedData(
        "Permit",
        approval.typedData.message,
        approval.typedData.domain,
      ) as never,
    );
    const wrong = await privateKeyToAccount(generatePrivateKey()).signTypedData(
      buildTypedData(
        "Permit",
        approval.typedData.message,
        approval.typedData.domain,
      ) as never,
    );
    assert.equal(
      (
        await e.call("POST", "/v1/permits/activate", auth, {
          draftId: approval.draftId,
          ownerSignature: wrong,
        })
      ).statusCode,
      422,
    );
    const activated = await e.call("POST", "/v1/permits/activate", auth, {
      draftId: approval.draftId,
      ownerSignature: signature,
    });
    assert.equal(activated.statusCode, 200, activated.body);
    assert.equal(activated.json().authorityState, "PENDING");
    assert.deepEqual(
      (
        await e.call("POST", "/v1/permits/activate", auth, {
          draftId: approval.draftId,
          ownerSignature: signature,
        })
      ).json().permitId,
      activated.json().permitId,
    );
    // Not runnable before the chain confirms the Permit.
    assert.equal(
      (await e.call("POST", `/v1/tasks/${task.taskId}/run`, auth, {}))
        .statusCode,
      409,
    );
    let done = false;
    for (let i = 0; i < 10 && !done; i++) {
      done = await activatePermit(e.pool, relayer, now, approval.draftId);
      await chain.mine(1);
    }
    assert.ok(done);
    const onChain = await chain.client.readContract({
      address: wallet,
      abi: mandateWalletAbi,
      functionName: "getPermit",
      args: [activated.json().permitId],
    });
    assert.equal(onChain.activated, true);
    assert.equal(
      TaskViewSchema.parse(
        (await e.call("GET", `/v1/tasks/${task.taskId}`, auth)).json(),
      ).authorityState,
      "ACTIVE",
    );

    const run = await e.call("POST", `/v1/tasks/${task.taskId}/run`, auth, {});
    assert.equal(run.statusCode, 200, run.body);
    assert.equal(TaskViewSchema.parse(run.json()).outcomeState, "RUNNING");
    assert.equal(
      (await e.pool.query("SELECT 1 FROM jobs WHERE kind='task.advance'"))
        .rowCount,
      1,
    );
    // Runbook loop: a PROPOSE decision commits one Action per decisionKey, even on replay.
    const propose = async (
      snapshot: Parameters<Parameters<typeof advanceTask>[2]>[0],
    ): Promise<RunbookDecision> => ({
      type: "PROPOSE",
      decisionKey: "pay:a:1",
      intent: {
        operation: 0,
        target: PROVIDER_A,
        amount: "200000",
        minOutput: "0",
        invoice: null,
        providerSignature: null,
        inputHash: ("0x" + randomBytes(32).toString("hex")) as Hex,
        period: 0,
        templateId: null,
        callData: null,
      },
      evidence: [],
      nextState: { ...snapshot.runbookState, step: 1 },
    });
    for (let i = 0; i < 2; i++)
      assert.deepEqual(
        await advanceTask(
          e.pool,
          chain.client,
          propose,
          () => ({}),
          now,
          task.taskId,
        ),
        { done: true },
      );
    const actions = (
      await e.pool.query(
        "SELECT state,amount::text,decision_key FROM actions WHERE task_id=$1",
        [task.taskId],
      )
    ).rows;
    assert.deepEqual(actions, [
      { state: "PROPOSED", amount: "200000", decision_key: "pay:a:1" },
    ]);
    const err = await e.call("POST", "/v1/tasks", auth, {
      walletId: crypto.randomUUID(),
      runbookId: "browser-check",
      goal: "x",
      input: {},
    });
    assert.equal(ApiErrorSchema.parse(err.json()).code, "AUTH_SCOPE");
  } finally {
    await e.close();
  }
});
