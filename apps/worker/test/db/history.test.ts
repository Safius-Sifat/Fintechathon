import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import {
  encodeFunctionData,
  getAddress,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import { demoUSDAbi, walletFactoryAbi } from "@mandate/schema";
import deployment from "../../../../evidence/person1/deployment.json" with { type: "json" };
import { EtherscanClient } from "../../src/history/etherscan.js";
import { HistoryIndexer, type Account } from "../../src/history/backfill.js";
import { admin, anvilAccount, forkChain, isolatedSchema } from "./support.js";

const DEMO_USD = getAddress(deployment.contracts.token.address);
const FACTORY = getAddress(deployment.contracts.factory.address);

let chain: Awaited<ReturnType<typeof forkChain>>;
// Local stand-in for Etherscan V2: responses are scripted per test; the chain is real.
let respond: (params: URLSearchParams) => { status: number; body: unknown };
let server: Server;
let indexerUrl: string;
before(async () => {
  chain = await forkChain();
  server = createServer((req, res) => {
    const r = respond(new URL(req.url!, "http://x").searchParams);
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(typeof r.body === "string" ? r.body : JSON.stringify(r.body));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  indexerUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/v2/api`;
});
after(async () => {
  server.close();
  await chain.close();
  await admin.end();
});

async function send(
  account: PrivateKeyAccount | ReturnType<typeof anvilAccount>,
  to: Address,
  data: Hex,
  value = 0n,
): Promise<Hex> {
  const fees = await chain.client.estimateFeesPerGas();
  const hash = await chain.client.sendRawTransaction({
    serializedTransaction: await account.signTransaction({
      chainId: 84532,
      type: "eip1559",
      to,
      data,
      value,
      nonce: await chain.client.getTransactionCount({
        address: account.address,
        blockTag: "pending",
      }),
      gas: 6_000_000n,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    }),
  });
  await chain.mine(1);
  return hash;
}

// Real fork activity: a personal EOA, its managed wallet, funding and a payout.
async function scenario() {
  const personal = privateKeyToAccount(generatePrivateKey());
  await chain.rpc("anvil_setBalance", [
    personal.address,
    "0x" + parseEther("1").toString(16),
  ]);
  const startBlock = await chain.client.getBlockNumber({ cacheTime: 0 });
  const faucetTx = await send(
    anvilAccount(5),
    DEMO_USD,
    encodeFunctionData({
      abi: demoUSDAbi,
      functionName: "faucet",
      args: [personal.address],
    }),
  );
  const ethOut = await send(
    personal,
    "0x000000000000000000000000000000000000dEaD",
    "0x",
    1000n,
  );
  await send(
    anvilAccount(5),
    FACTORY,
    encodeFunctionData({
      abi: walletFactoryAbi,
      functionName: "createWallet",
      args: [personal.address],
    }),
  );
  const wallet = await chain.client.readContract({
    address: FACTORY,
    abi: walletFactoryAbi,
    functionName: "walletForOwner",
    args: [personal.address],
  });
  const walletBlock = await chain.client.getBlockNumber({ cacheTime: 0 });
  const funding = await send(
    personal,
    DEMO_USD,
    encodeFunctionData({
      abi: demoUSDAbi,
      functionName: "transfer",
      args: [wallet, 250_000n],
    }),
  );
  const endBlock = await chain.client.getBlockNumber({ cacheTime: 0 });
  const receipt = async (hash: Hex) =>
    chain.client.getTransactionReceipt({ hash });
  const transferLog = async (hash: Hex) =>
    (await receipt(hash)).logs.find(
      (l) => l.address.toLowerCase() === DEMO_USD.toLowerCase(),
    )!;
  return {
    personal,
    wallet,
    startBlock,
    walletBlock,
    endBlock,
    faucetTx,
    ethOut,
    funding,
    receipt,
    transferLog,
  };
}

async function setup(s: Awaited<ReturnType<typeof scenario>>) {
  const db = await isolatedSchema("hist");
  const now = Math.floor(Date.now() / 1000);
  const owner = s.personal.address.toLowerCase();
  await db.pool.query(
    "INSERT INTO owner_identities(owner_address,created_at) VALUES($1,$2)",
    [owner, now],
  );
  await db.pool.query(
    "INSERT INTO wallets(id,owner_address,provisioning_state,wallet_address,deployment_block,code_hash,mpc_wallet_id,created_at,updated_at) VALUES(gen_random_uuid(),$1,'KEYGEN',$2,$3,$4,gen_random_uuid(),$5,$5)",
    [
      owner,
      s.wallet.toLowerCase(),
      s.walletBlock.toString(),
      "0x" + "11".repeat(32),
      now,
    ],
  );
  const indexer = new HistoryIndexer(
    db.pool,
    chain.client,
    new EtherscanClient("server-only-test-key", indexerUrl),
    () => now,
  );
  const personal: Account = {
    owner: s.personal.address,
    source: "PERSONAL",
    address: s.personal.address,
    counterpart: s.wallet,
  };
  const managed: Account = {
    owner: s.personal.address,
    source: "MANAGED",
    address: s.wallet,
    counterpart: s.personal.address,
  };
  const activity = async () =>
    (await db.pool.query("SELECT * FROM activity_events ORDER BY activity_id"))
      .rows;
  const coverage = async () =>
    (await db.pool.query("SELECT * FROM history_coverage ORDER BY source"))
      .rows;
  return { ...db, indexer, personal, managed, activity, coverage };
}

const ok = (result: unknown[]) => ({
  status: 200,
  body: { status: "1", message: "OK", result },
});
const empty = {
  status: 200,
  body: { status: "0", message: "No transactions found", result: [] },
};
const tokenItem = (
  hash: Hex,
  log: { logIndex: number },
  from: Address,
  to: Address,
  value: bigint,
  block: bigint,
) => ({
  blockNumber: block.toString(),
  hash,
  from,
  to,
  value: value.toString(),
  contractAddress: DEMO_USD,
  logIndex: String(log.logIndex),
});

test("P2-W02.T01 rate limit, quota, malformed and unreachable pages leave FAILED coverage with a gap, never verified empty history", async () => {
  const s = await scenario();
  for (const [name, reply] of [
    ["rate", () => ({ status: 429, body: {} })],
    [
      "quota",
      () => ({
        status: 200,
        body: {
          status: "0",
          message: "NOTOK",
          result: "Max daily rate limit reached; upgrade plan",
        },
      }),
    ],
    [
      "error",
      () => ({
        status: 200,
        body: { status: "0", message: "NOTOK", result: "Invalid API Key" },
      }),
    ],
    ["malformed", () => ({ status: 200, body: "<html>" })],
    [
      "shape",
      () => ({
        status: 200,
        body: { status: "1", message: "OK", result: [{ hash: 1 }] },
      }),
    ],
  ] as const) {
    const e = await setup(s);
    try {
      respond = reply;
      assert.equal(
        await e.indexer.backfill(e.personal, s.startBlock, s.endBlock),
        "FAILED",
        name,
      );
      const [c] = await e.coverage();
      assert.equal(c.backfill_state, "FAILED");
      assert.equal(c.indexed_through, null);
      assert.deepEqual(c.gaps, [
        { fromBlock: s.startBlock.toString(), toBlock: s.endBlock.toString() },
      ]);
      assert.equal((await e.activity()).length, 0);
    } finally {
      await e.drop();
    }
  }
  const e = await setup(s);
  try {
    respond = () => empty;
    assert.equal(
      await e.indexer.backfill(e.personal, s.startBlock, s.endBlock),
      "COMPLETE",
    );
  } finally {
    await e.drop();
  }
});

test("P2-W02.T02/T03/T05 personal backfill starts before the wallet; duplicates collapse; funding is FUNDING on both sides with the fee on the payer", async () => {
  const s = await scenario();
  const e = await setup(s);
  try {
    const fundingLog = await s.transferLog(s.funding);
    const faucetLog = await s.transferLog(s.faucetTx);
    const funding = tokenItem(
      s.funding,
      fundingLog,
      s.personal.address,
      s.wallet,
      250_000n,
      fundingLog.blockNumber,
    );
    const ethOut = {
      blockNumber: (await s.receipt(s.ethOut)).blockNumber.toString(),
      hash: s.ethOut,
      from: s.personal.address,
      to: "0x000000000000000000000000000000000000dEaD",
      value: "1000",
    };
    respond = (p) => {
      const address = p.get("address")!.toLowerCase();
      if (address === s.personal.address.toLowerCase()) {
        if (p.get("action") === "txlist") return ok([ethOut]);
        // The same log appears on two "pages" of the response.
        if (p.get("action") === "tokentx")
          return ok([
            tokenItem(
              s.faucetTx,
              faucetLog,
              "0x0000000000000000000000000000000000000000" as Address,
              s.personal.address,
              10_000_000n,
              faucetLog.blockNumber,
            ),
            funding,
            funding,
          ]);
      }
      if (address === s.wallet.toLowerCase() && p.get("action") === "tokentx")
        return ok([funding]);
      return empty;
    };
    assert.equal(
      await e.indexer.backfill(e.personal, s.startBlock, s.endBlock),
      "COMPLETE",
    );
    assert.equal(
      await e.indexer.backfill(e.managed, s.walletBlock, s.endBlock),
      "COMPLETE",
    );
    assert.equal(
      await e.indexer.backfill(e.personal, s.startBlock, s.endBlock),
      "COMPLETE",
    );
    const rows = await e.activity();
    const byKind = (source: string, hash: Hex) =>
      rows.filter((r) => r.source === source && r.tx_hash === hash);
    assert.equal(byKind("PERSONAL", s.funding).length, 1);
    assert.equal(byKind("MANAGED", s.funding).length, 1);
    assert.deepEqual(
      [
        byKind("PERSONAL", s.funding)[0].category,
        byKind("MANAGED", s.funding)[0].category,
      ],
      ["FUNDING", "FUNDING"],
    );
    const native = byKind("PERSONAL", s.ethOut)[0];
    assert.equal(native.category, "OUTGOING");
    assert.equal(native.provenance, "RPC_VERIFIED");
    assert.equal(native.fee_payer, s.personal.address.toLowerCase());
    assert.ok(BigInt(native.fee_wei) > 0n);
    assert.ok(rows.every((r) => r.provenance === "RPC_VERIFIED"));
    const [managed, personal] = await e.coverage();
    assert.equal(BigInt(personal.from_block), s.startBlock);
    assert.equal(BigInt(managed.from_block), s.walletBlock);
    assert.ok(s.startBlock < s.walletBlock);
  } finally {
    await e.drop();
  }
});

test("P2-W02.T04/T07 claims absent from the receipt and internal-trace-only transfers stay indexer assertions", async () => {
  const s = await scenario();
  const e = await setup(s);
  try {
    const log = await s.transferLog(s.funding);
    respond = (p) => {
      if (p.get("address")!.toLowerCase() !== s.wallet.toLowerCase())
        return empty;
      if (p.get("action") === "tokentx")
        return ok([
          tokenItem(
            s.funding,
            log,
            s.personal.address,
            s.wallet,
            999_999n,
            log.blockNumber,
          ),
        ]);
      if (p.get("action") === "txlistinternal")
        return ok([
          {
            blockNumber: log.blockNumber.toString(),
            hash: s.funding,
            from: s.wallet,
            to: s.personal.address,
            value: "5",
            traceId: "0_1",
          },
        ]);
      return empty;
    };
    assert.equal(
      await e.indexer.backfill(e.managed, s.walletBlock, s.endBlock),
      "COMPLETE",
    );
    const rows = await e.activity();
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.provenance, "INDEXER_ASSERTION");
      assert.equal(r.state, "UNKNOWN");
    }
    assert.equal(
      (await e.pool.query("SELECT 1 FROM financial_alerts")).rowCount,
      0,
    );
  } finally {
    await e.drop();
  }
});

test("P2-05.T07 a verified managed outflow with no stored Action raises an alert and inhibits signing", async () => {
  const s = await scenario();
  const e = await setup(s);
  try {
    // The owner drains a payout through a plain token transfer from an impersonated wallet.
    await chain.rpc("anvil_impersonateAccount", [s.wallet]);
    await chain.rpc("anvil_setBalance", [
      s.wallet,
      "0x" + parseEther("1").toString(16),
    ]);
    const hash = (await chain.client.request({
      method: "eth_sendTransaction" as never,
      params: [
        {
          from: s.wallet,
          to: DEMO_USD,
          data: encodeFunctionData({
            abi: demoUSDAbi,
            functionName: "transfer",
            args: ["0x000000000000000000000000000000000000bEEF", 1000n],
          }),
          maxFeePerGas: "0x3b9aca00",
          maxPriorityFeePerGas: "0xf4240",
        },
      ] as never,
    })) as Hex;
    await chain.mine(1);
    const log = await s.transferLog(hash);
    respond = (p) =>
      p.get("action") === "tokentx"
        ? ok([
            tokenItem(
              hash,
              log,
              s.wallet,
              "0x000000000000000000000000000000000000bEEF" as Address,
              1000n,
              log.blockNumber,
            ),
          ])
        : empty;
    await e.indexer.backfill(
      e.managed,
      s.walletBlock,
      await chain.client.getBlockNumber({ cacheTime: 0 }),
    );
    const alerts = (
      await e.pool.query("SELECT kind,tx_hash,details FROM financial_alerts")
    ).rows;
    assert.deepEqual(
      alerts.map((a) => [a.kind, a.tx_hash]),
      [["UNMATCHED_OUTFLOW", hash]],
    );
    assert.equal(
      (await e.pool.query("SELECT inhibited FROM wallets")).rows[0].inhibited,
      true,
    );
    assert.equal((await e.pool.query("SELECT 1 FROM actions")).rowCount, 0);
  } finally {
    await e.drop();
  }
});
