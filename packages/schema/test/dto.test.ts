import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AgentAnswerSchema,
  AgentQuestionSchema,
  DeploymentManifestSchema,
  PersonalTransferRequestSchema,
  QuoteEnvelopeSchema,
  WalletActivitySchema,
  checkAgentAnswer,
  personalTransferCall,
  tokenStatus,
} from "../src/index.js";
import { loadFixture } from "./support/load.js";

test("P1-A01.T04 agent answers carry no address/calldata and must match options or bounds", () => {
  const f = loadFixture("agent-questions-v7.json");
  const byId = new Map(
    f.questions.map((q: { questionId: string }) => [
      q.questionId,
      AgentQuestionSchema.parse(q),
    ]),
  );
  for (const a of f.answers) {
    const answer = AgentAnswerSchema.parse(a.answer);
    assert.equal(
      checkAgentAnswer(byId.get(a.questionId) as never, answer).ok,
      a.ok,
      JSON.stringify(a.answer),
    );
  }
  assert.equal(
    AgentAnswerSchema.safeParse({
      optionId: "quote-a",
      amount: null,
      rationale: "",
      recipient: "0x6666666666666666666666666666666666666666",
    }).success,
    false,
  );
  assert.equal(
    AgentAnswerSchema.safeParse({
      optionId: "quote-a",
      amount: null,
      rationale: "",
      callData: "0x",
    }).success,
    false,
  );
  assert.equal(
    AgentAnswerSchema.safeParse({
      optionId: "quote-a",
      amount: "1",
      rationale: "",
    }).success,
    false,
  );
});

test("P1-W01.T03 ETH and DemoUSD sends of the same displayed amount differ in units and calldata", () => {
  const t = loadFixture("transfers-v7.json");
  assert.deepEqual(
    t.eth.call,
    personalTransferCall(t.eth.asset, t.eth.call.to, t.eth.amount),
  );
  assert.equal(t.eth.call.data, "0x");
  assert.equal(t.eth.call.value, "1500000000000000000");
  assert.equal(t.demoUsd.call.value, "0");
  assert.equal(t.demoUsd.call.to, t.demoUsd.asset);
  assert.ok(t.demoUsd.call.data.startsWith("0xa9059cbb"));
  assert.equal(
    PersonalTransferRequestSchema.safeParse({
      clientRequestId: "7c1d2b9e-3f4a-4b5c-8d6e-0f1a2b3c4d5e",
      accountId: "8d2e3c0f-4a5b-4c6d-9e7f-1a2b3c4d5e6f",
      chainId: 84532,
      asset: t.demoUsd.asset,
      recipient: t.demoUsd.call.to,
      amount: "1.5",
    }).success,
    false,
  );
});

test("P1-W01.T05 / P1-A01.T06 manifest rejects bad chain, code hashes, transfer modes and missing agent assets", () => {
  const m = loadFixture("manifest-v7.json").valid;
  assert.equal(DeploymentManifestSchema.safeParse(m).success, true);
  const bad = [
    { ...m, chainId: 8453 },
    {
      ...m,
      contracts: {
        ...m.contracts,
        token: { ...m.contracts.token, codeHash: undefined },
      },
    },
    {
      ...m,
      supportedTokens: [{ ...m.supportedTokens[0], transferMode: "TAXED" }],
    },
    { ...m, supportedTokens: [{ ...m.supportedTokens[0], chainId: 1 }] },
    {
      ...m,
      agentAssets: m.agentAssets.filter(
        (a: { symbol: string }) => a.symbol !== "DUSD",
      ),
    },
    {
      ...m,
      agentAssets: [
        { ...m.agentAssets[0], codeHash: undefined },
        m.agentAssets[1],
      ],
    },
    { ...m, x402: { mode: "ERC1271", facilitator: null, gatePassed: false } },
  ];
  for (const b of bad)
    assert.equal(DeploymentManifestSchema.safeParse(b).success, false);
  // Unknown imported tokens can be tracked but never become send-enabled.
  assert.equal(
    tokenStatus(
      {
        address: m.supportedTokens[0].address,
        codeHash: m.supportedTokens[0].codeHash,
      },
      m.supportedTokens,
    ),
    "SEND_ENABLED",
  );
  assert.equal(
    tokenStatus(
      {
        address: m.supportedTokens[0].address,
        codeHash: "0x" + "ab".repeat(32),
      },
      m.supportedTokens,
    ),
    "WATCH_ONLY",
  );
  assert.equal(
    tokenStatus(
      {
        address: "0x6666666666666666666666666666666666666666",
        codeHash: "0x" + "ab".repeat(32),
      },
      m.supportedTokens,
    ),
    "WATCH_ONLY",
  );
});

test("P1-A01.T04 x402 terms must match the signed invoice", () => {
  const invoice = loadFixture("invoice-v7.json").valid[0];
  const quote = {
    providerId: "a",
    invoice: invoice.message,
    providerSignature: invoice.signature,
    x402: {
      scheme: "exact",
      network: "base-sepolia",
      asset: invoice.message.asset,
      payTo: invoice.message.recipient,
      maxAmountRequired: invoice.message.amount,
      resource: "https://provider.mandate.example/providers/a/check",
      description: "pageLoad,title",
      maxTimeoutSeconds: 60,
    },
  };
  assert.equal(QuoteEnvelopeSchema.safeParse(quote).success, true);
  assert.equal(
    QuoteEnvelopeSchema.safeParse({
      ...quote,
      x402: { ...quote.x402, maxAmountRequired: "200001" },
    }).success,
    false,
  );
});

test("P1-W01.T03 activity attribution keeps owner control and agent spend distinct", () => {
  const base = {
    activityId: "a1",
    ownerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    source: "MANAGED",
    category: "OWNER_CONTROL",
    chainId: 84532,
    txHash: "0x" + "11".repeat(32),
    blockHash: null,
    blockNumber: null,
    nonce: null,
    asset: "0x2222222222222222222222222222222222222222",
    from: "0x1111111111111111111111111111111111111111",
    to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    amount: "1500000",
    feeWei: null,
    feePayer: null,
    state: "INCLUDED",
    operationId: null,
    taskId: null,
    transferId: "0x" + "07".padStart(64, "0"),
    replacementOf: null,
    provenance: "RPC_VERIFIED",
    observedAt: "1793000400",
  };
  assert.equal(WalletActivitySchema.safeParse(base).success, true);
  assert.equal(
    WalletActivitySchema.safeParse({ ...base, taskId: "t1" }).success,
    false,
  );
  assert.equal(
    WalletActivitySchema.safeParse({ ...base, source: "PERSONAL" }).success,
    false,
  );
});

test("P1-W01.T06 no production source keeps bootstrap wallet4/Login1 literals", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (
        [
          "node_modules",
          "fixtures",
          "test",
          "dist",
          "out",
          "lib",
          "vendor",
        ].includes(name)
      )
        continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|sol|kt|go)$/.test(name)) {
        const text = readFileSync(p, "utf8");
        if (
          /DOMAIN_VERSION\s*=\s*"4"|MandateWallet"[^\n]{0,60}"4"|MandateLogin"[^\n]{0,60}"1"|version:\s*"4"/.test(
            text,
          )
        )
          offenders.push(p);
      }
    }
  };
  for (const top of ["apps", "packages", "services", "modules"])
    walk(join(root, top));
  assert.deepEqual(offenders, []);
});
