import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getAddress, type Address } from "viem";
import { DeploymentManifestSchema, hashCanonical } from "@mandate/schema";
import {
  connectChain,
  expireArtifacts,
  JobQueue,
  loadKeystoreSigner,
  systemClock,
  type Job,
} from "@mandate/platform";
import {
  DEFAULT_BUDGETS,
  Relayer,
  type LaneConfig,
  type LaneName,
} from "./relayer.js";
import { Provisioner, adapterKeygen } from "./provision.js";
import { adapterClient, Executor, gatedSigning } from "./execution.js";
import { OwnerTransferRelay } from "./owner-transfer.js";
import { OwnerCommandRelay } from "./owner-commands.js";
import { expireQuestions } from "./agent-questions.js";
import { RiskRulesSchema, runSentinel } from "./sentinel.js";
import { EtherscanClient } from "./history/etherscan.js";
import { HistoryIndexer } from "./history/backfill.js";
import {
  activatePermit,
  advanceTask,
  providerDeps,
  scheduleAdvances,
} from "./advance.js";
import { advanceRunbook } from "@mandate/runbooks";

const env = process.env;
const required = (name: string) => {
  const v = env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
};
const secret = async (name: string) =>
  (await readFile(required(name), "utf8")).trim();

const database = new Pool({
  connectionString: required("DATABASE_URL"),
  max: 4,
  connectionTimeoutMillis: 3000,
  ssl: {
    ca: await readFile(required("DATABASE_CA_FILE"), "utf8"),
    rejectUnauthorized: true,
  },
});
const manifest = DeploymentManifestSchema.parse(
  JSON.parse(await readFile(required("TRUSTED_MANIFEST_FILE"), "utf8")),
);
const client = await connectChain(required("WORKER_RPC_URL"), 84532);

// Each lane is optional; an unconfigured lane makes its operations fail explicitly.
const lanes: Partial<Record<LaneName, LaneConfig>> = {};
for (const lane of ["normal", "emergency", "anchor"] as const) {
  const prefix = `WORKER_${lane.toUpperCase()}_`;
  if (!env[prefix + "KEYSTORE_FILE"]) continue;
  lanes[lane] = {
    account: await loadKeystoreSigner({
      keystoreFile: required(prefix + "KEYSTORE_FILE"),
      passwordFile: required(prefix + "PASSWORD_FILE"),
      expectedAddress: getAddress(required(prefix + "ADDRESS")) as Address,
    }),
    ...DEFAULT_BUDGETS[lane],
  };
}
const clock = systemClock;
const relayer = new Relayer(database, client, 84532, lanes, clock);
await relayer.register();

const adapterToken = await secret("ADAPTER_INTERNAL_TOKEN_FILE");
const providerToken = await secret("PROVIDER_WORKER_TOKEN_FILE");
const adapterUrl = required("ADAPTER_URL");
const adapter = adapterClient(adapterUrl, adapterToken);
// After a restore, signing stays off until reconciliation is complete and an
// operator sets WORKER_SIGNING_ENABLED=true.
const signing = gatedSigning(adapter, env.WORKER_SIGNING_ENABLED === "true");

const executor = new Executor(database, client, relayer, signing, clock);
const provisioner = new Provisioner(
  database,
  client,
  relayer,
  manifest.contracts.factory,
  adapterKeygen(adapterUrl, adapterToken),
  clock,
);
const ownerTransfers = new OwnerTransferRelay(database, client, relayer, clock);
const ownerCommands = new OwnerCommandRelay(database, client, relayer, clock);
const history = new HistoryIndexer(
  database,
  client,
  new EtherscanClient(env.ETHERSCAN_API_KEY ?? ""),
  clock,
);
const rulesRaw: unknown = JSON.parse(
  await readFile(required("RISK_RULES_FILE"), "utf8"),
);
const rules = RiskRulesSchema.parse(rulesRaw);
const rulesHash = hashCanonical(rulesRaw);
if (rulesHash !== manifest.riskRules.hash)
  throw new Error("Risk rules hash does not match the deployment manifest");

const queue = new JobQueue(database, "worker-" + randomUUID(), clock);
const handlers: Record<string, (job: Job) => Promise<boolean>> = {
  "wallet.provision": async (job) => {
    const r = await provisioner.step(String(job.payload.walletId));
    return r.state === "READY" || r.state === "FAILED";
  },
  "owner_transfer.relay": async (job) =>
    ["INCLUDED", "REVERTED"].includes(
      await ownerTransfers.advance(String(job.payload.draftId)),
    ),
  "owner_command.relay": async (job) =>
    ["INCLUDED", "REVERTED"].includes(
      await ownerCommands.advance(String(job.payload.draftId)),
    ),
  "history.register": async (job) => {
    const owner = getAddress(String(job.payload.owner));
    const tx = await client.getTransaction({
      hash: job.payload.txHash as `0x${string}`,
    });
    const wallet = (
      await database.query<{ wallet_address: string | null }>(
        "SELECT wallet_address FROM wallets WHERE owner_address=$1",
        [owner.toLowerCase()],
      )
    ).rows[0]?.wallet_address;
    const managed = wallet ? getAddress(wallet) : null;
    // The registered hash is attributed to whichever own account sent or received it.
    const personal = tx.from === owner || tx.to === owner;
    const account =
      personal || !managed
        ? {
            owner,
            source: "PERSONAL" as const,
            address: owner,
            counterpart: managed,
          }
        : {
            owner,
            source: "MANAGED" as const,
            address: managed,
            counterpart: owner,
          };
    await history.record(
      account,
      await history.verify(account, "txlist", {
        blockNumber: String(tx.blockNumber ?? 0n),
        hash: tx.hash,
        from: tx.from,
        to: tx.to ?? "0x0000000000000000000000000000000000000000",
        value: tx.value.toString(),
      }),
    );
    return true;
  },
  "permit.activate": (job) =>
    activatePermit(database, relayer, clock, String(job.payload.draftId)),
  "task.advance": async (job) => {
    const result = await advanceTask(
      database,
      client,
      advanceRunbook,
      (task) =>
        providerDeps(required("PROVIDER_URL"), providerToken, () => ({
          taskId: task.chainTaskId,
          wallet: task.wallet,
          asset: task.asset,
        })),
      clock,
      String(job.payload.taskId),
    );
    if (!result.done && result.runAt) await queue.defer(job, result.runAt);
    return result.done;
  },
};

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => (stopping = true));
let lastPeriodic = 0;
while (!stopping) {
  for (const job of await queue.lease(Object.keys(handlers), 5)) {
    try {
      if (await handlers[job.kind]!(job))
        await queue.complete(job, async () => undefined);
      else await queue.defer(job, clock() + 5);
    } catch (error) {
      await queue.retry(
        job,
        error instanceof Error ? error.message : "job failed",
        30,
      );
    }
  }
  await scheduleAdvances(database, clock());
  const open = await database.query<{ id: string }>(
    "SELECT a.id FROM actions a LEFT JOIN reservations r ON r.action_id=a.id WHERE a.state IN ('PROPOSED','RESERVED','AWAITING_APPROVAL','SIGNING','SIGNED','SUBMITTED','UNKNOWN','INCLUDED') OR (a.state IN ('DENIED','REVERTED') AND r.state IN ('RESERVED','UNKNOWN')) ORDER BY a.created_at LIMIT 50",
  );
  for (const { id } of open.rows)
    await executor
      .advance(id)
      .catch((error: unknown) =>
        console.error(
          "action advance failed",
          id,
          error instanceof Error ? error.message : error,
        ),
      );
  if (clock() - lastPeriodic >= 60) {
    lastPeriodic = clock();
    await expireQuestions(database, lastPeriodic);
    await runSentinel(database, rules, rulesHash, null, lastPeriodic);
    await expireArtifacts(database, lastPeriodic);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
await database.end();
