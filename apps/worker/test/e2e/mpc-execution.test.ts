import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  recoverAddress,
  type Address,
  type Hex,
  createPublicClient,
  custom,
  http,
  toFunctionSelector,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  AdminCommand,
  authorityTypes,
  buildTypedData,
  demoUSDAbi,
  hashAction,
  hashConditions,
  hashPermit,
  hashRecipients,
  hashRunbook,
  hashSchedule,
  hashWalletPolicyLists,
  invoiceDomain,
  mandateWalletAbi,
  policyTypes,
  walletDomain,
  ZERO_HASH,
  ZERO_SCHEDULE,
} from "@mandate/schema";
import { transaction } from "@mandate/platform";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import {
  PolicyService,
  rpcChainReader,
} from "../../../../services/policy/src/authorize.js";
import { createPolicyServer } from "../../../../services/policy/src/server.js";
import {
  testManifest,
  DEMO_USD,
} from "../../../../services/policy/test/db/fixture.js";
import { DEFAULT_BUDGETS, Relayer, type Call } from "../../src/relayer.js";
import { adapterKeygen, Provisioner } from "../../src/provision.js";
import {
  adapterClient,
  Executor,
  simulationCapabilities,
} from "../../src/execution.js";
import { OwnerCommandRelay } from "../../src/owner-commands.js";
import { ControlService } from "../../../api/src/business/controls.js";
import {
  admin,
  anvilAccount,
  forkChain,
  isolatedSchema,
} from "../db/support.js";

const PRIVATE = process.env.MPC_PRIVATE_DIR;
if (!PRIVATE)
  throw new Error(
    "MPC_PRIVATE_DIR is required: the end-to-end suite needs the local MPC cluster",
  );
const root = resolve(import.meta.dirname, "../../../..");
const bin = (name: string) => join(root, ".cache/mpcium/bin", name);

let chain: Awaited<ReturnType<typeof forkChain>>;
let db: Awaited<ReturnType<typeof isolatedSchema>>;
let secrets: string;
const processes: { name: string; child: ChildProcess; log: string[] }[] = [];
const closers: (() => Promise<unknown>)[] = [];

const nowSeconds = () => Math.floor(Date.now() / 1000);
const token = () => randomBytes(32).toString("base64url");

async function secretFile(name: string, value: string) {
  const path = join(secrets, name);
  await writeFile(path, value, { mode: 0o600 });
  return path;
}

function start(name: string, env: Record<string, string>) {
  const log: string[] = [];
  const child = spawn(bin(name), [], {
    env: { PATH: process.env.PATH ?? "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout!, child.stderr!])
    stream.on("data", (d) => log.push(String(d)));
  processes.push({ name, child, log });
}

async function waitHttp(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("service did not start: " + url);
}

// ABI tuple values from the shared EIP-712 field lists (uint8..uint48 are numbers).
function abiStruct(
  fields: readonly { name: string; type: string }[],
  value: Record<string, unknown>,
) {
  return Object.fromEntries(
    fields.map(({ name, type }) => {
      const bits = type.startsWith("uint") ? Number(type.slice(4)) : 0;
      const v = value[name];
      return [
        name,
        bits === 0 ? v : bits <= 48 ? Number(v) : BigInt(v as string),
      ];
    }),
  );
}

before(async () => {
  secrets = await mkdtemp(join(tmpdir(), "mandate-e2e-"));
  chain = await forkChain({ blockTime: 2 });
  db = await isolatedSchema("e2e");
});
after(async () => {
  for (const close of closers.reverse()) await close();
  for (const p of processes) p.child.kill("SIGTERM");
  await chain?.close();
  await db?.drop();
  await admin.end();
  await rm(secrets, { recursive: true, force: true });
});

test("P2-02/P2-04 end to end: per-wallet DKG, owner-signed policy and Permit, threshold-signed PAY relayed once; tampered action denied", async () => {
  const transport = JSON.parse(
    await readFile(join(PRIVATE, "transport.json"), "utf8"),
  ) as { natsPassword: string };
  const initiatorPublic = (
    JSON.parse(
      await readFile(
        join(PRIVATE, "initiator/mandate-adapter-a.identity.json"),
        "utf8",
      ),
    ) as { public_key: string }
  ).public_key;
  const policyToken = token();
  const authorizerToken = token();
  const adapterToken = token();
  const schema = (
    await db.pool.query<{ s: string }>("SELECT current_schema() AS s")
  ).rows[0]!.s;

  // Policy service, in process, with its own RPC view of the fork.
  const providerKey = privateKeyToAccount(generatePrivateKey());
  const manifest = testManifest(providerKey.address);
  const policy = createPolicyServer(
    new PolicyService(
      db.pool,
      manifest,
      rpcChainReader(chain.client),
      nowSeconds,
    ),
    policyToken,
  );
  const policyUrl = await policy.listen({ host: "127.0.0.1", port: 0 });
  closers.push(() => policy.close());

  start("mandate-authorizer", {
    AUTHORIZER_LISTEN: "127.0.0.1:18731",
    AUTHORIZER_INITIATOR_PUBLIC_KEY: initiatorPublic,
    AUTHORIZER_KEY_FILE: join(
      PRIVATE,
      "authorizer/mandate-policy-v1.authorizer.key.age",
    ),
    AUTHORIZER_KEY_PASSWORD_FILE: join(PRIVATE, "authorizer/password"),
    POLICY_URL: policyUrl,
    POLICY_INTERNAL_TOKEN_FILE: await secretFile("policy-token", policyToken),
    AUTHORIZER_INTERNAL_TOKEN_FILE: await secretFile(
      "authorizer-token",
      authorizerToken,
    ),
  });
  const dbUrl = new URL(process.env.TEST_DATABASE_URL!);
  dbUrl.searchParams.set("sslmode", "verify-full");
  dbUrl.searchParams.set("sslrootcert", process.env.TEST_DATABASE_CA!);
  dbUrl.searchParams.set("search_path", schema);
  start("mandate-adapter", {
    ADAPTER_LISTEN: "127.0.0.1:18732",
    ADAPTER_LOCK_FILE: join(PRIVATE, "mandate-adapter-a.lock"),
    ADAPTER_DATABASE_URL: dbUrl.toString(),
    NATS_URL: "tls://127.0.0.1:14222",
    NATS_USER: "mandate",
    NATS_PASSWORD_FILE: await secretFile(
      "nats-password",
      transport.natsPassword,
    ),
    NATS_TLS_DIR: join(PRIVATE, "tls"),
    INITIATOR_KEY_FILE: join(PRIVATE, "initiator/mandate-adapter-a.key.age"),
    INITIATOR_KEY_PASSWORD_FILE: join(PRIVATE, "initiator/password"),
    AUTHORIZER_URL: "http://127.0.0.1:18731",
    AUTHORIZER_INTERNAL_TOKEN_FILE: await secretFile(
      "authorizer-token-client",
      authorizerToken,
    ),
    ADAPTER_INTERNAL_TOKEN_FILE: await secretFile(
      "adapter-token",
      adapterToken,
    ),
    ADAPTER_SESSION_TIMEOUT: "3m",
  });
  await waitHttp("http://127.0.0.1:18731/");
  await waitHttp("http://127.0.0.1:18732/");

  const relayer = new Relayer(
    db.pool,
    chain.client,
    84532,
    {
      normal: { account: anvilAccount(8), ...DEFAULT_BUDGETS.normal },
      emergency: { account: anvilAccount(7), ...DEFAULT_BUDGETS.emergency },
    },
    nowSeconds,
  );
  await relayer.register();
  const relay = async (call: Call, purpose: "POLICY" | "ACTIVATE") => {
    const quote = await relayer.quote("normal", call);
    const tx = await transaction(db.pool, (c) =>
      relayer.journal(c, "normal", call, quote, {
        purpose,
        actionId: null,
        payload: {},
      }),
    );
    await relayer.broadcast(tx.id);
    for (let i = 0; i < 20; i++) {
      await chain.mine(1);
      const { tx: done } = await relayer.reconcile(tx.id);
      if (done.state === "INCLUDED" || done.state === "FINALIZED") return;
      if (done.state === "REVERTED") throw new Error(purpose + " reverted");
    }
    throw new Error(purpose + " not included");
  };

  // 1. Provisioning: factory deployment and a real per-wallet DKG.
  const owner = privateKeyToAccount(generatePrivateKey());
  const walletId = randomUUID();
  const t0 = nowSeconds();
  await db.pool.query(
    "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
    [owner.address.toLowerCase(), t0],
  );
  await db.pool.query(
    "INSERT INTO wallets(id,owner_address,provisioning_state,created_at,updated_at) VALUES($1,$2,'DEPLOYING',$3,$3)",
    [walletId, owner.address.toLowerCase(), t0],
  );
  const factory = {
    address: getAddress(deployment.contracts.factory.address),
    deploymentBlock: deployment.contracts.factory.deploymentBlock,
    codeHash: deployment.contracts.factory.codeHash as Hex,
  };
  const provisioner = new Provisioner(
    db.pool,
    chain.client,
    relayer,
    factory,
    adapterKeygen("http://127.0.0.1:18732", adapterToken),
    nowSeconds,
  );
  const dkgStart = Date.now();
  let provisioned = await provisioner.step(walletId);
  for (
    let i = 0;
    i < 120 && provisioned.state !== "READY" && provisioned.state !== "FAILED";
    i++
  ) {
    await chain.mine(1);
    await new Promise((r) => setTimeout(r, 500));
    provisioned = await provisioner.step(walletId);
  }
  const wallet = (
    await db.pool.query("SELECT * FROM wallets WHERE id=$1", [walletId])
  ).rows[0];
  assert.equal(
    provisioned.state,
    "READY",
    wallet.failure_reason ?? JSON.stringify(provisioned),
  );
  const walletAddress = getAddress(wallet.wallet_address);
  const executor = getAddress(wallet.executor_address);
  const keygen = (
    await db.pool.query(
      "SELECT state,public_key FROM mpc_keygen WHERE mpc_wallet_id=$1",
      [wallet.mpc_wallet_id],
    )
  ).rows[0];
  assert.equal(keygen.state, "DONE");
  assert.equal(keygen.public_key, wallet.executor_public_key);
  const dkgMs = Date.now() - dkgStart;
  const domain = walletDomain(walletAddress);

  // 2. Owner-signed WalletPolicy with a DemoUSD cap, then funding.
  const lists = {
    assetCaps: [
      { asset: DEMO_USD, perTx: "400000", daily: "1000000", weekly: "5000000" },
    ],
    allowlist: [],
    blocklist: [],
    templates: [],
  };
  const tPolicy = nowSeconds();
  const walletPolicy = {
    version: "1",
    ...hashWalletPolicyLists(lists),
    reviewThreshold: "500000",
    nonce: (
      await chain.client.readContract({
        address: walletAddress,
        abi: mandateWalletAbi,
        functionName: "policyNonce",
      })
    ).toString(),
    issuedAt: String(tPolicy - 5),
    deadline: String(tPolicy + 600),
  };
  const policySignature = await owner.signTypedData(
    buildTypedData("WalletPolicy", walletPolicy, domain) as never,
  );
  await relay(
    {
      to: walletAddress,
      data: encodeFunctionData({
        abi: mandateWalletAbi,
        functionName: "applyWalletPolicy",
        args: [
          abiStruct(policyTypes.WalletPolicy, walletPolicy),
          lists.assetCaps.map((c) => abiStruct(policyTypes.AssetCap, c)),
          [],
          [],
          [],
          policySignature,
        ] as never,
      }),
      value: 0n,
    },
    "POLICY",
  );
  const funder = anvilAccount(9);
  const fees = await chain.client.estimateFeesPerGas();
  await chain.client.sendRawTransaction({
    serializedTransaction: await funder.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to: DEMO_USD,
      data: encodeFunctionData({
        abi: demoUSDAbi,
        functionName: "faucet",
        args: [walletAddress],
      }),
      nonce: await chain.client.getTransactionCount({
        address: funder.address,
        blockTag: "pending",
      }),
      gas: 200_000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    }),
  });
  await chain.mine(2);
  const balanceOf = (holder: Address) =>
    chain.client.readContract({
      address: DEMO_USD,
      abi: demoUSDAbi,
      functionName: "balanceOf",
      args: [holder],
    });
  assert.ok((await balanceOf(walletAddress)) >= 1_000_000n);

  // 3. Owner-signed Permit activated on chain and recorded as ACTIVE.
  const runbook = manifest.runbooks.find(
    (r) => r.runbookId === "browser-check",
  )!;
  const tPermit = nowSeconds();
  const conditions = {
    schemaVersion: 4,
    runbookId: "browser-check",
    browser: {
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title"],
      providerIds: ["a"],
      maxPaidAttempts: 1,
      maxSteps: 4,
      taskDeadline: String(tPermit + 3600),
      resultMaxAgeSeconds: 300,
    },
    liquidity: null,
    schedule: null,
    allowance: null,
    calls: null,
  };
  const chainTaskId = ("0x" + randomBytes(32).toString("hex")) as Hex;
  const permit = {
    taskId: chainTaskId,
    executor,
    kind: 0,
    asset: DEMO_USD,
    runbookHash: hashRunbook(runbook),
    conditionsHash: hashConditions(conditions),
    recipientsHash: hashRecipients([providerKey.address]),
    scheduleHash: hashSchedule(ZERO_SCHEDULE),
    templatesHash: ZERO_HASH,
    issuedAt: String(tPermit - 10),
    startsAt: String(tPermit - 10),
    expiresAt: String(tPermit + 3600),
    epoch: (
      await chain.client.readContract({
        address: walletAddress,
        abi: mandateWalletAbi,
        functionName: "authorityEpoch",
      })
    ).toString(),
    nonce: (
      await chain.client.readContract({
        address: walletAddress,
        abi: mandateWalletAbi,
        functionName: "permitNonce",
      })
    ).toString(),
    maxActions: 5,
    maxPayments: 3,
    maxPayment: "400000",
    spendCap: "1000000",
    // Contract minimum for Browser Permits (MIN_LIQUID_FLOOR).
    liquidFloor: "3000000",
    depositCap: "0",
    withdrawCap: "0",
    reviewThreshold: "500000",
    periodCap: "0",
    periodSeconds: 0,
  };
  const permitId = hashPermit(permit);
  const ownerSignature = await owner.signTypedData(
    buildTypedData("Permit", permit, domain) as never,
  );
  await relay(
    {
      to: walletAddress,
      data: encodeFunctionData({
        abi: mandateWalletAbi,
        functionName: "activatePermit",
        args: [
          abiStruct(authorityTypes.Permit, permit),
          [providerKey.address],
          abiStruct(authorityTypes.Schedule, ZERO_SCHEDULE),
          [],
          ownerSignature,
        ] as never,
      }),
      value: 0n,
    },
    "ACTIVATE",
  );
  const taskId = randomUUID();
  const draftId = randomUUID();
  const scope = {
    conditions,
    runbookManifest: runbook,
    providerBindings: [{ providerId: "a", recipient: providerKey.address }],
  };
  await db.pool.query(
    "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,runbook_state,created_at,updated_at) VALUES($1,$2,$3,'browser-check','e2e','{}','RUNNING','ACTIVE','{\"schemaVersion\":4}',$4,$4)",
    [taskId, chainTaskId, walletId, tPermit],
  );
  await db.pool.query(
    "INSERT INTO permit_drafts(id,wallet_id,task_id,typed_data,scope,digest,permit_id,nonce,epoch,state,expires_at,created_at) VALUES($1,$2,$3,'{}',$4,$5,$6,$7,$8,'ACTIVATED',$9,$9)",
    [
      draftId,
      walletId,
      taskId,
      scope,
      ZERO_HASH,
      permitId,
      permit.nonce,
      permit.epoch,
      tPermit,
    ],
  );
  await db.pool.query(
    "INSERT INTO permits(permit_id,wallet_id,task_id,draft_id,permit,owner_signature,authority_state,spend_cap,period_cap,period_seconds,max_payment,created_at) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,0,0,$8,$9)",
    [
      permitId,
      walletId,
      taskId,
      draftId,
      permit,
      ownerSignature,
      permit.spendCap,
      permit.maxPayment,
      tPermit,
    ],
  );

  // 4. A provider-invoiced PAY committed by ID only.
  const proposeAction = async (amount: string, decisionKey: string) => {
    const t = nowSeconds();
    const inputHash = ("0x" + randomBytes(32).toString("hex")) as Hex;
    const invoice = {
      invoiceId: ("0x" + randomBytes(32).toString("hex")) as Hex,
      taskId: chainTaskId,
      wallet: walletAddress,
      asset: DEMO_USD,
      recipient: providerKey.address,
      amount,
      inputHash,
      issuedAt: String(t - 5),
      expiresAt: String(t + 50),
    };
    const providerSignature = await providerKey.signTypedData(
      buildTypedData("Invoice", invoice, invoiceDomain(walletAddress)) as never,
    );
    const action = {
      permitId,
      requestId: ("0x" + randomBytes(32).toString("hex")) as Hex,
      operation: 0,
      target: providerKey.address,
      amount,
      minOutput: "0",
      invoiceId: invoice.invoiceId,
      inputHash,
      period: 0,
      issuedAt: String(t - 5),
      deadline: String(t + 50),
    };
    const id = randomUUID();
    await db.pool.query(
      "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,invoice,provider_signature,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,$10,$11,$12,$13,'PROPOSED',$14,$14)",
      [
        id,
        taskId,
        walletId,
        permitId,
        decisionKey,
        action.requestId,
        invoice.invoiceId,
        DEMO_USD.toLowerCase(),
        amount,
        action,
        hashAction(action, domain),
        invoice,
        providerSignature,
        t,
      ],
    );
    return { id, action, invoice, providerSignature };
  };
  // The executor's RPC counts post-sign execute simulations and can drop them.
  const executeSelector = toFunctionSelector(
    mandateWalletAbi.find(
      (x) => x.type === "function" && x.name === "execute",
    )!,
  );
  const upstream = http(chain.rpcUrl, { retryCount: 0 })({});
  const simulation = { calls: 0, failNext: 0 };
  const executorClient = createPublicClient({
    transport: custom(
      {
        request: async ({ method, params }) => {
          if (method === "eth_maxPriorityFeePerGas") return "0xf4240";
          const call =
            method === "eth_call" ? (params as [{ data?: string }])[0] : null;
          if (call?.data?.startsWith(executeSelector)) {
            simulation.calls++;
            if (simulation.failNext > 0) {
              simulation.failNext--;
              throw new Error("upstream RPC timeout");
            }
          }
          return upstream.request({ method, params });
        },
      },
      { retryCount: 0 },
    ),
  });
  const executorService = new Executor(
    db.pool,
    executorClient,
    relayer,
    adapterClient("http://127.0.0.1:18732", adapterToken),
    nowSeconds,
  );
  const drive = async (id: string, until: string[]) => {
    let state = "";
    for (let i = 0; i < 240 && !until.includes(state); i++) {
      state = await executorService.advance(id);
      if (until.includes(state)) break;
      if (state === "SUBMITTED") await chain.mine(1);
      await new Promise((r) => setTimeout(r, 250));
    }
    return state;
  };

  const providerBefore = await balanceOf(providerKey.address);
  // P2-A03.T05: the first post-sign simulation hits an RPC outage.
  simulation.failNext = 1;
  const pay = await proposeAction("200000", "pay:1");
  const signStart = Date.now();
  const final = await drive(pay.id, [
    "INCLUDED",
    "FINALIZED",
    "DENIED",
    "REVERTED",
  ]);
  const signMs = Date.now() - signStart;
  const row = (
    await db.pool.query(
      "SELECT a.state,a.denial_code,a.tx_hash,r.state AS reservation FROM actions a LEFT JOIN reservations r ON r.action_id=a.id WHERE a.id=$1",
      [pay.id],
    )
  ).rows[0];
  if (row.denial_code === "SIMULATION_REVERT") {
    const signed = (
      await db.pool.query(
        "SELECT signature FROM signing_attempts WHERE action_id=$1 AND state='SIGNED'",
        [pay.id],
      )
    ).rows[0];
    const reason = await chain.client
      .simulateContract({
        account: anvilAccount(8).address,
        address: walletAddress,
        abi: mandateWalletAbi,
        functionName: "execute",
        args: [
          abiStruct(authorityTypes.Action, pay.action),
          signed.signature,
          abiStruct(authorityTypes.Invoice, pay.invoice),
          pay.providerSignature,
          { actionDigest: ZERO_HASH, expiresAt: 0n },
          "0x",
          "0x",
        ] as never,
      })
      .then(
        () => "simulation now succeeds",
        (e: Error) => e.message.split("\n").slice(0, 3).join(" "),
      );
    assert.fail("PAY simulation reverted: " + reason);
  }
  if (final !== "INCLUDED" && final !== "FINALIZED")
    assert.fail(
      `PAY ended ${final}/${row.denial_code}; logs:\n` +
        processes
          .map((p) => p.name + ":\n" + p.log.join("").slice(-3000))
          .join("\n"),
    );
  assert.equal(row.reservation, "INCLUDED");
  assert.equal(
    (await balanceOf(providerKey.address)) - providerBefore,
    200_000n,
  );
  const attempt = (
    await db.pool.query(
      "SELECT state,signature,message_fingerprint FROM signing_attempts WHERE action_id=$1",
      [pay.id],
    )
  ).rows;
  assert.equal(attempt.length, 1);
  assert.equal(attempt[0].state, "SIGNED");
  assert.match(attempt[0].message_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(
    await recoverAddress({
      hash: hashAction(pay.action, domain),
      signature: attempt[0].signature,
    }),
    executor,
  );
  assert.equal(
    await chain.client.readContract({
      address: walletAddress,
      abi: mandateWalletAbi,
      functionName: "usedRequest",
      args: [pay.action.requestId],
    }),
    true,
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM transactions WHERE action_id=$1", [
        pay.id,
      ])
    ).rowCount,
    1,
  );

  // 5. Stored Action edited after its digest was committed: policy denies, no signature, no relay.
  const tampered = await proposeAction("100000", "pay:2");
  await db.pool.query(
    "UPDATE actions SET action=jsonb_set(action,'{amount}','\"150000\"') WHERE id=$1",
    [tampered.id],
  );
  const providerMid = await balanceOf(providerKey.address);
  const denied = await drive(tampered.id, ["DENIED", "INCLUDED"]);
  const deniedRow = (
    await db.pool.query(
      "SELECT a.denial_code,r.state AS reservation,r.release_reason FROM actions a JOIN reservations r ON r.action_id=a.id WHERE a.id=$1",
      [tampered.id],
    )
  ).rows[0];
  assert.equal(denied, "DENIED");
  assert.equal(deniedRow.denial_code, "POLICY_VIOLATION");
  assert.deepEqual(
    [deniedRow.reservation, deniedRow.release_reason],
    ["RELEASED", "DENIED_UNSIGNED"],
  );
  assert.deepEqual(
    (
      await db.pool.query(
        "SELECT state,signature FROM signing_attempts WHERE action_id=$1",
        [tampered.id],
      )
    ).rows,
    [{ state: "DENIED", signature: null }],
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM transactions WHERE action_id=$1", [
        tampered.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(await balanceOf(providerKey.address), providerMid);

  // 6. Owner controls through the API services: policy v2 lowers the review threshold,
  // so a 200000 PAY needs the owner's co-signature over the exact Action digest.
  const principal = {
    kind: "owner" as const,
    owner: owner.address.toLowerCase(),
    session: {
      sessionId: randomUUID(),
      ownerAddress: owner.address.toLowerCase(),
      deviceId: "0x" + "de".repeat(32),
      authTime: nowSeconds(),
    },
  };
  const controls = new ControlService(db.pool, chain.client, nowSeconds);
  const commands = new OwnerCommandRelay(
    db.pool,
    chain.client,
    relayer,
    nowSeconds,
  );
  const applyCommand = async (
    kind: "POLICY" | "ADMIN",
    draft: { draftId: string; typedData: unknown },
  ) => {
    const typed = draft.typedData as {
      primaryType: "WalletPolicy" | "Admin";
      message: unknown;
      domain: unknown;
    };
    const signature = await owner.signTypedData(
      buildTypedData(typed.primaryType, typed.message, typed.domain) as never,
    );
    await controls.submitCommand(principal, walletId, kind, {
      draftId: draft.draftId,
      ownerSignature: signature,
    });
    let state = "";
    for (
      let i = 0;
      i < 20 && state !== "INCLUDED" && state !== "REVERTED";
      i++
    ) {
      state = await commands.advance(draft.draftId);
      await chain.mine(1);
    }
    assert.equal(state, "INCLUDED", kind + " command");
  };
  const policyBody = (perTx: string) => ({
    policy: { reviewThreshold: "150000" },
    lists: { ...lists, assetCaps: [{ ...lists.assetCaps[0]!, perTx }] },
  });
  await applyCommand(
    "POLICY",
    await controls.policyDraft(principal, walletId, policyBody("400000")),
  );
  // v1 was relayed directly by this test; the chain event sets the next version.
  const versions = (
    await db.pool.query(
      "SELECT version::text FROM wallet_policies WHERE wallet_id=$1",
      [walletId],
    )
  ).rows.map((r) => r.version);
  assert.deepEqual(versions, ["2"]);
  // P2-A03.T05/T06: one failed and one successful simulation; nothing released meanwhile.
  assert.equal(simulation.calls, 2);
  assert.equal(
    (
      await db.pool.query("SELECT denial_code FROM actions WHERE id=$1", [
        pay.id,
      ])
    ).rows[0].denial_code,
    "SIMULATION_UNAVAILABLE",
  );
  const capabilities = await simulationCapabilities(executorClient);
  assert.equal(capabilities.ethCall, true);
  const cosigned = await proposeAction("200000", "pay:3");
  assert.equal(
    await drive(cosigned.id, ["AWAITING_APPROVAL", "INCLUDED", "DENIED"]),
    "AWAITING_APPROVAL",
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM signing_attempts WHERE action_id=$1", [
        cosigned.id,
      ])
    ).rowCount,
    0,
  );
  const approval = (await controls.approvals(principal)).items[0]!;
  const approvalSignature = await owner.signTypedData(
    buildTypedData(
      "Approval",
      approval.typedData.message,
      approval.typedData.domain,
    ) as never,
  );
  assert.deepEqual(
    await controls.decide(
      principal,
      approval.approvalId,
      { ownerSignature: approvalSignature },
      true,
    ),
    { state: "APPROVED" },
  );
  const cosignedFinal = await drive(cosigned.id, [
    "INCLUDED",
    "FINALIZED",
    "DENIED",
    "REVERTED",
  ]);
  assert.ok(
    ["INCLUDED", "FINALIZED"].includes(cosignedFinal),
    "co-signed PAY ended " + cosignedFinal,
  );
  // P2-A03.T06: the co-signed PAY needed exactly one post-sign simulation.
  assert.equal(simulation.calls, 3);
  const cosignedTx = (
    await db.pool.query("SELECT tx_hash FROM actions WHERE id=$1", [
      cosigned.id,
    ])
  ).rows[0].tx_hash as Hex;
  const executed = (
    await chain.client.getTransactionReceipt({ hash: cosignedTx })
  ).logs
    .map((l) => {
      try {
        return decodeEventLog({ abi: mandateWalletAbi, ...l });
      } catch {
        return null;
      }
    })
    .find((e) => e?.eventName === "ActionExecuted");
  assert.equal(
    executed?.eventName === "ActionExecuted" && executed.args.ownerApproved,
    true,
  );

  // 7. Tightened policy (perTx 100000) applies to the next request before signing.
  await applyCommand(
    "POLICY",
    await controls.policyDraft(principal, walletId, policyBody("100000")),
  );
  const tight = await proposeAction("120000", "pay:4");
  assert.equal(await drive(tight.id, ["DENIED", "INCLUDED"]), "DENIED");
  assert.deepEqual(
    (
      await db.pool.query(
        "SELECT state FROM signing_attempts WHERE action_id=$1",
        [tight.id],
      )
    ).rows,
    [{ state: "DENIED" }],
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM transactions WHERE action_id=$1", [
        tight.id,
      ])
    ).rowCount,
    0,
  );

  // 8. FREEZE on chain: no new signing request at all.
  await applyCommand(
    "ADMIN",
    await controls.adminDraft(principal, walletId, {
      command: AdminCommand.FREEZE,
      permitId: ZERO_HASH,
    }),
  );
  await db.pool.query("UPDATE wallets SET inhibited=false WHERE id=$1", [
    walletId,
  ]);
  assert.equal(
    await chain.client.readContract({
      address: walletAddress,
      abi: mandateWalletAbi,
      functionName: "frozen",
    }),
    true,
  );
  const frozenPay = await proposeAction("50000", "pay:5");
  assert.equal(await drive(frozenPay.id, ["DENIED", "INCLUDED"]), "DENIED");
  assert.equal(
    (
      await db.pool.query("SELECT denial_code FROM actions WHERE id=$1", [
        frozenPay.id,
      ])
    ).rows[0].denial_code,
    "WALLET_FROZEN",
  );
  assert.equal(
    (
      await db.pool.query("SELECT 1 FROM signing_attempts WHERE action_id=$1", [
        frozenPay.id,
      ])
    ).rowCount,
    0,
  );

  const evidence = {
    forkBlock: chain.forkBlock.toString(),
    walletAddress,
    executor,
    mpcWalletId: wallet.mpc_wallet_id,
    dkgMs,
    signToInclusionMs: signMs,
    payTxHash: row.tx_hash,
    payRequestId: pay.action.requestId,
    deniedActionRuleCode: deniedRow.denial_code,
    cosignedTxHash: cosignedTx,
    tightenedPolicyDenied: true,
    frozenDenial: "WALLET_FROZEN",
    simulationCalls: simulation.calls,
    simulateV1Supported: capabilities.simulateV1,
  };
  console.log("E2E_EVIDENCE " + JSON.stringify(evidence));
});
