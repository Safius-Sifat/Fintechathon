import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CallTemplateSchema,
  callTemplateId,
  x402Authorization,
  x402AuthorizationDigest,
  AgentAnswerSchema,
  AgentDecisionPayloadSchema,
  ApiErrorSchema,
  PushRegisterRequestSchema,
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
  const x402 = {
    scheme: "exact",
    network: "eip155:84532",
    amount: invoice.message.amount,
    asset: invoice.message.asset,
    payTo: invoice.message.recipient,
    maxTimeoutSeconds: 60,
    extra: {
      name: "USDC",
      version: "2",
      mandateInvoice: invoice.message,
      mandateProviderSignature: invoice.signature,
    },
  };
  const quote = {
    providerId: "a",
    invoice: invoice.message,
    providerSignature: invoice.signature,
    x402,
  };
  assert.equal(QuoteEnvelopeSchema.safeParse(quote).success, true);
  assert.equal(
    QuoteEnvelopeSchema.safeParse({ ...quote, x402: null }).success,
    true,
  );
  for (const bad of [
    { ...x402, amount: "200001" },
    { ...x402, payTo: "0x6666666666666666666666666666666666666666" },
    { ...x402, network: "base-sepolia" },
  ])
    assert.equal(
      QuoteEnvelopeSchema.safeParse({ ...quote, x402: bad }).success,
      false,
    );
});

test("P1-A03.T06 x402 authorization is derived from the X402 Action and pinned to on-chain USDC", () => {
  const v = loadFixture("x402-v7.json");
  assert.equal(v.tokenDomainSeparator, v.onChainDomainSeparator);
  assert.deepEqual(x402Authorization(v.action, v.wallet), v.authorization);
  assert.equal(x402AuthorizationDigest(v.authorization), v.digest);
  for (const c of v.invalid)
    assert.notEqual(x402AuthorizationDigest(c.authorization), v.digest, c.id);
  assert.equal((v.signature.length - 2) / 2, 65);
  assert.throws(() =>
    x402Authorization({ ...v.action, operation: 0 }, v.wallet),
  );
});

test("P1-A03.T07 call template IDs are content-addressed", () => {
  const t0 = loadFixture("wallet-policy-v7.json").lists.templates[0];
  assert.equal(CallTemplateSchema.safeParse(t0).success, true);
  for (const change of [
    { target: "0x6666666666666666666666666666666666666666" },
    { maxAmount: "1000001" },
    { targetCodeHash: "0x" + "ab".repeat(32) },
    { recipientRule: 2 },
  ])
    assert.equal(
      CallTemplateSchema.safeParse({ ...t0, ...change }).success,
      false,
      JSON.stringify(change),
    );
  const redefined = { ...t0, maxAmount: "2000000" };
  assert.equal(
    CallTemplateSchema.safeParse({
      ...redefined,
      templateId: callTemplateId(redefined),
    }).success,
    true,
  );
  assert.notEqual(callTemplateId(redefined), t0.templateId);
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

test("S9.11 simulation error codes are part of the API contract", () => {
  for (const code of [
    "SIMULATION_REVERT",
    "SIMULATION_MISMATCH",
    "SIMULATION_UNAVAILABLE",
  ])
    assert.equal(
      ApiErrorSchema.safeParse({
        code,
        message: "x",
        actionId: null,
        evidenceId: null,
        retryable: true,
      }).success,
      true,
      code,
    );
});

test("S9.13 AGENT_DECISION payload binds the decision to the agent's credential and toolset", () => {
  const payload = {
    questionId: "7c1d2b9e-3f4a-4b5c-8d6e-0f1a2b3c4d5e",
    optionId: "quote-a",
    amount: null,
    rationale: "Cheaper and capable.",
    rationaleHash: "0x" + "11".repeat(32),
    runtime: "claude-agent-sdk",
    sdkVersion: "1.0.0",
    model: "claude-opus-5-5",
    toolCallId: "call_1",
    agentTokenId: "8d2e3c0f-4a5b-4c6d-9e7f-1a2b3c4d5e6f",
    mcpToolsetHash: "0x" + "22".repeat(32),
  };
  assert.equal(AgentDecisionPayloadSchema.safeParse(payload).success, true);
  const { agentTokenId: _t, ...noToken } = payload;
  assert.equal(AgentDecisionPayloadSchema.safeParse(noToken).success, false);
  const { mcpToolsetHash: _h, ...noToolset } = payload;
  assert.equal(AgentDecisionPayloadSchema.safeParse(noToolset).success, false);
  assert.equal(
    AgentDecisionPayloadSchema.safeParse({ ...payload, optionId: null })
      .success,
    false,
  ); // needs option or amount
});

test("S4 push registration names the platform so the server picks FCM or APNs", () => {
  const base = { deviceId: `0x${"1".repeat(64)}`, pushToken: "t".repeat(32) };
  for (const platform of ["android", "ios"])
    assert.ok(
      PushRegisterRequestSchema.safeParse({ ...base, platform }).success,
    );
  assert.ok(!PushRegisterRequestSchema.safeParse(base).success);
  assert.ok(
    !PushRegisterRequestSchema.safeParse({ ...base, platform: "web" }).success,
  );
});
