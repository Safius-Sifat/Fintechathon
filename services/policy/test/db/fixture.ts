import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getAddress, type Address, type Hex } from "viem";
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import {
  buildTypedData,
  DeploymentManifestSchema,
  hashAction,
  hashConditions,
  hashPermit,
  hashRecipients,
  hashRunbook,
  hashSchedule,
  invoiceDomain,
  walletDomain,
  ZERO_HASH,
  ZERO_SCHEDULE,
  type DeploymentManifest,
} from "@mandate/schema";
import manifestFixture from "../../../../packages/schema/fixtures/manifest-v7.json" with { type: "json" };

const hex32 = () => ("0x" + randomBytes(32).toString("hex")) as Hex;
export const DEMO_USD = getAddress(
  "0xE030717a657E9194bC086A546fb59aDBc631ad7a",
);
const DEMO_USD_CODE =
  "0xa77bb5b06759b6ff168d53e43a2308c7c1ae113ce764ea1d0e23f64e777f9649";

// Declared test manifest: shared fixture with the deployed DemoUSD and the test provider.
export function testManifest(provider: Address): DeploymentManifest {
  const m = structuredClone(manifestFixture.valid) as Record<string, any>;
  m.contracts.token = {
    address: DEMO_USD,
    deploymentBlock: "48293963",
    codeHash: DEMO_USD_CODE,
  };
  m.agentAssets = [
    { address: DEMO_USD, codeHash: DEMO_USD_CODE, decimals: 6, symbol: "DUSD" },
  ];
  m.supportedTokens = [
    {
      chainId: 84532,
      address: DEMO_USD,
      codeHash: DEMO_USD_CODE,
      decimals: 6,
      symbol: "DUSD",
      transferMode: "STANDARD_ERC20",
    },
  ];
  m.providers = [{ ...m.providers[0], recipient: provider }];
  return DeploymentManifestSchema.parse(m);
}

export type SignedFixture = Awaited<ReturnType<typeof seedSignedAction>>;

// Inserts an owner-signed Permit, a provider-signed invoice and a PAY Action in
// SIGNING with its reservation and pending attempt, as the worker would.
export async function seedSignedAction(
  pool: Pool,
  now: number,
  options: {
    owner?: PrivateKeyAccount;
    provider?: PrivateKeyAccount;
    walletAddress?: Address;
    executor?: Address;
    mpcWalletId?: string;
    amount?: bigint;
    operation?: number;
  } = {},
) {
  const owner = options.owner ?? privateKeyToAccount(generatePrivateKey());
  const provider =
    options.provider ?? privateKeyToAccount(generatePrivateKey());
  const wallet =
    options.walletAddress ?? getAddress("0x" + randomBytes(20).toString("hex"));
  const executor =
    options.executor ?? getAddress("0x" + randomBytes(20).toString("hex"));
  const mpcWalletId = options.mpcWalletId ?? randomUUID();
  const manifest = testManifest(provider.address);
  const runbook = manifest.runbooks.find(
    (r) => r.runbookId === "browser-check",
  )!;
  const conditions = {
    schemaVersion: 4,
    runbookId: "browser-check",
    browser: {
      targetId: "checkout-healthy",
      checks: ["pageLoad", "title"],
      providerIds: ["a"],
      maxPaidAttempts: 1,
      maxSteps: 4,
      taskDeadline: String(now + 3600),
      resultMaxAgeSeconds: 300,
    },
    liquidity: null,
    schedule: null,
    allowance: null,
    calls: null,
  };
  const scope = {
    conditions,
    runbookManifest: runbook,
    providerBindings: [{ providerId: "a", recipient: provider.address }],
  };
  const chainTaskId = hex32();
  const permit = {
    taskId: chainTaskId,
    executor,
    kind: 0,
    asset: DEMO_USD,
    runbookHash: hashRunbook(runbook),
    conditionsHash: hashConditions(conditions),
    recipientsHash: hashRecipients([provider.address]),
    scheduleHash: hashSchedule(ZERO_SCHEDULE),
    templatesHash: ZERO_HASH,
    issuedAt: String(now - 10),
    startsAt: String(now - 10),
    expiresAt: String(now + 3600),
    epoch: "0",
    nonce: "1",
    maxActions: 5,
    maxPayments: 3,
    maxPayment: "400000",
    spendCap: "1000000",
    liquidFloor: "0",
    depositCap: "0",
    withdrawCap: "0",
    reviewThreshold: "500000",
    periodCap: "0",
    periodSeconds: 0,
  };
  const domain = walletDomain(wallet);
  const permitId = hashPermit(permit);
  const ownerSignature = await owner.signTypedData(
    buildTypedData("Permit", permit, domain) as never,
  );
  const amount = (options.amount ?? 200_000n).toString();
  const inputHash = hex32();
  const invoice = {
    invoiceId: hex32(),
    taskId: chainTaskId,
    wallet,
    asset: DEMO_USD,
    recipient: provider.address,
    amount,
    inputHash,
    issuedAt: String(now - 5),
    expiresAt: String(now + 300),
  };
  const providerSignature = await provider.signTypedData(
    buildTypedData("Invoice", invoice, invoiceDomain(wallet)) as never,
  );
  const action = {
    permitId,
    requestId: hex32(),
    operation: options.operation ?? 0,
    target: provider.address,
    amount,
    minOutput: "0",
    invoiceId: invoice.invoiceId,
    inputHash,
    period: 0,
    issuedAt: String(now - 5),
    deadline: String(now + 55),
  };
  const digest = hashAction(action, domain);
  const ids = {
    walletId: randomUUID(),
    taskId: randomUUID(),
    draftId: randomUUID(),
    actionId: randomUUID(),
    attemptId: randomUUID(),
  };
  const q = (sql: string, params: unknown[]) => pool.query(sql, params);
  await q(
    "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
    [owner.address.toLowerCase(), now],
  );
  await q(
    "INSERT INTO wallets(id,owner_address,provisioning_state,wallet_address,deployment_block,code_hash,mpc_wallet_id,executor_address,executor_public_key,key_version,created_at,updated_at) VALUES($1,$2,'READY',$3,1,$4,$5,$6,$7,1,$8,$8)",
    [
      ids.walletId,
      owner.address.toLowerCase(),
      wallet.toLowerCase(),
      hex32(),
      mpcWalletId,
      executor.toLowerCase(),
      "0x04" + randomBytes(64).toString("hex"),
      now,
    ],
  );
  await q(
    "INSERT INTO tasks(id,chain_task_id,wallet_id,runbook_id,goal,input,outcome_state,authority_state,runbook_state,created_at,updated_at) VALUES($1,$2,$3,'browser-check','fixture','{}','RUNNING','ACTIVE','{\"schemaVersion\":4}',$4,$4)",
    [ids.taskId, chainTaskId, ids.walletId, now],
  );
  await q(
    "INSERT INTO permit_drafts(id,wallet_id,task_id,typed_data,scope,digest,permit_id,nonce,epoch,state,expires_at,created_at) VALUES($1,$2,$3,'{}',$4,$5,$6,1,0,'ACTIVATED',$7,$7)",
    [ids.draftId, ids.walletId, ids.taskId, scope, hex32(), permitId, now],
  );
  await q(
    "INSERT INTO permits(permit_id,wallet_id,task_id,draft_id,permit,owner_signature,authority_state,spend_cap,period_cap,period_seconds,max_payment,created_at) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,0,0,$8,$9)",
    [
      permitId,
      ids.walletId,
      ids.taskId,
      ids.draftId,
      permit,
      ownerSignature,
      permit.spendCap,
      permit.maxPayment,
      now,
    ],
  );
  await q(
    "INSERT INTO actions(id,task_id,wallet_id,permit_id,decision_key,request_id,invoice_id,operation,asset,amount,period,action,digest,invoice,provider_signature,state,created_at,updated_at) VALUES($1,$2,$3,$4,'pay:a',$5,$6,$7,$8,$9,0,$10,$11,$12,$13,'SIGNING',$14,$14)",
    [
      ids.actionId,
      ids.taskId,
      ids.walletId,
      permitId,
      action.requestId,
      invoice.invoiceId,
      action.operation,
      DEMO_USD.toLowerCase(),
      amount,
      action,
      digest,
      invoice,
      providerSignature,
      now,
    ],
  );
  await q(
    "INSERT INTO reservations(action_id,wallet_id,permit_id,asset,kind,amount,chain_day,state,created_at,updated_at) VALUES($1,$2,$3,$4,'OUTFLOW',$5,$6,'RESERVED',$7,$7)",
    [
      ids.actionId,
      ids.walletId,
      permitId,
      DEMO_USD.toLowerCase(),
      amount,
      Math.floor(now / 86400),
      now,
    ],
  );
  await q(
    "INSERT INTO signing_attempts(id,action_id,mpc_wallet_id,key_version,digest,executor_address,state,created_at,updated_at) VALUES($1,$2,$3,1,$4,$5,'PENDING',$6,$6)",
    [
      ids.attemptId,
      ids.actionId,
      mpcWalletId,
      digest,
      executor.toLowerCase(),
      now,
    ],
  );
  const message = {
    key_type: "secp256k1",
    wallet_id: mpcWalletId,
    network_internal_code: "eip155:84532",
    tx_id: ids.attemptId,
    tx: Buffer.from(digest.slice(2), "hex").toString("base64"),
    signature: Buffer.alloc(64).toString("base64"),
    derivation_path: null,
  };
  return {
    ...ids,
    owner,
    provider,
    wallet,
    executor,
    mpcWalletId,
    manifest,
    permit,
    permitId,
    action,
    invoice,
    digest,
    message,
  };
}
