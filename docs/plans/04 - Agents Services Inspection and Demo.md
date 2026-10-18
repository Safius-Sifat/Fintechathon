---
type: implementation-agent-prompt
title: Person 4 — Agents Services Inspection and Demo
version: "7.0"
updated: 2026-10-18
status: specified-not-built
owner: Person4
handoff_revision: "agent-prompt-2026-10-17"
---

# Person 4 — Agents, Services, Inspection and Demo

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.
>
> **Coordination rule:** follow the shared [team coordination and merge rules](../COORDINATION-AND-MERGE-POLICY.md). Do not change a shared interface without the review and consumer tests in that document.

> Implementation handoff: follow the numbered tasks and the identical shared contract included below. You supply the task intelligence and real services; Person2 supplies durable financial execution. Build the independent verifier early enough to catch incompatible evidence before release. Implementation agents may execute directly without delegation.

**Goal:** deliver real paid agent services and runbooks, receive/transfer fixtures, SDK/MCP/skills, independent manual/agent inspection and evidence for the complete wallet release.

**Architecture:** a typed runbook library proposes operations to Person2's worker. Two controlled provider identities sell actual Playwright browser checks for DemoUSD on Base Sepolia. The standalone verifier trusts separately supplied keys/contracts and independent RPC. SDK/MCP use the same scoped API, never direct signing keys.

**Stack:** Node22/TypeScript/Zod/viem/Playwright; canonical hashing/signature helpers from shared package; TS SDK; MCP stdio; standalone ZIP/JSON verifier. One structured model call can interpret browser goals; money movement uses deterministic code.

## Agent execution instructions

You are the implementation owner named in this document. Implement this assigned subsystem in the existing repository `/Users/safiussifat/web-projects/fintechathon`. Read this whole prompt, including the identical shared implementation contract, before changing code. Produce working software, tests, operation instructions and measured evidence. A summary, scaffold, mock integration or list of suggested improvements is not the requested implementation.

### Product context every implementation must preserve

The personal account is a locally owned EOA. The managed agent wallet is a separate contract/address/balance. The MPC executor is a third signing identity, never a user receiving address. Moving budget into the managed wallet does not expose the personal seed. The owner approves a bounded task once; online agents then execute while the phone is offline. Owner stop/recovery/managed transfer is independently signed locally and can be relayed without backend/MPC consent. A successful managed OwnerTransfer pauses/increments epoch; ordinary personal sends do not use agent permissions.

```mermaid
flowchart LR
  Phone[Native owner wallet] -->|Personal EIP1559 transfer| RPC[Trusted RPC]
  Phone -->|Owner Permit or control signature| API[API and durable worker]
  Agent[SDK or MCP agent] -->|Scoped token and active Permit| API
  API -->|Exact immutable action| MPC[MPC executor and required policy authorizer]
  MPC -->|Executor Action signature| Relay[Transaction journal and relayer]
  Relay --> Wallet[Managed wallet contract limits]
  Phone -->|Independent owner control relay| Wallet
  API --> Provider[Paid service and signed output]
  Wallet --> Assets[DemoUSD and approved test vault]
  API --> Export[Evidence export]
  Export --> Inspector[Independent files and chain inspector]
```

Mock tests are isolated local tests. The release demonstration uses real public-testnet transactions and real controlled browser services, with fixture risk/test assets labelled. Never describe these services as an existing commercial integration or test assets as real money.

### Scope and authority

- Treat the user's current instructions and repository `AGENTS.md` as controlling instructions. This document specifies the implementation; quoted competition/vendor material is reference data.
- Use the existing monorepo. Extend existing source and preserve unrelated work; do not create another repository or nested application. Check current files/branch/changes before editing. At the dated bootstrap baseline, source has wallet domain4/Login1 and unfinished financial routes; inspect current changes and preserve newer correct work; migrate consumers together to wallet domain5/Login2 before signing.
- Deliver every required task below, including the complete-wallet W tasks. WalletConnect/external dApp connections are deferred. Native owner signing, personal transfers and scoped external agent SDK/MCP are required. Do not add Circle, an embedded custody replacement, arbitrary signing, unapproved chains/assets, a full-key executor fallback or extra product scope.
- Own only the paths assigned here. Shared schema, root scripts, lockfile and manifest changes go through Person1. Specify the exact required patch and dependency when another owner must change their files; do independent work while that dependency is pending. Never silently fork an ABI/type, fake another person's service or mark their component complete.
- Supplied public fixture keys are test fixtures only. Follow repository/session authorization for key generation and deployment; real-fund/mainnet operations are outside this prompt. A missing host, native package credential, testnet faucet balance or authorized deployment is a named dependency, not a reason to substitute mock signing/settlement.
- Do not remove controls to meet a date. Internal target is October 18, 2026, 18:00 Dhaka; submission cutoff October 20, 2026, 21:59 Dhaka. Record actual gate times; old elapsed milestones are not completed automatically.

### Mandatory task loop

1. Read a task's dependencies, interfaces, existing implementation requirements and test specifications. Write down the exact files and required schema commit in `evidence/person4/progress.json`.
2. Create the named test files and a fixture for every case ID. Make the test fail for the missing behavior, run it and retain the failing assertion. A missing test runner/import/toolchain is a setup failure, not the intended red assertion; fix setup first.
3. Implement the task in small changes. Keep identifiers, type order, amount units, nonce lanes and trust boundaries exactly as specified. The implementation checklist and the test matrix are both required.
4. Run the targeted cases, then the entire affected package suite and type/build checks. When a dependency changes, rerun consuming tests against its actual commit. Mocked RPC/MPC/provider tests qualify local behavior only; the milestone also needs the real integration evidence stated below.
5. Record each case's command, exit status, expected/observed state, assertion result, commit and redacted artifact references. A missing credential/device or skipped test is BLOCKED/NOT_RUN, never PASS. Fix owned failures and repeat. Never edit expected outputs to match an incorrect implementation.
6. Supply the actual output/interface sample to the receiving owner and obtain integration confirmation. Use a focused commit if commits are authorized in the current session; otherwise leave a clearly described, reviewable working-tree change. No automatic push/publish/submission is requested by this prompt.
7. Mark the task complete only when its mandatory outcome and every applicable case pass, and any explicitly required physical-device/public-chain gate has evidence. Continue to the next unblocked task; finish with the report format below.

### Test harness contract — build this before relying on commands

Commands in task blocks are **required implementation targets**, not claims that the bootstrap already implements them. At the bootstrap baseline, `make check-*` and release targets intentionally fail. Person1 owns `scripts/check-suite.mjs` and root wrappers; each owner supplies the real package tests, and Person4 supplies `evaluation/run.ts` and `evaluation/release-check.ts` consumed by those wrappers. Coordinate with Person1 to replace each placeholder only after a real test runner exists. A command must exit nonzero for missing suites, zero discovered tests, assertion failure or required prerequisite failure. Do not use `--if-present`, `|| true`, empty tests or skipped required suites to make acceptance green.

- TypeScript package tests: use Node's test runner through the existing pinned `tsx`; define `test` as `tsx --test test/*.test.ts`. Keep Node mobile tests limited to pure domain/view-model/API logic; native UI and real React Native screens use instrumentation/installed flows, not an unsupported direct Node import. Test files are named explicitly in each task; Node test names contain the exact case ID. Go/Solidity/Kotlin test identifiers use the same ID with hyphens/dots replaced by underscores and record the canonical ID in the result mapping. A package `check` runs its complete tests and typecheck. Resolve/install any additional test dependency explicitly and record its exact lockfile version through Person1.
- Solidity: Solidity 0.8.28 Foundry configuration and OZ5.4.0 already exist. Add `forge-std` from its official repository with a recorded exact commit/remapping; record the Foundry toolchain version. `forge build`, named `forge test` suites and invariants are all required. No business contract is currently supplied.
- MPC: run actual pinned Go1.25.8 tests in both modules plus an isolated node-qualification runner. Mock signatures are insufficient for the real MPC gate. Pin and inspect dependency/source/configuration before starting nodes.
- Android: define native library Gradle project `:owner-wallet`, JVM tests, connected instrumentation and an installed-app flow runner. Record generated native project/module wiring and dependency pins. Implement and pin the Maestro CLI prerequisites for the listed installed-app flows; biometric/device-credential/restore cases may require a recorded human operator, and an omitted manual step cannot pass. JVM/RN mocks cannot qualify Keystore, biometric cancellation, restore or physical signing. Device-only cases require the actual device record.
- Cross-owner integration: Person4 supplies scenario definitions and the runner; each owner supplies assertions for their component. `make check-integration` must run the scenarios against real configured services and a real testnet manifest, or fail with the unmet prerequisite. CI/local deterministic tests use isolated local fixtures. Testnet faults use valueless test assets; public chain reorgs are modelled on an isolated local chain, never induced on public infrastructure.
- `make release-check` is a separate evidence/artifact gate. Passing unit tests or `/healthz` does not satisfy it. `/readyz` stays503 until required service dependencies, versions and applicable qualification gates actually pass.

### Required evidence format

Store `evidence/person4/cases/<task-id>.json` and `evidence/person4/progress.json`. Each case record has `{caseId,taskId,status,sourceCommit,workingTreeDigest,schemaCommit,environment,command,exitCode,expected,observed,startedAt,finishedAt,artifactRefs,limitations}`. Status is PASS/FAIL/BLOCKED/NOT_RUN. Timestamps include timezone. Artifacts may include redacted test output, canonical fixture/hash, chainId/transaction/block hash, independent verifier report, device/build fingerprint or screenshot. Never include mnemonic, BIP39 passphrase, share, private key, raw MPC rounds, refresh token, credential-bearing RPC URL or hidden model reasoning. Test secrets use isolated local ignored configuration.

Use base sourceCommit plus a working-tree diff digest while work is uncommitted; rerun release checks against the final identified source. Parameterized cases must record each variant and assertion, not only an aggregate label. A PASS test case may correctly expect an inspector finding to be UNVERIFIABLE; case success is not the same as all findings being PASS.

A milestone record lists all required case IDs, dependencies and actual pass time. All required cases must be PASS; absence is not success. Reproduce at least one prior failure after its fix. Preserve old failed runs rather than overwriting history. If authentic inspection returns PENDING/UNVERIFIABLE, preserve that result and explain it; verification correctness does not mean forcing every finding green.

### Final implementation report required from the receiving agent

1. **Implemented:** task IDs, owned files, source/schema/deployment versions and actual delivered capabilities.
2. **Verified:** exact commands and case IDs, counts of PASS/FAIL/BLOCKED/NOT_RUN, device/chain references and artifact paths.
3. **Integration:** upstream/downstream commit IDs and the confirmed end-to-end flows.
4. **Incomplete:** exact missing capability/resource, security impact, owner and next executable action. Never say complete if any required gate is missing.
5. **Operate:** fresh-start, migration, funding, restart, backup/restore and rollback instructions relevant to this owner.
6. **Review:** changed-file summary, residual limitations and no-secret check. Do not claim audited safety, mainnet readiness, full MetaMask parity or competition success.

**Tool references:** [Foundry testing](https://getfoundry.sh/forge/tests), [Forge Standard Library](https://getfoundry.sh/reference/forge-std/overview). Pin the actual resolved tool/dependency versions and verify their behavior; documentation is not a passing implementation result.

## Owner milestones — mandatory exit gates

Task-level case IDs and public/device evidence below are the gate criteria. Refer to S7 for the original Dhaka target times. No gate passes merely because its target time elapsed.

| Milestone | Required task coverage | Mandatory outcome |
| --- | --- | --- |
| M0 / W0 | `P4-01, P4-W01` | Real target behavior, Conditions/provider/receive fixtures and exact API/data examples accepted by owners1/2/3. |
| M1 / G1 | `P4-01, P4-05 early` | Actual Playwright outputs and verifier positive/negative fixtures run independently; missing components not disguised as completed services. |
| M2 / G2 | `P4-02/03/05` | Actual public payment unlocks one real output; authentic export independently inspected and correct provisional/unverifiable facts retained. |
| M3 / G3,W2/W3 | `P4-03/04/05, P4-W02` | Three bounded workflows/skills, external SDK/MCP, paid-failure fallback and owner/manual attribution integrated. |
| M4 / G4,W4 | `P4-06, P4-W03` | 24 declared agent evaluation outcomes plus separate WQ01–14 evidence; security/denial/failure results and denominators preserved. |
| M5 / G5,W5 | `P4-06, P4-W03` | Complete actual source/APK/deploy/security/evaluation/receipts/verifier/deck/video packet, hashes and known gaps verified; upload receipt only if actually uploaded. |
| MA / W0–W4 (v7) | `P4-A01, P4-A02, P4-A03` | Claude Agent SDK agent completes real tasks through MCP only; injection, bounds, x402 and verifier v7 cases PASS; AQ01–AQ14 evaluation assembled. |

## Start here — current release scope and task order

**Required:** the complete personal-wallet and managed-agent flows in S8. **Deferred:** WalletConnect/external dApp connections; no WalletKit dependency, Reown projectId, dApp screen or pairing acceptance gate. External agent SDK/MCP access remains required.

Sections 2–6 and the wallet tasks in section 7 are one delivery. Follow the sequence below; wallet tasks are not work postponed until after the agent-only path. Existing bootstrap source needs W0 migration before new financial signatures. Documentation 7.0 keeps wallet domain 5, Login 2 and agent receipt/runbook schema 4, moves Invoice to domain 2 and adds the S9 agentic layer and policy controls; section 8 tasks are required in the same delivery.

| Work order | Task IDs | Deliverable / dependency |
| --- | --- | --- |
| Real fixtures and protocols | `P4-01 + P4-W01` | Publish real browser-check targets and chain-qualified receive/transfer QR scenarios using W0 schemas. |
| Inspection early | `P4-05 + P4-W02` | Build independent six-finding inspection, including owner/manual attribution, against authentic and tampered fixtures while providers are built. |
| Actual paid work | `P4-02 + P4-03` | Verify real testnet settlement, produce actual browser output and implement bounded browser/vault/schedule runbooks consumed by Person2’s worker. |
| External agent access | `P4-04` | Ship typed SDK/MCP/skill examples through scoped backend permissions; no owner signer or financial bypass. |
| Full-system release proof | `P4-06 + P4-W03` | Collect each owner’s original-agent and wallet results, run complete journeys and assemble the measured demo/submission. |
| Real agent and x402 | `P4-A01 + P4-A02 + P4-A03` | Agent on the Claude Agent SDK with MCP tools and runbook questions, then x402-formatted providers and verifier checks. |

**Completion record:** for each task record source commit, shared-schema commit, command/device or chain reference, observed result and known gaps. Unrun or failed cases stay incomplete. Both original G/Q and wallet W/WQ gates apply; no acceptance or implementation tests were executed by updating this document.

## 1. Complete deliverables

| Output | Owned files | Acceptance |
| --- | --- | --- |
| Preparation/runbooks | `packages/runbooks/src/{prepare,advance,browser,liquidity,schedule,validators}.ts`, versioned manifests/guides | Shared snapshot→decision interface; no direct signer access |
| Paid counterparties | `apps/provider/src/{quotes,payments,fulfillment,receipts,auth,controls}.ts` | Real on-chain invoice verification and actual browser output |
| Fixtures | `demo/targets/{healthy,broken}`, `demo/provider-config.json`, `demo/wallet-requests`, `demo/wallet-scenarios.json` | Actual checkout results, protected failure modes and valid/invalid ETH/ERC20 receive-request fixtures |
| Agent integrations | `packages/sdk`, `apps/mcp`, `examples/external-agent.ts` | Read/prepare/run/evidence scopes, no Admin or signing bypass |
| Independent inspector | `packages/verifier/src/{bundle,integrity,authority,policy,settlement,delivery,completion,owner-transfer,activity,cli}.ts` | Six findings plus correct OWNER_CONTROL/manual activity attribution without our backend |
| Evaluation/release | `evaluation`, `demo/script.md`, `submission`, `evidence/person4` | Original agent Q cases plus wallet WQ cases, measured complete-app demo, English deck/bundle |

Person1 supplies authoritative types/ABI; Person2 hosts durable jobs, signs and pays, records evidence; Person3 owns native approval/UI. You assemble release materials, but each person supplies their own tests/security/deploy evidence. Do not become the unassigned implementer of another owner's missing feature.

## 2. Real provider before elaborate agents

### P4-01. Typed fixtures and actual browser output, G0–G1

**Create:** healthy/broken checkout fixtures, provider config, BrowserResult validator, driver mock using shared fixtures.

- [ ] Publish exact target IDs `checkout-healthy` and `checkout-broken`, expected title and fixed test form fields/selectors. Healthy produces successful form confirmation; broken accepts page load but intentionally fails form submit. Use synthetic data only. First run Playwright directly and retain actual screenshot/log hashes for both.
- [ ] Host declared HTTPS fixture origins; browser sandbox permits only fixed targets and required static assets. Reject arbitrary URLs/scripts/selectors, unexpected redirects, loopback/private-network egress. Isolated local development fixture addresses are explicit exceptions, never release arbitrary private access.
- [ ] Parse runbook inputs strictly. Browser input `{targetId,checks,maxPaidAttempts,maxSteps,taskDeadline}`; limits as S2. Liquidity input `{command:'deposit'|'redeem',amountUnits,maxSlippageBps:50}`; schedule input exact Schedule. No model-generated contract address or raw calldata is accepted.
- [ ] Export `prepareTask({runbookId,goal,input},deps)` → `{conditions,scope,runbookManifest,needsOwnerReason:null|string}`. For browser, one structured model response may suggest permitted checks/interpretation; validate with schema and force owner review. Missing provider capability/ambiguous target/unsupported goal returns needsOwnerReason. Liquidity/schedule are deterministic. Model API/account is provided as deployment resource, not baked secret.
- [ ] Define providers a/b with distinct signer=recipient keys, signed prices200000/350000 and trusted manifest bindings. Provider a supports pageLoad/title; b additionally supports formSubmit. Normal comparison/fallback uses pageLoad/title; formSubmit requirement makes b the eligible choice. Send public addresses to Person1 before deployment. Private provider keys stay only in provider service. Fixed-target browser check is a real service call; no claim of third-party commercial integration.

**Acceptance:** real BrowserResult passes schema for healthy and broken; formSubmit=false is valid negative observation; arbitrary target/URL and invented extra checks fail before quote.


#### Required execution contract — P4-01

**Prerequisites / blockers:** Person1 Conditions/BrowserResult/runbook/provider fixtures and trusted target manifest; isolated Playwright browser runtime.

**Required source and test files:** `demo/targets/{healthy,broken}`; `demo/provider-config.json`; `packages/runbooks/src/{prepare,validators}.ts`; `apps/provider/test/{targets,inputs,capabilities}.test.ts`.

**Consumes / produces:** prepareTask({runbookId,goal,input},deps)->{conditions,scope,runbookManifest,needsOwnerReason}; target IDs checkout-healthy/checkout-broken; browser check keys pageLoad/title/formSubmit in fixed canonical order.

**Implementation algorithm:**

```text
Serve fixed synthetic checkout targets with known title/form outcome and exact trusted HTTPS origins/selectors.
Constrain browser egress to declared target/static hosts; reject arbitrary URL/script/selector/redirect, loopback/private-network access except explicit isolated development fixtures.
Validate typed browser/liquidity/schedule inputs before interpretation. Optional one structured model call may suggest permitted browser checks; schema/target/capability validation and owner review remain mandatory.
ProviderA supports pageLoad/title at200000 units, B additionally formSubmit at350000; identities are signer=recipient and manifest-bound. No charge at preparation/quote.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-01.T01` | Direct Playwright visit both fixed targets | Real screenshot/log hashes; healthy form true, broken form false; actual result passes shared schema. |
| `P4-01.T02` | Request unsupported URL/script/selector/redirect/private network | Blocked before browsing/quoting; no secret/external egress. |
| `P4-01.T03` | ProviderA selected for formSubmit versus B | A excluded; B eligible at350000; no invented capability. |
| `P4-01.T04` | Ambiguous target/goal or model-injected wallet/amount/tool command | needsOwnerReason or validation failure; no executable financial parameter/permission added. |
| `P4-01.T05` | Requested negative form inspection with actual valid evidence | formSubmit=false remains valid delivered observation, not malformed result. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-01.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/provider check
./scripts/pnpm.sh --filter @mandate/runbooks check
make check-agents
```

**Mandatory outcome before this task is complete:** G1 real browser observations and strict typed preparation available to Person2/3 before paid integration; test target behavior is reproducible.

### P4-02. Signed invoice/payment/fulfillment, G1–G2

**Create:** S6 check/result routes, provider invoice/result persistence and transaction verifier.

- [ ] `/providers/:id/check` returns HTTP402 with actual S3 invoice/provider signature. Hash exact fixed-ordered input.≤60s lifetime, invoiceId randombytes32, taskId chainbytes32, wallet correct; recipient equals provider. Quote idempotency/cache prevents uncontrolled duplicate invoice generation for same requested quote window, but a renewed expired quote has a fresh ID.
- [ ] `/providers/:id/result` authenticates worker-only credential with tenant invoice context; verify receipt canonical success, three confirmations, exact emitted ActionExecuted+DemoUSD Transfer amount/from wallet/to provider and invoice/request/input IDs. Use generated ABI and manifest token/wallet. A tx hash alone or unrelated token transfer is insufficient.
- [ ] Persist invoice fulfillment lock and status. Run actual Playwright once after qualifying payment; retries retrieve original output,202 while pending, never re-charge. Sign DeliveryReceipt over exact canonical resultHash and payment hash; output returns actual screenshot/log bytes and hashes as S6. Bound artifact/result sizes and reject malformed media.
- [ ] Protect controls behind demo operator auth: a paid provider-a timeout, a malformed output mode, repeat original request and tampered export copy. Failure switches affect only fixture/provider service, cannot change wallet permissions or execute arbitrary code. Paid timeout records an actual payment with failed delivery; no refund is assumed.
- [ ] Test unpaid/unrelated/reverted/insufficient-confirmation/reorged payment, mismatched invoice, duplicate result retrieval, wrong provider key, stale future-dated result and missing requested check. Reorg invalidates delivery's current settlement finding even if original output exists.

**Acceptance:** a real Base Sepolia200000-unit PAY unlocks actual browser output; duplicate retrieval returns same receipt/result without another wallet transfer. Provider has no wallet seed/executor share/agent Admin authority.


#### Required execution contract — P4-02

**Prerequisites / blockers:** P4 real targets/provider identities; Person1 actual token/wallet ABI and Person2 payment path.

**Required source and test files:** `apps/provider/src/{quotes,payments,fulfillment,receipts,auth,controls}.ts`; `apps/provider/migrations/0001_provider.sql`; `apps/provider/test/{invoice,payment,fulfillment,retrieval}.test.ts`.

**Consumes / produces:** S6 check returns402 Invoice/providerSignature, result accepts invoiceId/requestId/paymentTxHash and authenticated worker context; returns202pending or exact signed result/artifacts. Quote signature covers<=60s invoice life.

**Implementation algorithm:**

```text
Quote binds wallet/task/recipient/amount/inputHash/issue/expiry; renewal creates fresh invoice only after safe caller decision, never another automatic payment.
Result independently verifies receipt success/canonical3confirmations, exact ActionExecuted+DemoUSD Transfer and invoice/request/input/wallet/recipient/amount before work.
Under unique invoice fulfillment lock, run Playwright once; store original result/artifact hashes/DeliveryReceipt. Repeated retrieval returns original bytes or202, never charge/run again.
Invoice expiry constrains payment acceptance; it does NOT expire a payment already validly included or forbid retrieving its paid output later. Task deadline/freshness/retention are separate limits.
First completed result freshness<=300s old/<=5s future; do not re-date on retry. Artifacts<=10MiB/result; malformed result/failure switches are operator-authenticated fixtures only.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-02.T01` | Unpaid/unrelated/reverted/wrong-wallet/wrong-token/underconfirmed txHash | No paid work or successful receipt; explicit pending/denial without balance invention. |
| `P4-02.T02` | Actual successful200000PAY to A reaches3canonical confirmations | Exactly one Playwright job and signed result bound to actual payment hash/input; retain screenshot/log bytes. |
| `P4-02.T03` | 20concurrent result retrievals plus service restart | One fulfillment/output; identical original receipt/artifact hashes, no recharge. |
| `P4-02.T04` | Valid paid invoice retrieved after its quote expiry | Original result remains retrievable subject to task/retention policy; no second charge/fresh timestamp. |
| `P4-02.T05` | Wrong provider key/input/resultHash, missing requested check, future/stale result or oversized bytes | Validator rejects without claiming useful delivery. |
| `P4-02.T06` | PaidA timeout/malformed output control; unauthorized control caller | Authorized fixture creates honest paid-failure evidence; unauthorized caller cannot alter mode. |
| `P4-02.T07` | Canonical receipt reorged after result exists on local fault chain | Orphaned payment with no canonical replacement is PENDING settlement, even though original output bytes remain; no final settlement is claimed. Reconcile to the later actual winning transaction if one appears. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-02.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/provider check
make check-agents
make check-integration
```

**Mandatory outcome before this task is complete:** Q06/07 actual testnet payment unlocks useful output and original retrieval idempotence. No claimed third-party commercial service or x402 interoperability beyond this declared HTTP402 protocol.

## 3. Bounded agent workflows and integrations

### P4-03. Durable runbook decisions, G1 stub → G3 complete

**Create:** `@mandate/runbooks` exported prepareTask/advance/validateResult, manifests and `skills/{browser-check,liquidity-keeper,scheduled-pay}/SKILL.md`.

**Consumes:** S5 snapshot/deps from Person2. **Produces:** only shared RunbookDecision. Financial actions are proposals, not already signed calls.

- [ ] Browser Check filters owner-allowed providers by required check support, gets signed quotes, chooses cheapest valid price with provider ID tie-break, then PROPOSES PAY. `decisionKey = chainTaskId + ':browser:pay:' + attemptIndex`; attemptIndex advances only after persisted previous settlement/delivery outcome, not on process restart.
- [ ] After proposal, wait for matching stored INCLUDED payment before retrieve; UNKNOWN/SIGNING/SUBMITTED do not permit another payment. On missing/invalid delivery, retrieve original receipt up to3 attempts with bounded backoff within10min/8workflow phases; invoice expiry constrains payment acceptance, not retrieval of already paid output. Subsequent fallback uses another approved eligible provider only if remaining gross cap/pay count permits. Never ask model to override limits.
- [ ] Validate requested checks/input/result hash/provider receipt/artifact bytes/freshness. Distinguish negative inspection from absent/malformed delivery. Return COMPLETE for valid requested observations; otherwise FAILED/NEEDS_OWNER with original failure and gross spend preserved. Person2 handles signed CLOSE separately.
- [ ] Liquidity Keeper proposes one explicitly approved deposit/redeem, uses trusted DemoVault preview/risk service and observed pending liquidity needs. Deposit needs fresh NORMAL signal; warning/stale stops deposit. Withdrawal is to wallet only; unresolved/failed redemption blocks dependent purchase. `decisionKey = chainTaskId + ':liquidity:' + command`; no autonomous repeated deposit cycle.
- [ ] Risk source `GET /demo/risk` returns `{sourceId:'demo-risk-v1',state:'NORMAL'|'WARNING',observedAt,sequence}` through authenticated service; signal is fixture/recorder assertion, not independently proven market risk. Person2 policy checks its own freshness/source. Label it simulated.
- [ ] Scheduled Pay derives due period from trusted chain time, exact owner Schedule, proposes unused current period only; skip missed windows, no model/catch-up. `decisionKey = chainTaskId + ':schedule:' + period`. Period and transfer amount cannot change after approval.
- [ ] Build reproducible manifests by canonical hash of emitted JS/schema/validator/lock artifacts. Publish hashes to Person1/2/3; changed code/hash requires fresh owner Permit. Skill guides document input schemas, owner handoff, permissions, status polling, denial and retry—not signing secrets or authority grants.

**Acceptance:** calling advance twice with same snapshot makes same decisionKey; restart cannot make another payment intent while old one unresolved; browser fallback totals0.55 gross for paid A failure+B success; asset/schedule follow separate explicit permissions.


#### Required execution contract — P4-03

**Prerequisites / blockers:** P1 S5/S6 exact DTOs/manifests and Person2 durable snapshot/action status contract.

**Required source and test files:** `packages/runbooks/src/{prepare,advance,browser,liquidity,schedule,validators}.ts`; `packages/runbooks/test/{browser,liquidity,schedule,determinism}.test.ts`; `manifests`; `skills/{browser-check,liquidity-keeper,scheduled-pay}/SKILL.md`.

**Consumes / produces:** advance(snapshot,deps):Promise<RunbookDecision>; decisions PROPOSE/WAIT/COMPLETE/FAILED/NEEDS_OWNER with nextState. Deps quote/retrieve/readVault/readRisk only; worker creates requestId/time/signature/nonces and durable actions.

**Implementation algorithm:**

```text
Browser: filter allowed/capable providers -> cheapest valid quote with providerId tie-break -> PROPOSE PAY using chainTaskId:browser:pay:attemptIndex -> WAIT until matching INCLUDED -> retrieve original<=3 attempts -> validate -> COMPLETE or bounded alternative eligible provider.
Count workflow phases, not2s polls, as max8steps. A two-provider failure path uses prepare/first payment/first retrieval+validation/fallback quote+payment/second retrieval+validation/completion within8 phases; WAIT and bounded retries inside a retrieval phase do not independently consume phase count. Track retrieval attempts separately; max3payments/10min/gross cap all still apply.
Never fallback while prior settlement UNKNOWN; paid failure preserves gross cost. Invoice expiry is not postpayment retrieval expiry. No repeat payment to retrieve an already paid result.
Liquidity proposes one exact approved deposit/redeem with preview/slippage/risk/floor checks; pending redeem supplies no spendable funds.
Schedule derives exact due period from trusted chain timestamp, once in signed window; missed periods skip. Same snapshot produces same logical decisionKey; durable worker deduplicates before financial execution.
Build runbook manifest from emitted JS/input/output schema/validator/lock hashes; changed artifacts need new owner grant. Skill guides explain input, handoff, scopes, status, denial/retry, never secrets.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-03.T01` | Same snapshot advanced twice and process restarted while PAY unresolved | Same decisionKey; WAIT rather than second pay; worker dedup means at most one business action. |
| `P4-03.T02` | A0.20 paid fails, original retrieved<=3times, B0.35 delivers with remaining cap | Gross0.55, original failure retained; bounded phase/attempt/time limits respected; useful result validated. |
| `P4-03.T03` | Remaining cap0.50 after original A payment or no allowed alternative | No fallback charge beyond owner permission; FAILED/NEEDS_OWNER includes true spent cost. |
| `P4-03.T04` | formSubmit requested; A cheap but incapable | Choose B, never A by price alone. |
| `P4-03.T05` | Prompt injection inside provider output asks to change recipient/tool/cap | Treated as data; no raw financial call/permission override. |
| `P4-03.T06` | WARNING/stale risk or insufficient liquid after pending withdrawal | Deposit/purchase proposal denied or waits, no phantom liquidity. |
| `P4-03.T07` | Schedule period replay/missed window/restart | Exact once-per-current-period decision, no catch-up or altered amount/recipient. |
| `P4-03.T08` | Validator/artifact hash differs from owner-approved manifest | RUNBOOK_VERSION/NEEDS_OWNER; no execution under old grant. |
| `P4-03.T09` | Negative but well-formed form observation versus missing/malformed result | Negative observation completes valid inspection; malformed/missing delivery does not. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-03.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/runbooks check
make check-agents
make check-integration
```

**Mandatory outcome before this task is complete:** Q07/08/09 bounded workflows use actual worker and useful outputs; no parallel worker, direct signer or model-controlled money. Phase/retrieval/time accounting is documented and tested.

### P4-04. TypeScript SDK and MCP, G3

- [ ] SDK exports `createTask`, `getTask`, `runTask`, `getWallet`, `getEvidence`; import generated API types and use caller-provided baseURL/token. Reuse original idempotency key on same request retry;409/UNKNOWN propagate instead of creating new money movement. No owner signing/Admin functions in agent SDK.
- [ ] MCP stdio tools `mandate_create_task`, `mandate_get_task`, `mandate_run_task`, `mandate_get_wallet`, `mandate_get_evidence` map one-to-one; credentials from environment, never tool results/logs. Enforce local input schemas and service scopes. Task creation may return AWAITING_OWNER and agent must wait for human approval, not manufacture a signature.
- [ ] `examples/external-agent.ts` demonstrates token-based prepare→owner handoff→run→poll→download evidence through same API. Works independently of app login session; cannot escape its wallet/task scope. Evidence download requires explicit evidence scope.
- [ ] Test read-only token denied prepare/run, prepare-only denied run, revoked/expired token rejected, wrong task/tenant denied. Prompt injection in provider output is treated as data and cannot add tools/permissions/raw contract calls.

**Acceptance:** external client starts already approved task while phone offline through the same budget/policy/MPC path. An MCP tool cannot spend without an active owner Permit.


#### Required execution contract — P4-04

**Prerequisites / blockers:** P2 actual scoped API, Person1 API validators and active owner-approved task for positive integration.

**Required source and test files:** `packages/sdk/src/index.ts`; `packages/sdk/test/{client,scopes,retries}.test.ts`; `apps/mcp/src/{index,tools}.ts`; `apps/mcp/test/{tools,transport}.test.ts`; `examples/external-agent.ts`; `skill guides`.

**Consumes / produces:** SDK createTask/getTask/runTask/getWallet/getEvidence plus allowed typed activity reads; MCP mandate_create_task/get_task/run_task/get_wallet/get_evidence. Caller supplies baseURL/scoped token; no owner signer/Admin/refresh/session revoke API in agent tools.

**Implementation algorithm:**

```text
Map each tool directly to one typed API operation. Preserve Idempotency-Key/body across retries;409/UNKNOWN propagates, never generates another payment.
Require owner handoff when AWAITING_OWNER; agent cannot fabricate or request generic native signing.
Read/prepare/run/evidence scopes and wallet/task restriction are service-enforced; credentials from local environment and absent from stdout/tool result/logs. Stdio stdout carries protocol only.
Use bounded polling/backoff and authenticated evidence download; downloaded untrusted output never becomes tool configuration or shell code.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-04.T01` | Read-only/prepare-only token attempts other operations | Service/tool surface denies; no client-side-only permission trust. |
| `P4-04.T02` | Revoked/expired/wrong-wallet/task token; evidence scope absent | Rejected without leaking private artifacts or other tenant metadata. |
| `P4-04.T03` | Lost run/create response then retry same logical request | Original idempotency key/body reused; same task/action;409 surfaced on mutation. |
| `P4-04.T04` | Already approved task started from external example while phone offline | Same policy/reservation/MPC/contract pipeline pays; no dependency on current mobile login JWT. |
| `P4-04.T05` | MCP input contains unknown fields/recipient/cap/private-key injection | Schema rejects or stores as inert goal data for owner review; no raw signing route. |
| `P4-04.T06` | Inspect stdio traffic/errors/recorded example output | No token/refresh/seed/key in protocol/logs; credentials are not part of model-visible tool output. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-04.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/sdk check
./scripts/pnpm.sh --filter @mandate/mcp check
make check-agents
make check-integration
```

**Mandatory outcome before this task is complete:** External agents can operate granted tasks independently of phone session, yet cannot bypass owner/task scopes. Working examples and exact denial behavior shipped.

## 4. Independent inspection is a first-class deliverable

### P4-05. Build verifier against fixtures, G1 → G3

**Create:** verifier CLI/modules above and fixture ZIPs valid/tampered/missing/provisional. Start this alongside provider work, not after filming.

- [ ] Read ZIP defensively: normalize paths, no traversal/symlinks, size/file-count limits, schema validation, no executable artifact loading. Trust separate deployment manifest only; compare chain ID/contracts/runtime code hashes/public signer keys. No backend credentials, API calls, owner key or service database.
- [ ] Integrity: recompute RFC8785 event hashes/links/sequence, artifact salted/unsalted commitments, checkpoint Ed25519 signature, expected publisher anchor/digest/sequence and canonical/final status. Altered copy fails. Missing retained data is UNVERIFIABLE. No anchor-yet is PENDING, not proof of forgery.
- [ ] Authority: recover owner Permit/Admin/executor Action/provider Invoice/DeliveryReceipt, verify domains, hashes, nonce/epoch and chain order of activation/pause/revoke/close. No signature alone proves MPC ran; mark threshold-process claim recorder_assertion unless supported by separate operational assessment.
- [ ] Policy: replay contract-visible payment caps/counts/floor/periods and token movements at relevant blocks from deployment. Check recorded conditions/runbook commitments and actual installed validator artifact hash. Backend-only reservations/rate/risk/deadline judgments without independent evidence remain UNVERIFIABLE; do not convert matching logs into policy truth.
- [ ] Settlement: receipt success, correct wallet/token/to/amount/events/actionDigest, canonicality/finality, nonce replacement lineage; scan supported token/vault outflows across full wallet history to inspection head and flag unmatched items. RPC lacking required history yields explicit gap, not assumed PASS. Use at most declared test assets; no claim all-token forensic scan.
- [ ] Delivery: verify exact original result/artifact bytes/provider signature/input/freshness; expose provider claim versus independent browser execution evidence. A signed screenshot is not a proof of website truth. Completion: run pinned built-in deterministic validator for requested observations, preserving negative form result as valid inspection; report authority closure separately.
- [ ] Return all six findings with rule/evidence IDs/basis; allow independent chain facts to remain valid even when another event is tainted. Overall PASS requires every applicable rule independently supported; unresolved subchecks mean PENDING/UNVERIFIABLE. No top-level green badge that hides gaps.
- [ ] S6 CLI exit codes/output are exact; no backend/spending authority required. Anchor finality and absent history have reproducible fixture cases.

**Acceptance:** authentic G2 export verifies supported facts against public chain; tampered copy produces integrity FAIL; missing artifact UNVERIFIABLE; earlier finalized evidence and fresh INCLUDED evidence have different settlement findings. If backend-only assertions prevent full PASS, report that honestly; the required outcome is correct findings, not manufactured six greens.


#### Required execution contract — P4-05

**Prerequisites / blockers:** P1 evidence/financial vectors and separately trusted manifest; P2 authentic fixture export; read-only independent RPC.

**Required source and test files:** `packages/verifier/src/{bundle,integrity,authority,policy,settlement,delivery,completion,cli}.ts`; `packages/verifier/test/{zip,integrity,authority,policy,settlement,delivery,completion,cli}.test.ts`; `fixtures/{authentic,tampered,missing,provisional}`.

**Consumes / produces:** mandate-verify --bundle ZIP --trusted manifest --rpc URL --out report -> six Findings and unmatchedOutflows/limitations; exit0 all required PASS,1 any FAIL,2 noFAIL butpending/unverifiable,3 malformed/toolerror. No backend API/DB/signing credential.

**Implementation algorithm:**

```text
ZIP reader: reject traversal/absolute paths/symlinks/duplicate normalized names; max1000files/100MiB uncompressed and100:1 ratio, bounded depth/JSON payload. Never execute imported artifact/code.
Trust supplied manifest keys/addresses/code hashes independently, not export declarations. Validate chain84532; preserve incomplete historical RPC coverage.
Integrity: canonical event sequence/hash/artifact salted+provider hashes/checkpoint Ed25519/anchor actual publisher+digest+finality. Authority: recover exact owner/executor/provider domains and chain-ordered epoch/nonce/activation/stop/close.
Policy/settlement: reconstruct supported token/vault financial counters/floor/periods/actual transfers from known deployment->inspection head; distinguish provisional/final/reorg/replacement. Scan unexplained supported outflows, do not count finalized twice.
Delivery/completion: original bytes/input/provider signature/freshness and pinned built-in validator; negative observation can be valid. Signatures/anchors prove commitments, not website truth or actual MPC participation.
Off-chain-only reservation/rate/risk/process claims lacking independent support stay UNVERIFIABLE. Correct authentic report may exit2; do not weaken checks to force sixPASS. CLI overall exit status follows aggregate findings exactly.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-05.T01` | Change one event byte/remove sequence/reorder event/change artifact or checkpoint | Integrity FAIL with specific rule/evidence reference; original authentic fixture preserved. |
| `P4-05.T02` | Unanchored or3confirmation payment not finalized | Corresponding finding PENDING; no false forgery/finality; aggregate exit2 if noFAIL. |
| `P4-05.T03` | Missing retained artifact/history RPC range | UNVERIFIABLE with coverage/limitation, not fabricated PASS/empty scan. |
| `P4-05.T04` | Export supplies attacker key/contract/chain matching its own signatures | Separate trusted manifest mismatch denies; self-declared trust cannot validate authority. |
| `P4-05.T05` | Wrong recipient/amount/token/task/input/digest or replay/unmatched supported outflow | Authority/policy/settlement fails for actual violated rule, with public chain basis. |
| `P4-05.T06` | Valid negative form result/provider claim versus absent output | Valid requested observation distinguished from missing delivery; claim basis labelled, not proof of website truth. |
| `P4-05.T07` | ZIP traversal/symlink/bomb/duplicate path/malformedJSON | Safe reject, no outside writes/code execution; exit3 tool/input error. |
| `P4-05.T08` | Synthetic aggregate finding fixtures PASS,FAIL,PENDING,UNVERIFIABLE and CLI error | Exit0/1/2/2/3 exactly; anyFAIL dominates pending. |
| `P4-05.T09` | Authentic G2 export with off-chain policy assertions not independently supported | Supported chain/signature/artifact facts verified, remaining assertions UNVERIFIABLE; correct non-green report is accepted as verifier correctness. |
| `P4-05.T10` | Independent tool run with backend all stopped | Uses only files/trusted config/RPC; results do not depend on service verdict or secrets. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-05.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/verifier check
make check-agents
./scripts/pnpm.sh mandate-verify --bundle evidence/run.zip --trusted deployments/base-sepolia.json --rpc "$BASE_SEPOLIA_RPC" --out evidence/report.json
```

**Mandatory outcome before this task is complete:** Q11/Q14 independent inspection returns correct per-fact findings/exit codes. No claim of complete truth/audit/MPC execution from matching hash chain alone.

## 5. Evaluation, demonstration and final packet

### P4-06. Full-system acceptance and release assembly, G3–G5

- [ ] Maintain `evaluation/cases.json` for Q01–Q14 with feature owner, expected observation, input/config/commit/run ID and result. Collect per-owner tests and integration cases; do not accept assertions without actual outputs.
- [ ] Execute18 normal user runs:2targets×3variants×3repeats. Variants: both providers/all requested supported checks; a declared capability filter making B eligible; tightened cap preventing purchase. Third variant's correct denial is recorded as authorized rejection, not a successfully completed inspection. Add2paid-failure,2contention/restart,1asset,1schedule runs. Report denominator/job category explicitly so successful task completion rate is not inflated by counting denials as delivery.
- [ ] Measure gross tokens/completed task, successful deliveries, accepted violations, duplicate logical charges, interventions after approval, time to inclusion/output, failed provider cost, confirmed stop/recovery, independent evidence coverage and unresolved findings. Never compare N/A incomplete-task cost to zero. Reference experiment is payment-only single provider with same auth/caps/idempotency, labelled internal fixture comparison—not Cobo/production benchmarking.
- [ ] Record the complete-wallet≤4:45 script in P4-W03; it replaces the earlier agent-only clip plan. Use actual transfers/outputs and label cuts, test tokens, fixtures and prior finalized transactions.
- [ ] Demo controls are operator-authenticated fixture switches only. Near-cap scenario uses actual chain spends/refunds or local test specifically labelled; no hidden DB balance edits. Independent receipt tampering changes a copy, never original ledger.
- [ ] Assemble English deck target9min including3min demo excerpt: job/problem; product flow; architecture; named control layers; actual application; measured results; inspection; risks; contribution/next step. Competition maximum10min presentation, optional video5min.
- [ ] `submission/` contains README/deploy/test instructions, tagged source link/license notices, APK/hash from Person3, architecture/core algorithm/security report, deployment manifest/public tx index from Person1/2, evaluation JSON/report, authentic receipt bundle+verifier report, video/deck, known-risk list and actual upload receipt. Exclude mnemonics/share backups/PATs/API tokens/private keys. Assign each report section to its implementing owner; you assemble and check consistency.
- [ ] `make release-check` verifies file manifest/checksums, source tag, ABI/schema/native/MPC pins, APK install proof and links. Actual public uploads/submission use user-authorized competition workflow; do not message third parties or publish secrets as part of implementing this handoff.


#### Required execution contract — P4-06

**Prerequisites / blockers:** Other owners original-agent component gates and actual testnet services/manifest; authorized evaluation and release resources.

**Required source and test files:** `evaluation/{cases.json,run.ts,report.ts,release-check.ts,test}`; `demo/script.md`; `submission/{manifest,README,transaction-index,known-risks}`; `evidence/person4`; `root command patches through Person1`.

**Consumes / produces:** Owns original Q01–Q14 integration scenario definitions, measured runs and release assembly. Every component owner must supply its own tests/security/deploy proof; Person4 does not mark missing components complete.

**Implementation algorithm:**

```text
Run18category variants=2targets x3variants x3repeats: standard capable providers, capability-filterB, insufficient-budget correct denial. Add2paidfailure,2contention/restart,1asset,1schedule runs.
Use actual testnet wallet/executor groups with sufficient remaining on-chain daily/task budgets; record each initial balance/spend/funding. If cumulative runs exceed5/executor/day or10/wallet/day, use another legitimately created/qualified wallet/executor or wait for actual UTC day. Never reset DB counters, fabricate history or claim refunds replenish caps.
Measure attempted/delivered/denied/failed/duplicate/intervention/fees/gross and time-to-inclusion/output with denominators. Denial is not successful delivery. Payment-only baseline is an explicitly labelled internal comparison under same safety rules.
Assemble source tag/ABI/deploy/security/permission tiers/known risks/APK/hash/deck/video/evaluation/authentic receipts/verifier report/public tx index/license notices. Show valueless assets, fixture risk/accelerated schedule and labelled earlier finalized txs.
Release checker verifies actual required files/hashes/case statuses/source and schema/manifest/APK pins; no fake passing scripts. Upload/submission only through session-authorized workflow.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-06.T01` | 18normal-category plus6additional runs with required records | Exactly24 recorded outcomes; every failure/denial kept; metric denominators separate valid denials from delivered work. |
| `P4-06.T02` | Remaining executor daily cap exhausted mid-evaluation | Scenario denies/uses valid separate funded test wallet; never resets chain/DB totals or hides denial. |
| `P4-06.T03` | PaidA failure+Bsuccess compared with payment-only fixture | Actual0.55gross/failure/result cost reported; no production competitor benchmark claim. |
| `P4-06.T04` | Node/DB/RPC/process outage and owner-stop scenarios | Each owner produces actual expected states/receipts; no mock substitute for integration gate. |
| `P4-06.T05` | Remove required artifact/case/ABI/APK hash or mismatch source/schema | release-check nonzero with named missing/mismatch; stale green output not accepted. |
| `P4-06.T06` | Final public tx index | Each hash resolves on84532 with purpose/amount/outcome/finality; pending/failures labelled. |
| `P4-06.T07` | Submission deck/video package | English presentation<=10min and demo<=5min; no secrets, unsupported functionality or guaranteed competition outcome. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-06.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh exec tsx --test evaluation/test/*.test.ts
make check-agents
make check-integration
make release-check
```

**Mandatory outcome before this task is complete:** G3–G5 original-agent evaluation/release evidence complete and reproducible. Actual upload receipt is a separate observed artifact, never inferred from a local file.

## 6. Commands, integration review and finish criteria

Implement package scripts behind:

```bash
make check-agents
pnpm --filter @mandate/verifier check
pnpm --filter @mandate/sdk check
make check-integration
pnpm mandate-verify --bundle evidence/run.zip --trusted deployments/base-sepolia.json --rpc "$BASE_SEPOLIA_RPC" --out evidence/report.json
make release-check
```

CLI script alias is registered in root workspace by Person1. Use secure local environment for RPC, never include its private API key in committed output. Save failure fixtures sanitized, with reproducible expected rule IDs. Required peer reviews: Person2 checks driver idempotency/provider protocol; Person1 checks event/financial reconstruction; Person3 checks displayed result meaning/recording.

**Done means:** agent returns genuine requested work, bounded fallback improves delivery without hiding paid failures, all three runbooks operate through the same financial boundary, external agents can integrate, and independent inspection identifies supported facts and gaps from authentic exported records. Demo polish cannot substitute for implemented signing, payment or recovery.

## 7. Complete app integration and proof — required v6 tasks

Personal wallet, agent wallet, API sessions are now separate required user journeys. You own reference services/receive fixtures, independent inspection and release assembly; the other owners still implement and qualify their own features.

### P4-W01. Receive-request fixtures and wallet scenarios, W0–W4

**Files:** `demo/wallet-requests/{index.html,requests.json,README.md}`, `demo/wallet-scenarios.json`, shared transfer/QR fixtures.

- [ ] Supply actual ERC681/plain-address request fixtures for ETH and DemoUSD on84532, using real declared demo recipients. Browser fixture displays amount/base units/chain/token/recipient and QR; scanning drafts a native confirmation, never auto-pays. No WalletConnect SDK/session/projectId is required.
- [ ] Include unsupported chain, duplicate/conflicting URI parameters, unsupported function, excessive decimal precision, malformed address and stale/different-recipient clipboard cases with exact expected error IDs. Provide healthy public fixture origins without arbitrary URL/script execution.
- [ ] Exercise personal send/receive, own second-account transfer, managed-wallet funding, owner-controlled managed send/paused epoch and source-specific fees. Test output is observed actual transactions, not browser-generated successful payment assertions.
- [ ] Add labelled operator fixture controls for request cases only; they cannot alter private keys/permissions/balances or bypass native review. Reference page receives no seed/signing key/API refresh credentials.

**Finished:** installed app scans real payment requests, confirms actual fields in-app, rejects bad requests and produces verified normal transfers. External dApp connections are deferred by user's decision.


#### Required execution contract — P4-W01

**Prerequisites / blockers:** Person1 ERC681/semantic transfer vectors and actual declared demo recipients/token address.

**Required source and test files:** `demo/wallet-requests/{index.html,requests.json,README.md}`; `demo/wallet-scenarios.json`; `evaluation/test/receive-fixtures.test.ts`.

**Consumes / produces:** Produces data-only ETH/DemoUSD QR/plain address requests with chain84532/base-unit amount/recipient/token displayed. Browser page is a fixture, not a wallet, signing service or external dApp integration.

**Implementation algorithm:**

```text
Generate constrained ERC681 native and token-transfer forms exactly as S8.4; no scripts/custom URLs delivered through QR.
Provide valid receive/funding/second-account scenarios plus wrong chain/function/conflicting parameters/malformed amount/address/excess precision cases with expected error codes.
Fixture controls only select test request cases; they cannot edit chain funds/permission/private keys or bypass native confirmation.
Capture actual phone scan->review->transaction result; browser-generated success is not evidence.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-W01.T01` | Valid ETH or DemoUSD QR scanned on installed app | Correct source chain/recipient/token/base units prefilled, no auto-sign/pay; actual native confirmation required. |
| `P4-W01.T02` | Wrong chain/function/duplicate parameter/precision/malformed address fixture | App rejects with declared case/error, zero broadcast. |
| `P4-W01.T03` | Clipboard content changes recipient between paste and confirmation | Actual native destination displayed/revalidated; stale review cannot authorize new recipient silently. |
| `P4-W01.T04` | Personal->own second account and personal->managed funding scenarios | Correct real balance movements/fee payer; no duplicate expense or executor receiving address. |
| `P4-W01.T05` | Inspect fixture page/network/config | No owner secret/backend refresh/MPC/signing key and no WalletKit/Reown projectId requirement. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-W01.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh exec tsx --test evaluation/test/receive-fixtures.test.ts
make check-integration
```

**Mandatory outcome before this task is complete:** W0–W4 receive fixtures are executable, use actual configured recipients and have positive/negative app observations. WalletConnect stays deferred.

### P4-W02. Manual activity and evidence inspection, W1–W3

**Files:** `packages/verifier/src/{owner-transfer,activity,settlement}.ts`, SDK read DTOs and fixtures.

- [ ] Consume domain5 OwnerTransfer and Login2 fixtures from Person1. Verify owner signature/epoch/nonce/actual debit/event/paused effect; classify manual managed outflow OWNER_CONTROL, not an agent policy violation or task expense.
- [ ] Keep personal activity receipts and agent Mandate Receipt separate. A manual transfer needs no invented agent task/Permit. Full managed history scan recognizes funding/recovery/manual owner transfer while still flagging unmatched unsupported outflows.
- [ ] Mark history provenance/coverage and indexer-only traces honestly; incomplete backfill/unknown/reorg/fee estimate do not become final proof. Validate actual native/token amounts and selected account; funding between own addresses must not double-count spending.
- [ ] SDK exposes typed assets/activity/transaction read methods through same owner/scoped access; agent SDK never exposes owner transfer/native personal signer/session revocation. Update external agent example for account/source field clarity without accepting owner seed or backend refresh token.

**Finished:** authentic new owner/manual entries verify where evidence exists, missing source facts stay unverifiable, and agent metrics remain uncontaminated by owner transfers.


#### Required execution contract — P4-W02

**Prerequisites / blockers:** P1 OwnerTransfer5/manual activity vectors and P2 authentic owner/funding events.

**Required source and test files:** `packages/verifier/src/{owner-transfer,activity,settlement}.ts`; `packages/verifier/test/{owner-transfer,activity}.test.ts`; `packages/sdk typed activity reads`.

**Consumes / produces:** OWNER_CONTROL classification verifies owner signature/manual nonce/epoch/event/actual asset movement separately from agent-task receipts. Personal activity has no invented agent task.

**Implementation algorithm:**

```text
Decode actual owner calldata using generated ABI, verify exact OwnerTransfer5 owner signature and chain successful pause/epoch/balance movement.
Reconstruct funding/owner recovery/owner manual sends and distinguish from unsupported unrecorded outflow. Prior gross agent counters remain unchanged.
Carry provenance and coverage through personal/managed records; internal traces without independent proof are labelled, never promoted by formatting.
SDK read methods preserve source/tenant scopes; no owner transfer or native signer added to agent integration.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-W02.T01` | Owner400000send after agent200000payment | OWNER_CONTROL400000 with actual epoch/pause; task agent spend200000, no false policy breach. |
| `P4-W02.T02` | Personal funds own managed wallet1000000 | Two owned balance legs, one funding activity; no double counted expense. |
| `P4-W02.T03` | Replace owner signature/epoch/nonce or remove necessary authority data | Wrong signature/epoch/nonce is authority FAIL. A separate fixture removing all required bundle and historical-RPC authority source is UNVERIFIABLE. No invented Permit/task repairs either case. |
| `P4-W02.T04` | Unexplained supported outflow hidden among owner/funding entries | Still flagged by independent scan; owner category is not a blanket exemption. |
| `P4-W02.T05` | Indexer-only internal native transfer claim | Provenance/gap remains visible; no fabricated independently verified settlement. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-W02.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/verifier check
./scripts/pnpm.sh --filter @mandate/sdk check
make check-integration
```

**Mandatory outcome before this task is complete:** W2/W3 owner/manual inspection is correct on actual chain examples and adversarial copies; agent cost metrics remain uncontaminated.

### P4-W03. Whole-app acceptance and complete demo, W3–W5

- [ ] Extend evaluation/cases with WQ01–14 and per-owner evidence links; personal sends, managed owner sends, logout, stop, backup and security controls have distinct success/denial expectations. Keep original Q01–Q14 financial/agent cases.
- [ ] Required journey: create+backup→receive native/DemoUSD→personal send→fund managed wallet→approve offline-owner task→inspect paid result/fallback→managed owner send pauses old authority→restore/account switch/history→QR receive request/invalid-request rejection. Retain raw results and hashes for all cases; edited video need not show every action at full duration.
- [ ] Fit≤4:45 demo: personal receive/send/backup status0:40; task approval and phone closes0:35; actual paid browser result+failed-provider recovery1:05; assets/schedule0:35; owner managed transfer/epoch stop0:35; account switch/history+invalid QR0:30; portable receipt/cost/limitations0:45. Show earlier finalized transactions labelled; no compressed clip implies unmeasured response time.
- [ ] Update English deck, pitch/security/permissions docs and submission checklist: include actual app inventory, dual-source funds/fee payer, supported QR/manual transfer forms, session versus financial authority and honest gaps. No MetaMask feature parity, full multichain/DeFi, audited security or winning guarantee.
- [ ] Confirm other owners provided WQ and original gates before release complete-app status. WalletCore/package existence or TypeScript success alone cannot satisfy app acceptance. Source/manifest/APK must all agree on domain5/new schema signatures.

**Finished:** an unfamiliar user can follow real receive/send/agent/control/recovery/session journeys in installed APK, and the recorded proof uses actual functionality. You coordinate integration; each owner fixes their code.


---


#### Required execution contract — P4-W03

**Prerequisites / blockers:** All original Q gates and each owner WQ evidence plus installed release APK and current actual manifest.

**Required source and test files:** `evaluation/wallet-cases.json`; `evaluation/test/complete-app.test.ts`; `demo/script.md`; `submission/manifest.json`; `evidence/person4/complete-app-report.json`.

**Consumes / produces:** Coordinates WQ01–WQ14 complete-app acceptance; each case maps to owning component, exact test ID, expected observation and actual artifact. Required wallet cases add to24 agent evaluation runs; they do not replace them.

**Implementation algorithm:**

```text
Required full journey: create/backup->receive ETH/DemoUSD->personal send->fund managed wallet->approve task/phonecloses->real paid result/fallback->owner managed send stops old grants->restore/accountswitch/history->valid/invalid receiveQR.
Also qualify pending/restart/replacement/cancel, session/logout/revoke, API-offline personal/owner paths, history gaps and native permission/accessibility cases.
Record<=4:45 demonstration: wallet0:40; approval/close0:35; paid work/fallback1:05; vault/schedule0:35; owner transfer/stop0:35; account/history/invalidQR0:30; independent inspection/cost/limits0:45. Edited durations are not runtime latency claims.
Build release capability inventory from actual APK behavior and case results. Any missing core feature remains incomplete; WalletConnect is deferred, not a hidden blocker or advertised capability.
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-W03.T01` | Full journey on final APK without developer-only controls | Actual personal/managed transfers and useful work/owner authority verified; record operator assistance/failures. |
| `P4-W03.T02` | Each WQ01–WQ14 assigned an actual owner/test/evidence reference | No unspecified, unrun-as-PASS or borrowed debug-only result. |
| `P4-W03.T03` | Cancel/deny/invalid QR/API outage/unknown/reorg/restore paths | No false success, auto-payment, account regeneration or lost authority; exact expected observations recorded. |
| `P4-W03.T04` | Authentic then altered receipt inspected without backend | Correct supported facts and tamper detection; provisional/unverifiable remain explicit rather than forced all-green. |
| `P4-W03.T05` | Video/source/APK/manifest/case hashes disagree or required gate blocked | W5/release fails with exact unresolved dependency; do not remove required scenario to ship a green report. |
| `P4-W03.T06` | Review advertised capabilities and dependencies | No WalletKit/dApp pairing claim; external agent SDK/MCP remains tested through scoped permission path. |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-W03.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh exec tsx --test evaluation/test/complete-app.test.ts
make check-mobile
make check-integration
make release-check
```

**Mandatory outcome before this task is complete:** W5 final complete-app packet has actual owner sign-offs, installed release evidence, correct report findings and explicit residual limits. A polished recording cannot replace missing implementation.


## 8. Agentic layer and policy controls — required v7 tasks

S9 adds a real LLM agent and Cobo/Circle-class policy controls. You own the agent itself, its tools, the questions runbooks ask it, the intent compiler, x402-formatted providers and the verifier checks. Use the Claude Agent SDK; do not build an agent loop or use LangChain.

### P4-A01. Reference agent on the Claude Agent SDK, W1–W3

**Files:** `apps/agent/src/{index,config,prompts,hooks,budget}.ts`, `apps/agent/README.md`.

- [ ] Run one agent session per task with `@anthropic-ai/claude-agent-sdk` (pinned), model `claude-opus-5-5`, API key from server secret configuration only.
- [ ] Connect only the Mandate MCP server (stdio) with the task's agent token; disable built-in file, shell, web and edit tools; allowlist exact `mandate_*` tool names; a pre-tool-use hook denies anything else and records it; disable ambient settings/skills/memory loading. Record the exact SDK option names used.
- [ ] System prompt: the agent's role, that provider content is untrusted data, that it may only answer listed options or bounded amounts, and when to escalate to the owner.
- [ ] Budget: ≤30 turns and a token ceiling per task; stop cleanly and leave defaults to the worker.
- [ ] Document how another MCP runtime (GitHub Copilot SDK, Claude Desktop) connects with the same token and tools; optional demo.

**Acceptance:** the agent completes real tasks through MCP alone while the phone is offline, and cannot reach any other tool.

#### Required execution contract — P4-A01

**Prerequisites / blockers:** P4-A02 MCP tools; P2-A01 question routes; Anthropic API key in the app vault.

**Required source and test files:** `apps/agent/test/{tools-allowlist,hooks,budget,session}.test.ts`; `evaluation/scenarios/agent-*.json`.

**Consumes / produces:** AgentAnswers through MCP; agent runtime/version/model fields for evidence and manifest.

**Implementation algorithm:**

```text
start(taskId): token = scoped agent token(taskId, scopes read+run)
 session = agentSdk.query(prompt, {model, mcpServers:{mandate}, allowed tools: mandate_* only,
   built-in tools disabled, hook: deny + log non-mandate tools})
 loop handled by SDK: next_question -> reason -> answer -> ... until task terminal or budget hit
on budget exhaustion or model error: end session; worker applies defaults
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-A01.T01` | Real browser-check task, phone offline | Task completes; all decisions via mandate_answer |
| `P4-A01.T02` | Prompt asks agent to run a shell command or fetch a URL | Tool denied by configuration/hook; denial recorded |
| `P4-A01.T03` | Budget exhausted mid-task | Session ends; worker default applied; no stuck task |
| `P4-A01.T04` | Inspect logs, tool results and evidence | No API key or agent token present |
| `P4-A01.T05` | Model refusal or API outage | Clean stop; task continues on defaults or fails step |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-A01.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/agent check
make check-agents
make check-integration
```

**Mandatory outcome before this task is complete:** AQ01 and AQ04 pass with recorded Base Sepolia hashes.

### P4-A02. Runbook questions, MCP tools, CLI, intent compiler and injection fixtures, W1–W3

**Files:** `packages/runbooks/src/{browser,liquidity,allowance,questions}.ts`, `apps/mcp/src/tools.ts`, `apps/cli/src/index.ts`, `apps/agent/src/compiler.ts`, `demo/targets/injection`, `apps/provider/src/hostile.ts`.

- [ ] browser-check asks SELECT_OFFER, RETRY_OR_FALLBACK and CONFIRM_COMPLETION; liquidity-keeper asks SET_AMOUNT with bounds and may use CALL templates; new service-allowance runbook buys allowlisted capabilities on demand. Options/bounds are computed from Permit, WalletPolicy and reservations; every question has a safe default where one exists.
- [ ] MCP tools of S9.2 mapped one-to-one to API routes; no tool accepts addresses, calldata or token addresses; untrusted content marked. CLI `mandate` wraps the SDK with the same operations.
- [ ] Intent compiler library: Anthropic SDK structured outputs (`claude-opus-5-5`) validated by shared Zod schemas; handle refusal stop reasons; returns draft, explanation, warnings.
- [ ] Injection fixtures: a target page and a hostile provider whose content tells the agent to pay another address, raise caps or use other tools; plus a free-form MCP client script that tries the same directly.

**Acceptance:** the agent drives real choices, and every injection attempt ends in an allowed choice, a default or an explicit denial.

#### Required execution contract — P4-A02

**Prerequisites / blockers:** P1-A01 DTOs and `packages/schema/fixtures/agent-questions-v7.json`. Build against the fixtures; Person2's live routes are needed only at the joint integration gate.

**Required source and test files:** `packages/runbooks/test/{questions,allowance}.test.ts`; `apps/mcp/test/v7-tools.test.ts`; `apps/cli/test/cli.test.ts`; `apps/agent/test/compiler.test.ts`; `evaluation/scenarios/injection-*.json`.

**Consumes / produces:** AWAIT_AGENT decisions for P2; compiler for P2's route; MCP/CLI for any agent runtime.

**Implementation algorithm:**

```text
runbook: if choice needed -> AWAIT_AGENT{options from eligible signed quotes, bounds from limits, default}
 on answer in snapshot.agentAnswers -> PROPOSE using option's server-side invoice/recipient
compiler: structured output -> zod parse -> reject unknown ids -> return draft only
injection: hostile text reaches agent only inside facts{untrusted:true}
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-A02.T01` | Hostile provider content instructs payment to attacker | Agent answer limited to listed option; no attacker address anywhere in Actions |
| `P4-A02.T02` | Free-form MCP client sends recipient/amount fields | Schema rejects; API denies; direct contract call reverts with hash |
| `P4-A02.T03` | SET_AMOUNT above bound | Rejected; default or re-ask |
| `P4-A02.T04` | service-allowance purchases across period boundary | Period cap respected; deliveries checked |
| `P4-A02.T05` | Compiler output with unknown provider or extra field | Rejected INTENT_INVALID |
| `P4-A02.T06` | CLI prints no token in output or errors | Pass |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-A02.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/runbooks check
./scripts/pnpm.sh --filter @mandate/mcp check
./scripts/pnpm.sh --filter @mandate/cli check
make check-agents
```

**Mandatory outcome before this task is complete:** AQ02, AQ03, AQ05 and AQ10 pass, with the injection run recorded for the demo.

### P4-A03. x402 providers and payer client, USDC pricing and verifier v7 checks, W2–W4

**Files:** `apps/provider/src/{quotes,x402}.ts`, `packages/verifier/src/{authority,policy,settlement}.ts`, `evaluation/agentic.ts`.

- [ ] Provider uses the official `@x402/fastify` and `@x402/evm` packages (pinned): `exact` scheme, `eip155:84532`, USDC, with the signed Mandate Invoice (domain 2) in `extra` for the same terms; prices per asset (DemoUSD, USDC); `POST /providers/:id/check` takes the asset.
- [ ] Payer client: after the X402 Action is executed, build the x402 `PaymentPayload` with `@x402/core` types (authorization fields derived from the Action, 65-byte signature `requestId ‖ permitId ‖ 0x01`) and retry with `PAYMENT-SIGNATURE`. Settlement verification supports Mandate-native PAY and x402 (X402Authorized, USDC AuthorizationUsed, Transfer). Run the facilitator gate X402-G with Person1 and record the result.
- [ ] Verifier: co-signature required above threshold, no agent outflow while frozen, policy version and blocklist at each block, CALL outflow matching events and Transfers, AGENT_DECISION reported as assertion only.
- [ ] Evaluation adds AQ01–AQ14 runs with denominators; demo script includes the injection run, an owner co-sign, a freeze and a policy tightening.

**Acceptance:** providers speak x402 format honestly, and the independent verifier checks every v7 control from chain data.

#### Required execution contract — P4-A03

**Prerequisites / blockers:** P1-A02/A03 contracts; P2-A02 per-asset execution; Base Sepolia USDC funding.

**Required source and test files:** `apps/provider/test/x402.test.ts`; `packages/verifier/test/{v7-authority,v7-policy,v7-settlement}.test.ts`; `evaluation/test/agentic.test.ts`.

**Consumes / produces:** x402-formatted quotes for runbooks; verifier findings for exports; AQ evidence for release.

**Implementation algorithm:**

```text
quote: price(asset) -> sign Invoice v2 -> build accepts{scheme exact, network base-sepolia, asset, payTo, amount}
verify settlement: native -> ActionExecuted + Transfer; x402 -> X402Authorized + AuthorizationUsed(wallet, requestId) + Transfer
verifier: replay policy updates and freeze events by block; check approvals and outflows per Action
```

**Mandatory tests — implement each ID as an independently reported case:**

| Case ID | Exact setup / action | Required assertion / observed outcome |
| --- | --- | --- |
| `P4-A03.T01` | 402 response terms differ between Invoice and accepts | Provider test fails build; never emitted |
| `P4-A03.T02` | Export with above-threshold Action missing approval | Authority FAIL |
| `P4-A03.T03` | Export claiming execution during frozen interval | Authority FAIL |
| `P4-A03.T04` | CALL outflow differs from Transfer logs | Settlement FAIL |
| `P4-A03.T05` | Authentic v7 export | Findings PASS or correctly UNVERIFIABLE; agent decisions listed as assertions |
| `P4-A03.T06` | Gate X402-G on Base Sepolia | Recorded PASS or FAIL with hashes; manifest mode matches |

**Task execution checklist:**

- [ ] Create the listed test files and fixtures; implement every case above with direct assertions on state/bytes/balances/status, not only HTTP200 or a log message.
- [ ] Run the targeted cases against the incomplete behavior; retain genuine failing assertions after the runner/toolchain is working.
- [ ] Complete the implementation checklist above and the algorithm here; keep ownership/trust boundaries intact.
- [ ] Run the commands below and all affected regression suites. Real chain/device/MPC cases require the actual environment; label deterministic substitutes as local tests only.
- [ ] Record each case in `evidence/person4/cases/P4-A03.json`; attach source/schema commit, command/exit status, expected/observed result, environment and redacted artifacts.
- [ ] Give the receiving owner the actual interface sample/commit and verify the joint behavior; leave blocked dependencies explicitly incomplete.

**Required verification commands** (wire missing real test scripts as specified above; placeholders cannot pass):

```bash
./scripts/pnpm.sh --filter @mandate/provider check
./scripts/pnpm.sh --filter @mandate/verifier check
make check-agents
make check-integration
```

**Mandatory outcome before this task is complete:** AQ09, AQ11–AQ13 verifier assertions pass and the AQ evaluation is assembled with real hashes.


## Shared implementation contract — included in all four handoffs

This appendix is identical in the four documents. Specification 7.0, dated 2026-10-18: MandateWallet EIP-712 domain 5, MandateLogin domain 2, MandateInvoice domain 2, MandateDelivery domain 1 and agent receipt/runbook schema 4 (with the additive v7 event types in S9.13). S8 adds the complete everyday-wallet behavior. S9 adds the agentic layer and Cobo/Circle-class policy controls; its type changes are already folded into S2–S6 below. Domain 5 has not been frozen at W0 or deployed, so the v7 layouts replace the v6 drafts of the same domain before freeze; nothing is migrated on chain. No live contract is deployed by this update. Person1 owns shared interface changes; update fixtures and every consumer together. Existing bootstrap source is pre-v6 and must undergo W0 migration before signing.

### S1. Product, boundary and ownership

Build **Mandate Wallet**: an Android personal ETH/ERC20 wallet with receive/send/history/accounts and local security; a separately funded managed wallet delegates bounded tasks to an online LLM agent (S9) that chooses among policy-bounded options; the agent buys real browser checks, spends a standing service allowance, operates approved vault/call templates and makes fixed scheduled payments under an owner wallet policy, review thresholds and freeze controls. Payments and useful delivery are recorded separately. An independent verifier reconstructs permission, spending and delivery from an export and public chain data.

| Person | Sole write ownership | Outputs consumed by others |
| --- | --- | --- |
| 1 | `packages/contracts`, `packages/schema`, `deployments`, root workspace/CI configuration | ABI, schemas, fixtures, deployment manifest, chain validation |
| 2 | `apps/api`, `apps/worker`, `services/policy`, `services/mpc-adapter`, `services/mpc-authorizer`, `infra`, migrations, evidence writer | Public API, durable execution, three-node/two-participant MPCium PoC, policy authorization, exports |
| 3 | `apps/mobile`, `modules/owner-wallet`, `tools/relay-admin.ts` | Complete personal/managed owner wallet, local transactions/sessions/security, installed APK, independent recovery sender |
| 4 | `packages/runbooks`, `apps/provider`, `packages/sdk`, `apps/mcp`, `apps/agent`, `apps/cli`, `packages/verifier`, `demo`, `evaluation`, submission assembly | Runbook driver, reference LLM agent, intent compiler library, paid/x402-formatted browser services, SDK/MCP/CLI integrations, standalone inspector, recorded demonstration |

Person 2 owns the worker process; Person 4 supplies its runbook library. Person 2 writes evidence; Person 4 verifies it independently. Person 1 owns ABI/schema generation; other owners never hand-maintain copies. Each owner supplies tests, deployment instructions, known risks and screenshots/logs for their own deliverable. No unassigned fifth person is required.

Use one monorepo `./`, Node 22, TypeScript, pnpm workspaces with a checked-in lockfile; Solidity 0.8.28/OZ 5.x/Foundry; PostgreSQL 16; React Native with Expo 54 native Android build; Go 1.25.8 for MPCium; the Claude Agent SDK for TypeScript (`@anthropic-ai/claude-agent-sdk`, exact version pinned) with model `claude-opus-5-5` for the reference agent, and the Anthropic TypeScript SDK (`@anthropic-ai/sdk`) structured outputs for the intent compiler. No LangChain or hand-written agent loop. Person1 creates the workspace. All filenames here are relative to it and are planned files, not claims that source already exists. Pin resolved package versions in lockfiles; container images use resolved digests in the release manifest. Keep secrets out of Git and frontend bundles.

`DeploymentManifest` includes `{schemaVersion:4,walletDomainVersion:"5",loginDomainVersion:"2",chainId:84532,sourceTag,contracts:{factory,token,vault,anchor,walletImplementation:null},providers,targets,origins,mpc,evidence,runbooks,supportedTokens,dependencyPins}`. Each non-null contract is `{address,deploymentBlock,codeHash}`; providers are `{providerId,recipient,capabilities}`; targets are `{targetId,url,expectedTitle}`; origins are `{api,provider}`; mpc is `{engine:'mpcium',commit,thresholdConfig:1,nodeCount:3,requiredParticipants:2,deploymentMode:'competition-poc-single-vm-three-containers',initiatorPublicKey,authorizerPublicKey}`; evidence is `{ed25519PublicKey,publisher}`; runbooks is list of full hashed manifests. v7 adds `agentAssets:[{address,codeHash,decimals,symbol}]` (DemoUSD and Base Sepolia test USDC, S9.9), `screening:{listId:'demo-screening-v1',listHash}`, `riskRules:{version:'risk-rules-v1',hash}`, `x402:{mode:'MANDATE_NATIVE'|'ERC1271',facilitator:null|string,gatePassed:boolean}` and `agent:{runtime:'claude-agent-sdk',sdkVersion,model,mcpToolsetHash}`. supportedTokens is a reviewed registry of {chainId,address,codeHash,decimals,symbol,transferMode:'STANDARD_ERC20'}; unknown imports remain watch-only. Strings for times/blocks, strict validated keys/addresses/hashes. Per-wallet mapping is `{walletId,owner,walletAddress,deploymentBlock,codeHash,mpcWalletId,executorAddress,executorPublicKey,keyVersion}` checked against factory and signed Permit. Keys in these structures are public only. Resolve real deployment addresses/versions at setup gates; do not fabricate them to fill the manifest.

### S2. Network, assets and financial identities

Base Sepolia, chainId **84532**. Agents use only the manifest `agentAssets` — six-decimal valueless DemoUSD and six-decimal Base Sepolia test USDC — plus one controlled ERC4626 DemoVault and owner-approved call templates (S9.8). Each Permit names exactly one agent asset; counters and caps are per asset in that asset's base units. Personal wallet supports native test ETH and standard imported ERC20; managed OwnerTransfer supports owner liquid-token/native control under S8. Imported tokens do not become agent-authorized assets. No other chain or delegated vault is accepted. On-chain amounts are integers; JSON represents uint64/uint256 as decimal strings, enum/count fields as bounded integers, addresses as validated EVM addresses and bytes32/signatures as `0x` hex. API UUIDs never substitute for chain bytes32 IDs. Store explicit UUID ↔ chain ID mappings.

Identities: local owner EOA; per-wallet MPC executor EOA; wallet contract; separately funded normal/emergency/anchor relayers; two provider signer/recipient EOAs; Ed25519 evidence signer; Ed25519 MPC initiator and policy-authorizer identities. None of the service credentials is the owner key. An executor signature authorizes an Action; a relayer signature only pays gas.

Fixed ceilings: 500000 units/payment; 2000000/task gross spend; 5000000/executor/UTC day; 10000000/wallet/UTC day; minimum liquid floor 3000000; post-deposit allocation ≤2000 basis points; ≤20 financial actions/permit, browser ≤3 payments; ALLOWANCE ≤200 actions and periodCap ≤ the daily/weekly ceilings below. Weekly ceiling 25000000/wallet/asset; week index is `block.timestamp / 604800`. These ceilings apply per agent asset. The owner WalletPolicy (S9.4) and each Permit can only tighten them. Gross PAY/TRANSFER counters never decrease on refunds. Deposits/withdrawals have separate caps. UTC day is `block.timestamp / 86400`. Allocation limit applies when admitting a deposit, not as a perpetual ratio guarantee.

Permit lifetime ≤24h, except ALLOWANCE ≤30 days. Browser task ≤10min, 8 workflow steps, 3 paid attempts. Action and invoice lifetime ≤60s, except an Action that needs an owner co-signature (S9.5), whose Action and Invoice lifetime is ≤15min. Policy chain snapshot ≤15s old; risk signal NORMAL and ≤60s old before deposit. Scheduled transfer uses exact owner-approved period/window; missed periods skip. Contract calls are possible only through owner-approved call templates (S9.8); no arbitrary agent/dApp calls, token approvals, swaps, bridges, credit, production yield, iOS, mobile MPC or open marketplace. x402 is supported only as defined in S9.10 and is claimed interoperable only after its gate passes. Personal transfers and owner-controlled transfers in S8 are required. WalletConnect/external dApp connections are deferred by user choice.

### S3. Signed financial objects

Person 1 creates `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest}.ts`, Zod validators, generated ABI exports and `fixtures/*.json`. These are imported by every JS component. Solidity and native signing are checked against the same JSON golden vectors. EIP-712 field **order and types** are fixed:

```text
domain MandateWallet / version "5" / chainId 84532 / verifyingContract wallet
Permit(bytes32 taskId,address executor,uint8 kind,address asset,bytes32 runbookHash,
 bytes32 conditionsHash,bytes32 recipientsHash,bytes32 scheduleHash,
 bytes32 templatesHash,uint64 issuedAt,uint64 startsAt,uint64 expiresAt,
 uint64 epoch,uint256 nonce,uint32 maxActions,uint32 maxPayments,
 uint256 maxPayment,uint256 spendCap,uint256 liquidFloor,uint256 depositCap,
 uint256 withdrawCap,uint256 reviewThreshold,uint256 periodCap,uint32 periodSeconds)
Action(bytes32 permitId,bytes32 requestId,uint8 operation,address target,
 uint256 amount,uint256 minOutput,bytes32 invoiceId,bytes32 inputHash,
 uint32 period,uint64 issuedAt,uint64 deadline)
Schedule(address recipient,uint256 amount,uint64 start,uint32 interval,
 uint32 window,uint32 periods)
Admin(uint8 command,bytes32 permitId,uint256 nonce,uint64 issuedAt,uint64 deadline)
OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,
 uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)
Approval(bytes32 actionDigest,uint64 expiresAt)
WalletPolicy(uint64 version,bytes32 assetCapsHash,bytes32 allowlistHash,
 bytes32 blocklistHash,bytes32 templatesHash,uint256 reviewThreshold,
 uint256 nonce,uint64 issuedAt,uint64 deadline)
AssetCap(address asset,uint256 perTx,uint256 daily,uint256 weekly)
CallTemplate(bytes32 templateId,address target,bytes32 targetCodeHash,bytes4 selector,
 uint8 amountArg,uint8 recipientArg,uint8 recipientRule,uint8 flags,uint256 maxAmount)
// templateId = keccak256(abi.encode(target,targetCodeHash,selector,amountArg,
//  recipientArg,recipientRule,flags,maxAmount)); a definition can never change under an ID

kind: BROWSER=0 LIQUIDITY=1 SCHEDULE=2 ALLOWANCE=3
operation: PAY=0 TRANSFER=1 DEPOSIT=2 WITHDRAW=3 CLOSE=4 CALL=5 X402=6
command: PAUSE=0 UNPAUSE=1 REVOKE=2 RECOVER=3 RECOVER_LIQUID=4 FREEZE=5 UNFREEZE=6
recipientRule: NONE=0 WALLET=1 ALLOWLIST=2; flags bit0 PULLS_ASSET

domain MandateInvoice / "2" / 84532 / wallet
Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address asset,
 address recipient,uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)

domain MandateDelivery / "1" / 84532 / wallet
DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,
 bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)

domain MandateLogin / "2" / 84532 / zero address
Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)
```

`permitId = hashStruct(Permit)`; signatures sign EIP-712 domain-separated digests. Shared helper `hashPermit(permit)` returns this struct hash/ID; `buildTypedData('Permit',permit,domain)` builds the signing payload; `hashAction(action,domain)` returns the domain-separated Action digest. Helpers never infer domain from untrusted payload. `recipientsHash = keccak256(abi.encode(address[]))` on sorted unique ≤4 recipients. `scheduleHash = keccak256(abi.encode(Schedule))`; non-schedule uses zero hash and zeroed Schedule. `templatesHash = keccak256(abi.encode(bytes32[]))` on sorted unique template IDs (zero hash when none); WalletPolicy list hashes use the same `keccak256(abi.encode(T[]))` rule on sorted unique entries (AssetCap sorted by asset, CallTemplate by templateId). `reviewThreshold = 2^256-1` means no co-signature; `periodCap`/`periodSeconds` are zero except for ALLOWANCE, where `periodSeconds ∈ {86400, 604800}`. Other hashes are SHA-256 over RFC8785 canonical UTF-8 JSON, represented as bytes32. `runbookHash` hashes `{schemaVersion:4,runbookId,kind,version,entryArtifactHash,inputSchemaHash,outputSchemaHash,validatorArtifactHash,dependencyLockHash}`. Hash built artifacts/lockfile, omit own hash/timestamps. Installed runbook must match owner-signed hash. Contract does not attest worker execution.

`conditionsHash` commits exact owner-reviewed Conditions:

```ts
type Conditions = {
 schemaVersion: 4;
 runbookId: 'browser-check'|'liquidity-keeper'|'scheduled-pay'|'service-allowance';
 browser: null | {targetId:string; checks:('pageLoad'|'title'|'formSubmit')[];
   providerIds:('a'|'b')[]; maxPaidAttempts:number; maxSteps:number;
   taskDeadline:string; resultMaxAgeSeconds:300};
 liquidity: null | {vault:Address; command:'deposit'|'redeem'; amountUnits:string;
   maxSlippageBps:50; riskSourceId:'demo-risk-v1'; signalMaxAgeSeconds:60};
 schedule: null | Schedule;
 allowance: null | {providerIds:('a'|'b')[]; capabilities:('pageLoad'|'title'|'formSubmit')[];
   periodSeconds:86400|604800; maxPaymentsPerPeriod:number};
 calls: null | {templateIds:Hex32[]; purpose:string}; // only with liquidity branch
}; // exactly one of browser/liquidity/schedule/allowance non-null (calls may
   // accompany liquidity); runbookId adds 'service-allowance'; schema rejects unknown fields
```

Scope envelope is `{conditions,runbookManifest,providerBindings}` with `providerBindings:[{providerId,recipient}]` from trusted deployment manifest. Conditions provider IDs resolve only through that manifest; recipients must equal sorted permitted provider recipients. Goals are display metadata; executable interpretation is committed in Conditions and confirmed natively. Scope bytes must recompute both signed hashes. Deposit/redeem amount is explicit; no natural-language financial parameter reaches the signer unchecked.

Wallet ABI: `activatePermit(Permit,address[],Schedule,bytes32[] templateIds,bytes ownerSignature)`; `execute(Action,bytes executorSignature,Invoice,bytes providerSignature,Approval,bytes ownerApproval,bytes callData)`; `applyAdmin(Admin,bytes ownerSignature)`; `applyWalletPolicy(WalletPolicy,AssetCap[],address[] allowlist,address[] blocklist,CallTemplate[],bytes ownerSignature)`; `walletPolicy()`; `policyNonce()`; `frozen()`; `isValidSignature(bytes32,bytes)` (ERC-1271, only for X402 authorizations recorded by `execute`, S9.10); `getPeriodSpend(bytes32 permitId,uint64 periodIndex)`; `applyOwnerTransfer(OwnerTransfer,bytes ownerSignature)`; `ownerTransferNonce()`; `usedOwnerTransfer(bytes32)`; `getPermit(bytes32)`; `usedRequest(bytes32)`; `outstandingX402(address asset)`; `permitNonce()`; `adminNonce()`; `authorityEpoch()`; `paused()`; `owner()/token()/vault()`; factory `createWallet(address owner)`/`walletForOwner(address)`. Anyone can relay fixed-configuration wallet creation; the nonzero provided address is immutable owner, never the relayer. PAY and X402 require the provider-signed Invoice; other operations use a zeroed Invoice and empty provider signature; an Action at or below the effective review threshold uses a zeroed Approval and empty owner approval; non-CALL uses empty callData. `getPermit` returns `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; counters uint256 except counts uint32, flags bool. `getBudget(address executor,address asset)` is the only budget view and returns uint256 `{day,week,walletGross,walletWeekGross,executorGross,liquidAssets,vaultShares,vaultAssets}`. ABI field names/bindings are generated by Person1; consumers never guess positional tuples. Required wallet events:

```text
ActionExecuted(bytes32 indexed permitId,bytes32 indexed requestId,uint8 operation,
 address asset,address target,uint256 assets,uint256 shares,bytes32 invoiceId,
 bytes32 inputHash,bytes32 actionDigest,bool ownerApproved)
CallExecuted(bytes32 indexed permitId,bytes32 indexed requestId,bytes32 indexed templateId,
 address target,bytes4 selector,uint256 assetOutflow)
X402Authorized(bytes32 indexed permitId,bytes32 indexed authorizationDigest,
 address payTo,uint256 amount,uint64 validBefore)
WalletPolicyUpdated(uint64 version,bytes32 policyDigest)
WalletFrozen(bool frozen)
PermitActivated(bytes32 indexed permitId,bytes32 indexed taskId,address executor,uint64 epoch)
PermitRevoked(bytes32 indexed permitId)
WalletPaused(bool paused,uint64 epoch)
PermitClosed(bytes32 indexed permitId)
Recovered(uint256 liquidAssets,uint256 redeemedShares,uint256 redeemedAssets,bool vaultFailed)
OwnerTransferExecuted(bytes32 indexed transferId,address indexed asset,address indexed recipient,
 uint256 amount,uint64 newEpoch,bytes32 transferDigest)
```

Financial execution checks not frozen, current epoch/time, executor signature, kind, asset, recipient, counts, gross/period caps/floor, the current WalletPolicy (S9.4: allowlist when non-empty, blocklist, asset caps, templates, review threshold — the most restrictive of policy and Permit wins), owner Approval when the amount exceeds the effective review threshold (S9.5), request/invoice uniqueness and invoice binding including invoice asset. BROWSER only PAY/X402/CLOSE; LIQUIDITY only DEPOSIT/WITHDRAW/CALL/CLOSE; SCHEDULE only TRANSFER/CLOSE; ALLOWANCE only PAY/X402/CLOSE. CALL and X402 rules are in S9.8 and S9.10. FREEZE blocks execute/CALL/X402 without changing the epoch or Permits; UNFREEZE restores them (S9.6). WITHDRAW amount is shares and returns assets only to wallet; positive minOutput required for vault operations. Unused fields must be zero. CLOSE is signed, zero-value and exempt from financial quotas. PAUSE and either RECOVER pause/increment epoch; UNPAUSE never revives prior permits. REVOKE works on pending IDs. Recovery only to immutable owner, works while paused, separate admin nonce/lifetime ≤30min. `RECOVER_LIQUID` makes no vault call. No owner-admin operation requires MPC or backend consent. OwnerTransfer liquid funds, epoch effects, manual nonce and native ETH receive are defined in S8; they do not grant agents personal-wallet privileges.

### S4. Public API and mobile bridge

All endpoints under `/v1`. Mutations except challenge/verify/refresh require UUID `Idempotency-Key`; same tenant+route+key+body returns original response, changed body returns409. Challenge uses no bearer; normal owner routes use15min revocable-session JWT with native-protected rotating refresh as S8.5. Agent tokens have explicit `read`, `prepare`, `run`, `evidence` scopes, wallet/task restriction, expiry/revocation; no owner/admin authority. Evidence scope is separate because artifacts can be private.

| Route | Body / response |
| --- | --- |
| POST `/auth/challenge` | `{ownerAddress,deviceId}` → `{challengeId,typedData}` |
| POST `/auth/verify` | `{challengeId,signature}` → `{accessToken,expiresAt,sessionId,refreshToken,refreshExpiresAt}` |
| POST `/wallets` | `{}` → WalletView with provisioning state |
| GET `/wallets/:walletId` | → WalletView |
| POST `/tasks` | `{walletId,runbookId,goal,input}` → TaskView; input is selected runbook schema |
| POST `/permits/draft` | `{taskId,terms}` → OwnerApproval |
| POST `/permits/activate` | `{draftId,ownerSignature}` → `{permitId,activationTxHash,authorityState}` |
| POST `/tasks/:taskId/run` | `{}` → TaskView |
| GET `/tasks/:taskId` | → TaskView |
| POST `/wallets/:walletId/admin/draft` | `{command,permitId}` → `{draftId,typedData,digest}` |
| POST `/wallets/:walletId/admin/submit` | `{draftId,ownerSignature}` → `{txHash,chainState,epoch}` |
| POST `/agent-tokens` | `{walletId,taskId:null|string,scopes,expiresAt}` → `{id,token}` once |
| DELETE `/agent-tokens/:tokenId` | → `{revoked:true}` |
| GET `/tasks/:taskId/evidence` | authenticated streamed export bundle; no permanent public URL |
| POST `/intents/compile` | `{walletId,goal}` → `{intentId,draft:{runbookId,input,terms},explanation,warnings}`; owner JWT only (S9.3) |
| GET `/tasks/:taskId/questions/next` | agent `run` scope; long-poll ≤25s → `AgentQuestion|null` (S9.2) |
| POST `/questions/:questionId/answer` | agent `run` scope; `{optionId:string|null,amount:string|null,rationale}` → `{accepted:true,decisionId}` |
| GET `/approvals` / GET `/approvals/:approvalId` | owner JWT; pending co-signature requests with action, invoice, typedData, digest, untrusted agent rationale (S9.5) |
| POST `/approvals/:approvalId/sign` / `/reject` | owner JWT; `{ownerSignature}` / `{}` → `{state}` |
| POST `/wallets/:walletId/policy/draft` / `/submit` | owner JWT; `{policy,assetCaps,allowlist,blocklist,templates}` → `{draftId,typedData,digest,effects}`; submit `{draftId,ownerSignature}` → `{txHash,version}` (S9.4) |
| POST `/devices/push` | owner JWT; `{deviceId,pushToken}` → `{registered:true}`; bound to the JWT's owner address and session; deleted on logout, session revoke or token rotation; push payload carries only an approval/alert ID |
| POST `/wallets/:walletId/inhibit/clear` | owner JWT with original signed-login `auth_time` ≤5 min (else REAUTH_REQUIRED); `{alertId}` → `{inhibited:false}`; agent tokens 403 |

`terms` is exactly `{asset,startsAt,expiresAt,maxActions,maxPayments,maxPayment,spendCap,liquidFloor,depositCap,withdrawCap,reviewThreshold,periodCap,periodSeconds,recipients,schedule,templateIds}` using Permit/Schedule types. All fields required; kind-inapplicable fields zero. Server derives issuedAt/executor/kind/task ID/hashes/nonce/epoch from verified state and checks recipients/Schedule equal Conditions and trusted provider bindings, and checks every term against the current WalletPolicy (S9.4) before returning a draft. Unknown/redundant mismatched fields fail. At most one outstanding Permit draft per wallet; refreshed terms require new native confirmation. Admin nonce/lane is separate.

```ts
type OwnerApproval = {draftId:string; typedData:TypedPermit; scope:Scope;
 recipients:Address[]; schedule:Schedule; templateIds:Hex32[]; digest:Hex32;
 policyVersion:string; intentId:string|null};
type WalletView = {walletId:string; owner:Address; address:Address|null;
 chainId:84532; provisioningState:'DEPLOYING'|'KEYGEN'|'READY'|'FAILED';
 executorAddress:Address|null; paused:boolean; frozen:boolean; epoch:string;
 policyVersion:string; inhibited:boolean; assets:{asset:Address; symbol:string;
 liquidUnits:string; reservedUnits:string}[]; // per agent asset; fields below are DemoUSD
 liquidUnits:string; floorUnits:string; reservedUnits:string;
 vaultAssetsUnits:string; spendableUnits:string;
 budgets:{day:string; walletSpentUnits:string; executorSpentUnits:string;
 walletRemainingUnits:string; executorRemainingUnits:string}; asOfBlock:string};
type Finding = {name:'integrity'|'authority'|'policy'|'settlement'|'delivery'|'completion';
 state:'PASS'|'FAIL'|'PENDING'|'UNVERIFIABLE'; ruleId:string; reason:string;
 evidenceIds:string[]; basis:('chain'|'signature'|'artifact'|'recorder_assertion')[]};
type TaskView = {taskId:string; chainTaskId:Hex32; walletId:string;
 runbookId:string; outcomeState:string; authorityState:string; currentStep:string;
 grossSpendUnits:string; payments:{actionId:string;requestId:Hex32;providerId:string|null;
 amountUnits:string;txHash:Hex32|null;chainState:string}[];
 delivery:{state:'NONE'|'PENDING'|'VALID'|'INVALID'|'FAILED';result:BrowserResult|null};
 result:JsonObject|null;
 findings:Finding[]; nextPollMs:2000};
```

Native methods are the account-aware interfaces in S8.6 plus S9.14: native profile/accounts, specific Login2/Permit5/Admin5/OwnerTransfer5/Approval5/WalletPolicy5 signing, semantic personal transaction builder/journal, protected NativeSession and QR receive-request validation. Recovery words/private keys never cross RN bridge. Native scope/domain/actual-field confirmation remains mandatory; no generic raw digest method exists.

Errors: `{code,message,actionId:string|null,evidenceId:string|null,retryable:boolean}`. 401 auth,403 scope/tenant,409 idempotency/state conflict,422 invalid policy/input,503 unavailable dependency. Error codes include AUTH_SCOPE, PERMIT_INACTIVE, SCOPE_MISMATCH, RUNBOOK_VERSION, RECIPIENT_DENIED, PAYMENT_CAP, DAILY_CAP, LIQUID_FLOOR, RESERVATION_CONFLICT, QUOTE_EXPIRED, DUPLICATE_REQUEST, SCHEDULE_WINDOW, STALE_SIGNAL, MPC_UNAVAILABLE, SIGNING_UNKNOWN, SIMULATION_REVERT, SETTLEMENT_UNKNOWN, DELIVERY_INVALID, EVIDENCE_UNAVAILABLE, POLICY_VIOLATION, SCREENING_HIT, SIMULATION_MISMATCH, REVIEW_REQUIRED, OWNER_REJECTED, WALLET_FROZEN, WALLET_INHIBITED, TEMPLATE_DENIED, PERIOD_CAP, AGENT_ANSWER_INVALID, INTENT_INVALID. Never automatically retry a new financial request after UNKNOWN.

### S5. Worker ↔ runbook boundary

Person 4 exports `advance(snapshot,deps):Promise<RunbookDecision>` from `@mandate/runbooks`; Person 2 invokes it under a durable task lease. No provider or agent calls the signer directly.

```ts
type RunbookDecision = (
 | {type:'PROPOSE'; decisionKey:string; intent:ActionIntent; evidence:JsonObject[]}
 | {type:'WAIT'; dueAt:string; reason:string}
 | {type:'COMPLETE'; result:JsonObject; evidence:JsonObject[]}
 | {type:'AWAIT_AGENT'; question:AgentQuestion; evidence:JsonObject[]}
 | {type:'NEEDS_OWNER'|'FAILED'; reason:string; evidence:JsonObject[]}
 ) & {nextState:RunbookState};
type ActionIntent = {operation:0|1|2|3|5|6; target:Address; amount:string; minOutput:string;
 invoice:Invoice|null; providerSignature:Hex|null; inputHash:Hex32; period:number;
 templateId:Hex32|null; callData:Hex|null; x402:X402Authorization|null};
type AgentQuestion = {questionId:string; kind:'SELECT_OFFER'|'RETRY_OR_FALLBACK'|
 'SET_AMOUNT'|'CONFIRM_COMPLETION'|'ESCALATE'; prompt:string;
 options:{optionId:string; label:string; facts:JsonObject; untrusted:boolean}[];
 bounds:null|{asset:Address; minUnits:string; maxUnits:string};
 defaultOptionId:string|null; defaultAmount:string|null; deadline:string};
```

`AWAIT_AGENT` pauses the task until the agent answers through `/questions/:questionId/answer` or the deadline passes; the worker then calls `advance` again with the answer (or the recorded default) in `snapshot.agentAnswers`. Options and bounds are computed by the runbook from the Permit, WalletPolicy, quotes and reservations; an answer outside them is rejected with AGENT_ANSWER_INVALID. Runbooks never take recipients, addresses, calldata or token addresses from an answer.

Snapshot is `{taskId,chainTaskId,walletId,walletAddress,permitId,conditions,scope,permit,walletPolicy,now,chainBlock,wallet,actions,observations,agentAnswers,approvals,runbookState}` using shared schema types; `now`/times are seconds strings, `actions` includes stored decisionKey, Action, state, txHash and invoice, observations include signed provider output and risk signals. `RunbookState={schemaVersion:4,step:number,attempt:number,retrievals:number,selectedProvider:null|'a'|'b',quotes:QuoteEnvelope[],delivery:DeliveryEnvelope|null,missedPeriods:number[]}`; initialize zero counters/null/empty arrays. `deps` offers `quote(providerId,input)→QuoteEnvelope`, `retrieve(providerId,invoiceId,requestId,paymentTxHash)→{state:'PENDING'}|DeliveryEnvelope`, `readVault()→{blockNumber,liquidAssets,vaultShares,vaultAssets,previewDepositShares,previewRedeemAssets,maxRedeemShares}`, `readRisk()→{sourceId:'demo-risk-v1',state:'NORMAL'|'WARNING',observedAt,sequence}` only; all uint/time values are decimal strings. Vault previews use the amount in immutable Conditions. QuoteEnvelope/DeliveryEnvelope are the exact S6 response bodies, JSON types/validators exported from shared schema. COMPLETE records useful outcome; Person2 separately closes authority. Person4 cannot set signature, epoch or requestId, and supplies calldata only for CALL intents encoded from an approved template; the worker re-encodes it from the template and amount and rejects any byte difference.

Unique `(taskId,decisionKey)` makes repeated advance calls return the same logical action. Person 2 creates random requestId once, chooses issuedAt/deadline, validates input against Permit, stores immutable Action/invoice, reserves atomically and initiates signing. Old expired unbroadcast signatures can be replaced only after prior usability/history is reconciled; never simply release the reservation because a timer elapsed. runbookState update, observations, action insertion and job scheduling commit transactionally. External quote/retrieval calls may repeat; payment cannot repeat.

Outcome states: DRAFT/AWAITING_OWNER/READY/RUNNING/AWAITING_AGENT/COMPLETED/DELIVERY_FAILED/NEEDS_OWNER/CANCELLED. Authority: PENDING/ACTIVE/FROZEN/CLOSING/CLOSED/REVOKED/EXPIRED/INVALIDATED. Action: PROPOSED/RESERVED/AWAITING_APPROVAL/SIGNING/SIGNED/SUBMITTED/INCLUDED/FINALIZED/DENIED/REJECTED/REVERTED/UNKNOWN. An Action above the effective review threshold enters AWAITING_APPROVAL after reservation and before MPC signing; owner rejection or expiry releases its reservation because no signature exists. Chain INCLUDED means three canonical confirmations; FINALIZED requires RPC finalized head. Delivery may proceed at INCLUDED; never label it finalized. Reorg returns action to unresolved and blocks dependent new spending.

### S6. Provider and inspection contracts

Trusted manifest maps target IDs `checkout-healthy`/`checkout-broken` to exact HTTPS fixture URLs; browser workers reject arbitrary URLs, scripts, selectors, redirects and private-network egress. Provider request `POST /providers/:id/check` body `{taskId:Hex32,wallet:Address,asset:Address,targetId,checks}` (asset must be an agent asset the provider prices; the returned Invoice uses exactly that asset) accepts optional `reviewWindowSeconds` (≤900, set by the worker when the price is above the effective review threshold so the invoice can outlive owner co-signature) and returns402 `{providerId,invoice,providerSignature,x402}` where `x402` is the x402-formatted `accepts` entry of S9.10 for the same amount/asset/recipient. InputHash commits canonical `{taskId,wallet,targetId,checks}` with fixed check ordering pageLoad,title,formSubmit. Two providers a/b use prices200000/350000 units, distinct signer=recipient EOAs. Provider a supports pageLoad/title; b supports pageLoad/title/formSubmit. A+B fallback demonstration requests pageLoad/title; capability-filter variant requests formSubmit and selects b. No charge at quote generation.

Authenticated `POST /providers/:id/result {invoiceId,requestId,paymentTxHash}` returns202 `{state:'PENDING'}` or200 `{result,receipt,providerSignature,artifacts}`. It verifies canonical success + three confirmations + matching ActionExecuted (or, in ERC1271 x402 mode, the matching X402Authorized event and settled transferWithAuthorization) and the exact invoice-asset Transfer before running Playwright once. Unique invoice lock/cache; repeated retrieval returns original output. An invalid payment never triggers paid work. BrowserResult is `{schemaVersion:4,targetId,inputHash,checkedAt:string,checks:{pageLoad?:boolean,title?:{actual:string,expected:string,pass:boolean},formSubmit?:boolean},screenshotHash:Hex32,logHash:Hex32}`; exactly requested checks present; title expectation comes from trusted target fixture. Hash result canonical JSON; screenshot/log hashes cover actual bytes. Artifacts return `{artifactId,mediaType,sha256,base64}` through authenticated channel with a 10MiB/result bound. Provider signs DeliveryReceipt under S3. Negative form check is valid delivered inspection. First completed output must be ≤300s old, ≤5s future and consistent with receipt; retries never re-date old output.

Evidence event: `{schemaVersion:4,eventId,taskId:UUID,chainTaskId,wallet,sequence:number,recordedAt:string,type,requestId:Hex32|null,permitId:Hex32|null,payload,prevHash,eventHash}`. SHA-256 RFC8785 of whole event except eventHash, first prevHash zero32; append under task lock. Never overwrite corrections. v7 adds the event types in S9.13; they reuse this envelope. Checkpoint `{schemaVersion:4,chainId:84532,wallet,taskId:Hex32,sequence,headHash}` is RFC8785 bytes signed Ed25519, digest SHA-256 anchored via `EvidenceAnchor.anchor(bytes32 taskId,bytes32 checkpointDigest,uint64 sequence)` with event `Anchored(bytes32 indexed taskId,bytes32 checkpointDigest,uint64 sequence,address publisher)`. Anchor is not an event in its own committed checkpoint; append it to a later checkpoint if needed.

Export ZIP: `manifest.json`, `events.jsonl`, `checkpoint.json`, `checkpoint.sig`, `authority.json`, `transactions.json`, `artifact-index.json`, `artifacts/`. Manifest lists schema, chain/wallet/task, inspection range, public keys, retained hashes and anchor tx; verifier trusts keys/addresses from a separately supplied deployment manifest, never export alone. Store artifacts AES256GCM unique IV, AAD taskId/artifactId; storage commitment SHA256(salt32 || plaintext), with salt+plaintext disclosed only in authorized export. Retain original unsalted provider content hashes too. Retention30days; absent retained bytes means UNVERIFIABLE. Export contains no seeds, shares, service tokens or hidden model reasoning.

`mandate-verify --bundle <zip> --trusted <manifest.json> --rpc <url> --out <report.json>` reads only files/RPC and returns `{schemaVersion:4,taskId,inspectionHead,findings:Finding[],unmatchedOutflows:[],limitations:[]}`. Exit0 only when all required findings PASS; exit1 any FAIL; exit2 no FAIL but pending/unverifiable; exit3 malformed input/tool error. Scan wallet transactions/logs from deployment to inspection head for unexplained supported-asset outflows. A fixture vault's Transfer events are distinguished from wallet PAY. Audit assertions without independent support remain UNVERIFIABLE even if hash integrity passes.

### S7. Delivery gates and honest evidence

| Gate, Dhaka time | Cross-owner result |
| --- | --- |
| G0, Oct17 15:30 | Workspace, ABI/schema fixtures, route examples, credentials, hosts, phone and test ETH agreed |
| G1, Oct17 18:00 | Native owner signature + restore; three-node/two-participant MPCium signature recovered correctly; mandatory authorizer rejection; contract local payment |
| G2, Oct18 02:00 | One phone-approved real Base Sepolia purchase, actual browser output, durable export, initial independent report |
| G3, Oct18 10:00 | All four runbooks, fallback, reservations/restart, pause/recovery, SDK/MCP, full inspector |
| G4, Oct18 15:00 | Adversarial/evaluation results and fixes, rebuild/install/recovery evidence |
| G5, Oct18 18:00 | Tagged APK/source, manifest, deck, ≤5min demo, submission package frozen |
| Submission, Oct20 18:00 target | Upload and verify receipt; official cutoff Oct20 21:59 Dhaka /23:59 Beijing |

These are aggressive targets from Oct17, not estimates backed by an existing implementation. Record actual pass times; a failed gate remains incomplete. Keep a single scope and fix the blocker. No hidden ordinary-key MPC fallback, fabricated test results or guarantee of winning. Tests below are instructions for implementers; this documentation task does not run implementation tests.

Every owner contributes to Q01 native recovery, Q02 MPC isolation, Q03 scope, Q04 contention, Q05 crash durability, Q06 useful purchase, Q07 paid failure/fallback, Q08 assets, Q09 schedule, Q10 confirmed stop, Q11 tampered evidence, Q12 tenant/input isolation, Q13 outage/restore/API-offline recovery, Q14 closure/finality. Required evaluation additionally includes wallet WQ01–WQ14 (S8) and agentic/policy AQ01–AQ14 (S9.15). Agent evaluation: two target fixtures × three purchase variants × three repeats=18 runs: both providers, capability-filtered provider B, and budget-cap rejection. Report valid denials separately from useful task completion. Add two paid-failure, two contention/restart, one asset and one schedule run; record all outcomes. Direct contract/invariant checks are additional, not counted as user runs. Competition requires technical docs, source/README/deploy/test cases, security self-assessment, actual on-chain hashes, English presentation≤10min; optional demo≤5min. Scoring40% completion/30% security-compliance/30% innovation-interaction, possible0–5 on-chain bonus. Public testnet acceptance was confirmed by the user with organizer.

### S8. Complete wallet application — required v6 extension

This section is required implementation work, not an optional UI upgrade. It extends the agent wallet into a usable Android wallet on **Base Sepolia84532**. Documentation is6.0; newly deployed MandateWallet domain is**5**; MandateLogin domain is**2**; existing runbook/evidence payload schema remains4. Existing bootstrap TS/Solidity layouts/domain constants are pre-v6 scaffolds and must be migrated before financial signing. No contract is currently deployed, so no live migration is claimed. Imported accounts/assets do not grant agents new powers.

#### S8.1 Accounts, funds and screens

One encrypted local BIP39 seed supports account indexes0..19 at `m/44'/60'/0'/0/i`. Generate12words; import all Wallet-Core-supported BIP39 word lengths and optional BIP39 passphrase through native UI. Passphrase is separate from device unlock; restore needs same words, passphrase and index. Native encrypted profile stores passphrase if used, account indexes/labels and backup status; none leaves native boundary. Backup flow includes separate passphrase acknowledgement when used; words alone may restore a different valid address. New additional account is derived locally after unlock; no server-generated private keys. On restore derive/display first5 addresses, let user reveal remaining indexes, check RPC balances/nonces and known factory mappings. Do not claim exhaustive account discovery or that an imported seed has no funds because initial addresses are empty.

Each derived owner address has a separate backend owner/session context and, when activated, one factory wallet plus its own MPC executor. Backend never receives the seed/passphrase or derivation proof linking two addresses; account switching invalidates in-memory query/cache/request context and selects that account's session. Local contacts and labels are encrypted device metadata, not recovered from blockchain. Accounts can be renamed/hidden, never silently reassigned to another derivation path.

| Screen group | Required content and actions |
| --- | --- |
| Onboarding | Create/import, optional import passphrase, native backup/verification, receive address, restore consequences |
| Accounts/Home | Account switch/add/rename; separate **Personal account** and **Agent wallet** cards, full addresses, chain label and per-source spendable balances |
| Assets | Native test ETH and ERC20 balances for personal account; token import/hide/details; managed DemoUSD/vault/floor/reservations separately |
| Receive | Account/source+asset selector, copy address, chain-qualified QR/share, supported-asset/network explanation; executor address never presented as receive address |
| Send | Source/asset/recipient/amount, address book or QR, fee quote, simulation, full native confirmation, submitted/pending/detail states |
| Activity | Incoming/outgoing/manual/agent/funding/vault/admin entries, search/filter, fees/nonce/replacement lineage, explorer links, retry/status and exports |
| Agents | Task approval, budgets, useful output/failures, current permissions, pause/revoke/close and recovery |
| Security/Agent Access | Backend devices/sessions, agent-token scopes/revoke, local lock/biometrics/backup/remove wallet, separate logout and stop-agent controls |
| Network/Help | Supported chain/RPC/explorer status, testnet funding guide, offline/stale states, error recovery, app/build/spec version and support instructions |

A combined portfolio total may sum supported assets for display only; it never supplies one fungible spendable amount across accounts/contracts or assets. Show native units and token decimals; no fabricated fiat prices/APY. API/cloud login is not required to create/import, receive, read balances through RPC or send a personal transaction. Internet/chain RPC and personal ETH gas balance are still required to submit it.

#### S8.2 Personal transfers and transaction lifecycle

Personal sends use the local owner EOA, independent of MPC/backend. Native module signs and broadcasts an EIP1559 transaction only after confirmation. It accepts semantic transfer fields, never arbitrary calldata/raw digest. Supported forms: native ETH with empty data, ERC20 `transfer(recipient,amount)` with zero ETH, and explicitly reviewed speed-up/cancel for an existing local nonce. Imported ERC20s need code at address and valid metadata/balance calls; decimals0..36, strings sanitized/length-bounded. Maintain a manifest-backed send-enabled token registry with chain/address/expected code hash and reviewed standard-transfer behavior; DemoUSD is the initial entry; proxy/upgradeable tokens require a separately pinned implementation and are not enabled by default. Imported unqualified tokens are watch-only until reviewed. Known taxed/rebasing/nonstandard tokens are not enabled. Code/metadata checks and eth_call alone cannot prove arbitrary token honesty or exact future transfer behavior. Token names/logos are not authenticity evidence; full token address remains visible. No ERC20 approval/Permit2/raw contract-call capability is added to the agent.

PersonalTransferRequest is `{clientRequestId:UUID,accountId:UUID,chainId:84532,asset:Address,recipient:Address,amount:string}`; asset zero means native ETH. Native validates account/chain/address and builds calldata itself; amounts are base-unit integer strings. Recipient must be nonzero and not the selected sending address; own agent wallet is allowed as a labelled funding destination. Preview is `{localOperationId,from,to,asset,amount,nonce,gasLimit,maxFeePerGas,maxPriorityFeePerGas,estimatedL1FeeWei,estimatedTotalFeeWei,estimatedTotalDebitWei,quoteBlock,quoteExpiresAt,simulation,requestDigest}`; all uint fields strings. estimatedTotalDebitWei is only the personal ETH debit (gas plus value for native sends); token amount remains separate and must never be added to ETH units. TTL≤30s. Use a read-only OP-stack viem quote adapter including L1 data fee; native supplies the exact proposed transaction fields, validates the adapter result against configured chain/RPC and its own nonce/balance/fee checks, and never delegates signing or calldata construction to the adapter; fee buffer is admission estimate, not a guaranteed upper bound on final L1 charges. Never use floating point for balances, amounts or fees.

Native rechecks actual sender, chainId, recipient/calldata, nonce, fee quote and balance before confirming; changed fields/expired quote require new review. Sender needs ETH for token sends. Serialize nonce allocation per EOA across manual transfers and specific owner-operation relays, reconcile RPC pending nonce with durable local signed journal and external activity. Persist encrypted raw signed bytes and txHash before broadcast; same clientRequestId/same transfer returns the same local operation, changed transfer rejects. Restart/retry broadcasts identical bytes; timeout is UNKNOWN, not permission to create another payment. Backend receives only optional transaction hash/account association after submission, never owner secret or authority to rebuild a changed transaction.

UI states: DRAFT/AWAITING_SIGNATURE/SIGNED/SUBMITTED/INCLUDED/FINALIZED/REVERTED/REPLACED/UNKNOWN/CANCELLED/REORGED. Local cancellation before signing discards draft. Speed-up uses same nonce/to/value/data and freshly reviewed higher fees. Cancel after signing is a separately reviewed0-value self transaction with same nonce; original may win. Show **cancel requested** until cancellation is included; only one canonical replacement can settle. Reorg reverses provisional effects. Included=3canonical confirmations; finalized from RPC finalized head. Do not label a missing/dropped RPC transaction as failed without nonce/history reconciliation.

Funding agent wallet is a personal DemoUSD transfer to its verified factory address; native ETH is optional for owner-controlled holdings only and does not expand agent assets. Do not send funds to executor EOA. Direct RPC operates with an API outage; pending native journal survives app restart. If network is offline, show unavailable/queued draft rather than pretend a transaction was sent.

#### S8.3 Manual transfers from the managed wallet

Add a separate owner-only typed operation, outside executor authority:

```text
domain MandateWallet / "5" / 84532 / wallet
OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,
 uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)

applyOwnerTransfer(OwnerTransfer transfer,bytes ownerSignature)
ownerTransferNonce() -> uint256
usedOwnerTransfer(bytes32 transferId) -> bool
OwnerTransferExecuted(bytes32 indexed transferId,address indexed asset,
 address indexed recipient,uint256 amount,uint64 newEpoch,bytes32 transferDigest)
```

Only immutable owner signature, exact current epoch/ownerTransferNonce, unique transferId, positive amount/nonzero non-wallet recipient, correct chain/domain and lifetime≤10min are accepted. Native ETH asset=zero; other asset must be an ERC20 contract and cannot equal the approved DemoVault share token. `receive()` accepts ETH with no delegated ETH operation; fallback rejects unknown calls. Use SafeERC20/ReentrancyGuard/checks-effects-interactions; sufficient balance; for ERC20 require exact wallet debit and recipient credit matching amount, otherwise revert (tax/rebase/nonstandard tokens unsupported). Native ETH uses a value transfer with empty calldata under reentrancy protection. Zero-value calls/arbitrary calldata, token approvals and executor/agent signatures cannot invoke this path.

**Every successful owner transfer pauses the managed wallet and increments authorityEpoch**, invalidating all active/delayed permits. It intentionally bypasses delegated floor/caps: this is owner governance, not an agent payment. Native confirmation explains amount/destination and that agents will stop; unpause requires fresh permits. Works while already paused, requires neither MPC nor backend consent, and only moves current liquid asset balances. Vault shares are not arbitrarily transferrable: use approved redeem/recovery first. Failure rolls back transfer/nonce/epoch; UI cannot claim stop from a reverted transfer. Transaction ordering still permits earlier agent transactions to settle before owner stop.

Backend sets local inhibit during owner transfer preparation; financial lane and Admin coordination re-read epochs/nonces. OwnerTransfer has a separate nonce; relayer fee/retry lineage follows signed original. During API outage the app can pay gas from the funded personal EOA through the specific native relayOwnerOperation method, or export the signed command to an independent funded sender. The native method constructs only known Admin/OwnerTransfer contract calls with verified owner signatures, uses the same personal nonce journal and shows actual gas fees. This is not arbitrary dApp calldata signing. Agent contracts/counters support only the manifest agent assets (DemoUSD and test USDC, S9.9); manual imported-token sweep is owner privilege. Transfer of unsupported/nonstandard tokens fails explicitly, no successful debit is invented.

Inspector classifies OwnerTransferExecuted as **OWNER_CONTROL**, with owner signature, epoch and actual asset movement; it is neither unmatched theft nor an agent payment counted against task budgets. Full managed-wallet history scanning must include it. No fake task/Permit is created for a manual transfer. Personal transactions have their own activity receipts; agent evidence schema4 remains unchanged.

Recovery UI is explicit by asset: existing Admin RECOVER attempts approved vault redemption and sends core DemoUSD to owner; RECOVER_LIQUID sends core liquid DemoUSD only. Native ETH/imported standard ERC20 use separate owner-approved OwnerTransfer sweeps to owner. A multi-asset recovery is a visible sequence with per-transaction progress and remaining balances, not a claimed atomic all-assets recovery. Unavailable vault/nonstandard token remains a visible unrecovered position.

#### S8.4 Receiving, assets and history

Receive supports address copy and constrained ERC681 forms with explicit84532 chain: `ethereum:pay-<recipient>@84532?value=<wei>` and `ethereum:<token>@84532/transfer?address=<recipient>&uint256=<units>`. QR is a draft request only; scan cannot sign/pay. Parse once, show resolved recipient/token/amount, reject conflicting duplicate/unknown function parameters, unsupported chain, malformed address/amount and ambiguous precision. Raw address scan uses visible current chain with explicit review. Do not auto-switch to mainnet or resolve untrusted arbitrary URLs/scripts from QR. Camera permission is requested only for scan; recovery words never go to clipboard. Public receive addresses may be copied/shared.

Personal balances read current RPC; imported-token list max20/account, keyed by chain+token address. Confirm token code/decimals on trusted RPC, allow add/hide/remove metadata without affecting on-chain balances; display watch-only versus reviewed send-enabled status explicitly. Managed card shows supported DemoUSD, ETH if received, approved vault position, floor/reservations and no unearned APY. Hide never burns/withdraws assets. Contacts store only labels+validated addresses per chain in encrypted device storage.

Backend HistoryAdapter uses Etherscan API V2 at `https://api.etherscan.io/v2/api`, chainid84532, configured server-only API key; required actions txlist/tokentx/txlistinternal with bounded paginated queries. Check supported-chain/account quota at setup; do not assume anonymous Blockscout access (the endpoint returned403 during planning). No API key is embedded in APK. Discover hashes/transfers from indexer, verify receipts/block hashes/logs and current balances through independent RPC; mark unverified internal-trace claims as indexer assertions, not independently proved settlement. Managed wallet history additionally scans known token/wallet/vault events from factory deployment; personal account backfill may predate factory creation.

Activity has `{activityId,ownerAddress,source:'PERSONAL'|'MANAGED',category,chainId,txHash,blockHash,blockNumber,nonce,asset,from,to,amount,feeWei,state,operationId:null|string,taskId:null|string,transferId:null|Hex32,replacementOf:null|Hex32,provenance,observedAt}`. Paginate with stable server cursor and dedupe chain+txHash+logIndex/traceIndex. Expose coverage `{fromBlock,toBlock,indexedThrough,backfillState,gaps}`; indexer outage/incomplete history never renders as a verified empty account. Cache last known history/balances with stale labels. Personal native journal remains available without backend; restored full history needs indexer/RPC access. Never derive canonical spendable balance from indexer-only totals.

#### S8.5 App lock and backend sessions

Local unlock, backend API session and on-chain agent Permit are three independent states. External dApp connections are deferred by user choice. Default app lock after60s inactivity/background; signing/seed display always requires explicit native confirmation plus fresh biometric/device-credential authentication. Cancel/re-enrollment/device-lock failure gives no signature; restore through words+passphrase remains possible. Local app unlock never grants backend signing authority.

Use Login domain2 and fields `Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)`; random deviceId identifies installation, not hardware attestation. Native checks current selected account, expected origin/deviceId and≤5min one-use challenge. Backend consumes nonce transactionally, issues15min JWT carrying ownerAddress/sessionId/audience/expiry plus32byte random refresh token. Refresh token is native-encrypted at rest, never AsyncStorage/logs; native HTTPS exchange stores it and returns only access token/session metadata to JS. Server stores token hash/family/session/expiry/revoked/replaced metadata. JWT sessions checked against revocation on each authenticated request; auth DB unavailable denies private API access, not local owner keys.

Refresh rotates atomically, single-flight per native account,7day idle and30day absolute session expiry. Used token replay revokes that family. Lost refresh response requires fresh signed login rather than replaying old token indefinitely. Session expiry never regenerates seed/address. Device list shows creation/last use/public device label/revoked status; revoke other/all sessions requires JWT original auth_time≤5min from an actual owner-signed login (refresh never resets auth_time). Older sessions receive REAUTH_REQUIRED and complete a new native login before revocation. Device label is untrusted text, not proof of hardware identity. No email/password/social account is needed.

Logout revokes current backend session and clears local API tokens; **active agent permits/tokens are not automatically revoked**. Provide separate Stop Agents and Revoke Agent Tokens actions with chain confirmations where needed. Remove Wallet clears encrypted local seed/profile only after native authentication+backup acknowledgement; show that on-chain funds/active permissions remain. Offer confirmed pause before removal and never claim offline deletion stopped agents. No automatic cloud mnemonic backup or server recovery.

#### S8.6 Additional API/native interfaces

Owner JWT and same S4 idempotency rules apply; agent tokens cannot invoke owner transfer/session controls. `/auth/refresh` uses native refresh token, not JWT/idempotency replay cache. New routes:

```text
POST /v1/auth/challenge {ownerAddress,deviceId} -> {challengeId,typedData}
POST /v1/auth/verify {challengeId,signature} -> {accessToken,expiresAt,sessionId,refreshToken,refreshExpiresAt}
POST /v1/auth/refresh {sessionId,refreshToken} -> rotated response above
POST /v1/auth/logout {} -> {revoked:true}
GET /v1/auth/sessions -> {items:SessionView[]}
POST /v1/auth/sessions/revoke {sessionIds:string[]|'ALL'} -> {revokedIds:string[]} // recent signed-login auth_time required
GET /v1/accounts/:ownerAddress/assets -> {items,asOfBlock,stale}
GET /v1/accounts/:ownerAddress/activity?cursor=... -> {items,nextCursor,coverage}
GET /v1/transactions/:txHash -> {transaction,receipt,activity,coverage}
POST /v1/wallets/:walletId/owner-transfers/draft {asset,recipient,amount} -> {draftId,typedData,digest,assetMetadata,feeQuote,effects}
POST /v1/wallets/:walletId/owner-transfers/submit {draftId,ownerSignature} -> {transferId,txHash,state}
POST /v1/accounts/:ownerAddress/transactions {txHash,clientRequestId} -> {activityId,state}
```

OwnerAddress path must equal JWT subject; transaction lookup checks owned involvement before returning private annotations. Hash registration proves nothing until chain verification. No personal signing key/raw signed transaction/private refresh token accepted by transaction registration. Owner-transfer draft includes expected epoch/nonce, token metadata, gas sponsor status and visible stop-agent effect; expired/changed draft requires fresh confirmation. If sponsor unavailable, show independent relay/funded personal-account route, never silently charge owner.

Native interfaces replace single-account assumptions:

```text
createOwner()/restoreOwner() -> {walletProfileId,backupConfirmed,accounts:Account[]}
listAccounts() -> Account[]; addAccount(index,label) -> Account
getAccount(accountId)/renameAccount(accountId,label) -> Account
Account={accountId,address,index,label,backupConfirmed}
signLogin(accountId,typedJson) -> {address,signature}
signPermit(accountId,typedJson,scopeJson,recipients,schedule) -> {address,signature,digest}
signAdmin(accountId,typedJson) -> {address,signature,digest}
signOwnerTransfer(accountId,typedJson) -> {address,signature,digest}
relayOwnerOperation(accountId,'ADMIN'|'OWNER_TRANSFER',typedJson,ownerSignature) -> {txHash,state}
previewPersonalTransfer(request) -> PersonalTransferPreview
confirmAndSendPersonalTransfer(localOperationId) -> {localOperationId,txHash,state}
getLocalTransactions(accountId)/rebroadcastPersonalTransaction(localOperationId)
replacePersonalTransaction(localOperationId,'SPEED_UP'|'CANCEL') -> reviewed replacement result
showRecoveryWords(walletProfileId) -> {completed}; removeLocalWallet(walletProfileId) -> {removed:true}
NativeSession.exchangeLogin(accountId,challengeId,ownerSignature)/refresh(accountId) -> {accessToken,expiresAt,sessionId}
NativeSession.logout(accountId) -> {revoked:boolean,localCredentialsCleared:true}
```

Native accepts semantic transfer and specific permitted typed requests only, no raw digest/private-key export. NativeSession uses pinned API origin/TLS and stores refresh credentials itself. Node/indexer calls need no owner key. Sensitive profile/local-journal/session storage excluded from OS cloud backup; support account switching without cross-owner token/cache leakage.

#### S8.7 External dApp connections — explicitly deferred

User chose to keep WalletConnect/dApp connections for a later release. They are not required work, resource dependencies, navigation controls, demo claims or release blockers. Do not install WalletKit or require a Reown projectId as part of this release. Current app supports direct manual transfers and agent SDK/MCP access; it is not advertised as a general dApp wallet.

A future wallet-side integration must keep owner signing native, select personal EOA/chain/methods explicitly and require per-request native confirmation; it cannot expose managed/executor authority or use AppKit to offload owner approval to another wallet. Future scope needs a separately approved request-method/security specification. Existing native internal Login/Permit/Admin/OwnerTransfer and semantic transfer builders do not become generic dApp signing APIs.

#### S8.8 Owners, milestones and required wallet acceptance

| Wallet gate | Person1 | Person2 | Person3 | Person4 |
| --- | --- | --- | --- | --- |
| W0 — interface freeze | Domain5/OwnerTransfer/Login2 DTOs, vectors | Sessions/history/transfer API samples | Account/native/session interfaces | QR/receive and receipt activity fixtures |
| W1 — personal wallet | Fee/serialization vectors | History adapter/indexer key gate | Create/import/account switch/receive/manual ETH+ERC20 sends | Actual receive/send/QR reference scenarios |
| W2 — managed funds | OwnerTransfer/receive/event/epoch contract | Owner relay/inhibit and history attribution | Managed send/funding/native approval/independent relay | Verifier OWNER_CONTROL attribution |
| W3 — continuity | Nonce/replay/epoch outcomes | Refresh rotation/revocation/pagination/reorg | Lock/restore/retry/cancel/activity/security screens | Reconnect/outage/same-seed restoration cases |
| W4 — whole-app qualification | Transfer/admin/replay vectors | Outage/history/session error states | Navigation, lock, camera permission and secure confirmation | Receive-request fixtures and end-to-end app cases |
| W5 — release | Chain/ABI/type manifest | Deploy/session/indexer actual status | Signed installed APK with all flows | Complete app demo/evaluation assembled |

W0 precedes new signing; W1/W2 run alongside existing G1–G3; W3/W4 before release G4/G5. Original Oct18 internal target/Oct20 official deadline remain, but scope expansion does not establish capacity or guaranteed completion. Record actual gate times/failures and use submission buffer; no passing result or complete-app claim from a scaffold.

Required wallet cases: WQ01 create/import same words+passphrase/index; WQ02 cross-account cache/session isolation; WQ03 native/token QR and wrong-chain/precision rejection; WQ04 ETH/ERC20 transfer exact debit/fee/balance; WQ05 sponsor versus personal gas clarity; WQ06 pending/restart/rebroadcast/UNKNOWN and replacement winner; WQ07 manual managed send pauses/epoch and works without MPC; WQ08 rejected owner/agent/token signatures/domain/nonce; WQ09 refresh replay/revoked device/session expiry leaves owner account unchanged; WQ10 logout versus on-chain stop/local removal; WQ11 history backfill/indexer outage/reorg/no false empty data; WQ12 API-offline personal send/owner independent recovery; WQ13 imported token metadata/taxed/invalid token behavior; WQ14 complete navigation/accessibility, camera permission denial, scan/clipboard precision and double-tap/cancel confirmation. Every case has actual operation/hash or explicit failure evidence. These are planned acceptance cases, not tests run by this update.

### S9. Agentic layer and policy controls — required v7 extension

This section is required implementation work. It adds a real LLM agent and the policy controls found in Cobo- and Circle-class agent wallets, while keeping Mandate's own properties: the owner key stays on the phone, financial limits are enforced by the wallet contract, and every outcome is independently inspectable. Type and route changes are already written into S2–S6; this section defines their behaviour. A max-loss certificate and an agent-initiated on-chain self-pause are **not** part of this release.

| Capability | Reference product idea | Mandate mechanism |
| --- | --- | --- |
| Autonomous agent | Agent acts on a task without per-step human input | Reference agent on the Claude Agent SDK; decides through bounded questions (S9.1–S9.2) |
| Intent to authorization | Pact intent and execution plan | Intent compiler drafts typed terms; owner reviews natively (S9.3) |
| Wallet-wide policy, most restrictive wins | Policy engine with allowlists and limits | On-chain WalletPolicy checked at activation and at every execution (S9.4) |
| Human review above a threshold | Review thresholds / human signing group | Owner co-signature over the exact Action digest, verified by the contract (S9.5) |
| Freeze versus revoke | Freeze keeps terms; revoke ends them | Admin FREEZE/UNFREEZE without epoch change; PAUSE/REVOKE unchanged (S9.6) |
| Standing periodic limits | Daily/weekly/monthly spending policies | ALLOWANCE Permit kind with per-period cap (S9.7) |
| Allowed contracts | Allowed contracts list | Owner-approved call templates with argument bounds and outflow metering (S9.8) |
| Stablecoin payments | USDC agent payments | Base Sepolia test USDC as a second agent asset (S9.9) |
| Machine payments | x402 | x402 `exact` (EIP-3009) USDC payments with the wallet as ERC-1271 payer, using the official `@x402/*` packages (S9.10) |
| Pre-broadcast screening | Sanctions/risk screening | Deterministic risk sentinel: screening, simulation, velocity (S9.11) |
| Agent tooling | CLI/SDK for agents | MCP toolset, SDK and `mandate` CLI with scoped agent tokens (S9.2, S9.14) |

#### S9.1 Agent runtime

- The reference agent `apps/agent` uses the Claude Agent SDK for TypeScript (`@anthropic-ai/claude-agent-sdk`, exact version pinned in the lockfile and the manifest `agent.sdkVersion`) with model `claude-opus-5-5`. The Anthropic API key is a server-side secret in the app Key Vault; it never enters the APK, MCP tool results, logs or evidence.
- The agent's only tools are the Mandate MCP server (`apps/mcp`, stdio) running with a task-scoped agent token. Built-in file, shell, web and editing tools are disabled; the tool allowlist names the exact `mandate_*` tools; a pre-tool-use hook denies and records any other tool request. Loading of ambient project/user settings, skills and memory is disabled. Verify the exact option names against the pinned SDK version and record them in `apps/agent/README.md`.
- The agent process has no signing key, owner credential, database access or RPC write access. It cannot create an Action; only the worker does (S5).
- Any MCP-capable runtime (for example the GitHub Copilot SDK, Claude Desktop or another MCP client) can act as the agent with the same tools and token. The platform never trusts the runtime's identity; security comes from token scope, Permit, WalletPolicy, policy authorizer and contract.
- No LangChain and no hand-written agent loop. The agent loop, context handling and tool calling come from the SDK.
- Per-task model budget: at most 30 model turns and a configured token ceiling per task; on exhaustion the agent stops and the worker applies question defaults.

#### S9.2 Decision protocol between agent and worker

The worker stays the only component that turns decisions into Actions. When a runbook needs judgement it returns `AWAIT_AGENT` with an `AgentQuestion` (S5). The agent reads it with `mandate_next_question` and answers with `mandate_answer`.

- An answer is valid only if `optionId` is one of the listed options, or `amount` is an integer string within `bounds`. Bounds are computed by the runbook from the Permit, WalletPolicy, remaining budget and reservations at question time and rechecked when the answer arrives.
- One accepted answer per question; a repeated identical answer returns the same `decisionId`, a different answer returns 409.
- If the deadline passes without a valid answer, the worker applies `defaultOptionId`/`defaultAmount` and records `AGENT_TIMEOUT`. A question with no safe default fails the task step instead.
- Tool inputs never contain recipient or contract addresses, calldata, nonces, signatures or token addresses. Those resolve from IDs through the trusted manifest, Permit and WalletPolicy.
- Content from providers or web pages appears only inside `facts` with `untrusted:true`. Prompt injection can at most make the agent pick a worse option that is still allowed; this residual risk is listed in the security self-assessment.
- `rationale` is display text of at most 2000 characters, stored as a model claim (`recorder_assertion`), never parsed for instructions.

| Question kind | Used by | What the agent decides |
| --- | --- | --- |
| `SELECT_OFFER` | browser-check, service-allowance | Which eligible signed quote to buy, using price, capability and past delivery facts |
| `RETRY_OR_FALLBACK` | browser-check | Retrieve again, use another approved provider, or stop |
| `SET_AMOUNT` | liquidity-keeper | Deposit/redeem amount inside owner-approved bounds |
| `CONFIRM_COMPLETION` | all | Whether delivered output answers the goal; the deterministic validator still decides validity |
| `ESCALATE` | all | Ask the owner for a new or larger Permit (creates `NEEDS_OWNER`) |

MCP tools (agent token scopes in brackets): `mandate_get_task` [read], `mandate_get_wallet` [read], `mandate_next_question` [run], `mandate_answer` [run], `mandate_get_delivery` [read] (reads the `delivery` field of `GET /tasks/:taskId`), `mandate_request_owner` [run], `mandate_get_evidence` [evidence], plus the existing `mandate_create_task` [prepare] and `mandate_run_task` [run]. The SDK and the `mandate` CLI expose the same operations.

#### S9.3 Intent compiler

`POST /v1/intents/compile` turns an owner's goal into a draft `{runbookId,input,terms}` with a short explanation and warnings. It uses Anthropic structured outputs validated by the shared Zod schemas; the server then rejects unknown providers, assets, targets or templates and checks every term against the WalletPolicy. The draft is a proposal only: the owner edits it in the app, the normal `/tasks` and `/permits/draft` flow follows, and the native screen shows the exact signed terms next to the original goal. The compiler has no keys and no side effects except storing the draft and an `INTENT_COMPILED` evidence event. If it fails, the app offers the manual form.

#### S9.4 Wallet policy — most restrictive rule wins

Each managed wallet stores one owner-signed WalletPolicy: per-asset caps (`perTx`, `daily`, `weekly`), an address allowlist and blocklist, allowed call templates and a wallet-wide review threshold. It is changed only by `applyWalletPolicy` with an owner signature, its own `policyNonce`, `version` strictly increasing, lifetime ≤30 minutes. It works while paused or frozen and needs no MPC or backend consent.

- At `activatePermit`: the Permit asset must have an AssetCap; `maxPayment` ≤ `perTx`, and for ALLOWANCE `periodCap` ≤ the policy cap of the same period (daily or weekly); no Permit recipient may be in the blocklist; if the allowlist is non-empty, every Permit recipient must be in it (an empty allowlist adds no restriction beyond the Permit's own owner-signed recipients); Permit templates must be a subset of policy templates. A call template with recipient rule ALLOWLIST fails when the allowlist is empty.
- At every `execute` and every X402 `isValidSignature`: the contract re-checks the current allowlist (when non-empty), blocklist, asset caps (per transaction, wallet day and wallet week), template membership and review threshold. Removing a recipient from the allowlist stops it immediately, even for already active Permits and already recorded X402 authorizations. Tightening takes effect immediately for active Permits; loosening never enlarges a Permit beyond its own signed terms.
- Policy updates do not change the epoch. At wallet creation the default policy has AssetCaps equal to the S2 ceilings for DemoUSD only, an empty allowlist and blocklist, no templates and no review threshold. USDC agent use requires the owner to add a USDC AssetCap first.
- Policy limits cannot exceed S2 ceilings; allowlist and blocklist hold at most 32 entries each; at most 8 templates.

#### S9.5 Review thresholds and owner co-signature

The effective threshold is `min(permit.reviewThreshold, policy.reviewThreshold)`. For PAY, TRANSFER, X402 and CALL, if the Action amount is above it, `execute` requires an owner signature over `Approval(actionDigest, expiresAt)` in domain 5, with `expiresAt ≤ action.deadline`. The contract verifies it against the immutable owner.

1. The worker reserves budget, stores the immutable Action, sets `AWAITING_APPROVAL` and creates an approval request. Co-signed Actions and their Invoices may live up to 15 minutes.
2. The owner's phone receives a push carrying only the approval ID, loads the request over the authenticated API, and the native module recomputes the Action digest from the displayed fields (provider, recipient address, asset, amount, task, untrusted agent rationale).
3. After the owner signs, the worker requests the MPC executor signature and relays. Rejection or expiry releases the reservation (no executor signature exists) and records `OWNER_REJECTION`.

Agent tokens cannot read or sign approvals. A direct contract call without the owner approval reverts.

#### S9.6 Freeze versus pause and revoke

- `FREEZE` (Admin command 5) stops `execute`, CALL and X402 immediately with `WalletFrozen`. Permits, counters and epoch stay unchanged; Permit expiry keeps running.
- `UNFREEZE` (Admin command 6) restores execution of still-valid Permits without new approval.
- `PAUSE`, `REVOKE`, `RECOVER` and `RECOVER_LIQUID` keep their existing epoch-invalidating behaviour.
- Owner transfers, admin commands and policy updates work while frozen. Only the owner can freeze or unfreeze; the backend can set an off-chain inhibit (S9.11) but cannot freeze on chain.
- The app explains the four separate effects: logout (API session), freeze (temporary stop, terms kept), pause/revoke (authority ended, new Permits needed) and owner transfer (funds moved, agents stopped).

#### S9.7 Standing allowance

`ALLOWANCE` (kind 3) is a long-lived spending permission for recurring service purchases. Lifetime ≤30 days; `periodSeconds` is 86400 or 604800; `periodCap` limits gross spend per period, where the period index is `(block.timestamp − startsAt) / periodSeconds`; `maxPayment`, `spendCap`, ≤4 allowlisted provider recipients and ≤200 actions also apply. Allowed operations are PAY, X402 and CLOSE. The `service-allowance` runbook lets the agent buy allowlisted provider capabilities on demand, each purchase going through the same quote, delivery check and evidence path as browser-check.

#### S9.8 Call templates

A CallTemplate allows one contract function: `target`, the target's runtime `targetCodeHash`, `selector`, the argument index holding the amount, the argument index holding a recipient with its rule (none, must equal the wallet, must be in the allowlist), `flags` and `maxAmount`.

- **Content-addressed.** `templateId = keccak256(abi.encode(target, targetCodeHash, selector, amountArg, recipientArg, recipientRule, flags, maxAmount))`. Schema and contract reject any other ID, so a definition can never be replaced under the same ID; changing a target, bound or rule creates a new ID that old Permits do not contain. Removing a template from the WalletPolicy disables it immediately.
- **Pinned code.** At execution the contract requires `extcodehash(target) == targetCodeHash`. Upgradeable proxies are not allowed as targets in this release; the risk sentinel also rejects a target whose EIP-1967 implementation slot is set.
- Rejected at policy update: a target that is an agent asset token, the wallet, the factory or the anchor; selectors `approve`, `increaseAllowance`, `permit`, `transferFrom`, `setApprovalForAll`, `transfer` and `transferAndCall`; more than 8 templates.
- Execution uses `operation = CALL`. `Action.target` is the template target, `Action.amount` the amount argument and `Action.inputHash = keccak256(callData)`. Calldata must be the selector plus at most 8 static 32-byte words, with no ETH value.
- The contract checks the selector, the amount argument ≤ `min(maxAmount, Action.amount)` and the recipient rule. With `PULLS_ASSET`, it approves exactly the amount of `Permit.asset`, calls, then resets the allowance to zero in the same transaction.
- **Single-asset metering.** The contract measures every agent-asset balance before and after. Only `Permit.asset` may decrease; any decrease of another agent asset reverts. The `Permit.asset` decrease counts as gross outflow against the Permit, period and policy caps for that asset only; a decrease above `Action.amount`, a liquid floor breach or any non-zero leftover allowance reverts. `CallExecuted` names the asset.
- CALL is allowed only for LIQUIDITY Permits whose `templatesHash` includes the template. LIQUIDITY Permits that use DemoVault DEPOSIT/WITHDRAW must name DemoUSD as their asset. The DemoVault deposit/withdraw operations remain; templates let the owner approve a second test vault or pool without new contract code.

#### S9.9 Agent assets

Manifest `agentAssets` lists DemoUSD and Base Sepolia test USDC. Resolve the USDC address from Circle's documentation at G0 and pin its code hash from chain; never trust it from configuration alone. Each Permit names one asset; Invoices carry the asset; counters are keyed per permit, per (executor, asset, day) and per (wallet, asset, day/week). The DemoVault underlying stays DemoUSD. Providers publish prices per asset. Imported personal tokens still never become agent assets.

#### S9.10 x402 payments

Mandate implements the official x402 v2 `exact` scheme on EVM with the EIP-3009 transfer method ([spec](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md)). Use the official packages at the pinned version: `@x402/core` and `@x402/evm` for types and payloads, `@x402/fastify` in the provider, `@x402/fetch` only for EOA test clients. Network is `eip155:84532`, the asset is Base Sepolia USDC, and the headers are `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE`. The managed wallet contract is the payer and approves payments through ERC-1271.

**Verified token behaviour (2026-10-18):** Base Sepolia USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, FiatToken version "2") exposes `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)`. On a Base Sepolia fork, a contract wallet paid through it via `isValidSignature`, and an unapproved digest reverted. The facilitator path is not yet verified (gate X402-G).

**Authorization is derived from the signed Action, never from free input.** For `operation = X402` the contract builds the EIP-3009 `TransferWithAuthorization` itself:

| EIP-3009 field | Value |
| --- | --- |
| `from` | `address(this)` |
| `to` | `Action.target`; must equal the Invoice recipient and pass Permit recipients, allowlist and blocklist |
| `value` | `Action.amount`; must equal the Invoice amount |
| `validAfter` | `0` |
| `validBefore` | `Action.deadline` (≤60 s, or ≤15 min when co-signed) |
| `nonce` | `Action.requestId` |

The digest is `keccak256("\x19\x01" ‖ USDC.DOMAIN_SEPARATOR() ‖ hashStruct)`. The Permit asset and Invoice asset must be USDC. `execute` applies every PAY check (Invoice binding, caps, period, floor, co-signature) and then:

1. Records the authorization `{digest, permitId, epoch, asset, recipient, amount, validBefore, requestId}` and emits `X402Authorized`. At most 8 authorizations may be outstanding per wallet.
2. Charges gross counters immediately. Gross counters are never refunded.
3. Counts outstanding unexpired, unsettled authorizations as committed outflow. Liquid funds available for the floor check and every other spend are `balance − outstanding`. Each `execute` prunes entries that expired or whose nonce USDC reports as used (`authorizationState(wallet, nonce)`).

`isValidSignature(digest, signature)` returns `0x1626ba7e` only when **all** of these hold, and `0xffffffff` otherwise:
- the digest is recorded and `block.timestamp < validBefore`;
- the wallet is not frozen or paused, and `authorityEpoch` equals the recorded epoch;
- the Permit is still active (not revoked, closed or expired);
- the recipient is still allowed by the current allowlist and not in the blocklist;
- `signature` is exactly 65 bytes: `requestId ‖ permitId ‖ 0x01`.

So FREEZE, PAUSE, REVOKE, CLOSE, epoch changes and policy tightening stop an authorization that has not yet settled. Chain order still lets a settlement mined before the stop succeed; it is then recorded normally. The wallet offers no other ERC-1271 approval.

**Flow:** provider 402 (`@x402/fastify`, with the signed Mandate Invoice in `extra`) → agent `SELECT_OFFER` → worker reserves and creates the X402 Action → policy, sentinel, MPC executor signature → relayer submits `execute` → the worker builds the x402 `PaymentPayload` (authorization fields above, the 65-byte signature) with `@x402/core` types and retries the request with `PAYMENT-SIGNATURE` → the facilitator verifies through `isValidSignature` and settles → the provider verifies the settled `Transfer` and USDC `AuthorizationUsed(wallet, requestId)` and runs the check once.

**Gate X402-G:** settle one payment end to end through the chosen facilitator (Coinbase CDP facilitator or the open-source facilitator from the x402 repository) on Base Sepolia, and confirm it accepts the contract payer and the 65-byte signature. Until it passes, `x402.mode` stays `MANDATE_NATIVE`: providers still return the official x402 402 response, payment uses a normal PAY with the Invoice, and the release does not claim x402 settlement interoperability.

#### S9.11 Risk sentinel and screening (deterministic)

The policy service runs these checks before the authorizer signs any agent Action; none uses an LLM.

1. **Screening:** recipient, call target and x402 `payTo` against the WalletPolicy blocklist and the manifest screening list (`demo-screening-v1`, a labelled testnet fixture). A hit denies with SCREENING_HIT.
2. **Simulation, in two stages** (an exact `execute` simulation needs the executor signature, which does not exist before signing):
   - **Before signing (policy service):** simulate the *inner effect* at the latest block through the independent RPC with `eth_call` from the wallet address: the token `transfer` for PAY/TRANSFER, the template call for CALL, the vault preview for DEPOSIT/WITHDRAW, and for X402 the USDC `transferWithAuthorization` balance effect via a state override that approves the digest. Compare `balanceOf` before and after for every agent asset. Only `Permit.asset` may change, by exactly the intended outflow. Otherwise deny with SIMULATION_MISMATCH and sign nothing.
   - **After signing, before broadcast (worker):** `eth_call` the exact signed relayer transaction. A revert or mismatch blocks broadcast with SIMULATION_REVERT. The reservation is kept until the signed Action's deadline passes or chain history shows it unusable, because an executable signature already exists.
   - The independent RPC must support `eth_call` with state overrides. Without it, the policy service fails closed with MPC_UNAVAILABLE-class retryable denials.
3. **Velocity:** versioned rules `risk-rules-v1` (for example three denials for one wallet within 10 minutes, or spend rate above a configured fraction of the daily cap within an hour). A trigger sets an off-chain inhibit for that wallet (no new signing requests), records `RISK_ALERT` and pushes an alert recommending FREEZE. The inhibit can only stop; the owner lifts it through `POST /wallets/:walletId/inhibit/clear` with a recent signed login.

#### S9.12 Permission tiers

| Tier | Holder | Can | Cannot |
| --- | --- | --- | --- |
| T0 Observe | Agent token with `read`/`evidence` | Read wallet, task, delivery, evidence | Create or run anything |
| T1 Propose | Agent token with `prepare`/`run`; the LLM agent | Create tasks, run approved tasks, answer bounded questions, request owner escalation | Sign; choose addresses, calldata or nonces; exceed bounds |
| T2 Execute | MPC executor with the policy authorizer | Sign Actions within an active Permit, WalletPolicy and sentinel checks | Exceed any contract-enforced limit; sign Admin, Policy, Approval or OwnerTransfer |
| T3 Owner review | Owner phone, per-Action Approval | Approve or reject an Action above the review threshold | — |
| T4 Owner control | Owner key only | Permits, WalletPolicy, FREEZE/UNFREEZE, PAUSE/UNPAUSE, REVOKE, RECOVER, OwnerTransfer | — |

Relayers, provider keys, the evidence signer, MPC initiator and backend have no financial tier: they pay gas, sign claims or authenticate requests. Only T4 can increase authority. T1 and T2 consume authority within limits; the backend can only reduce it (deny, inhibit).

#### S9.13 Evidence and verifier additions

New evidence event types, using the S6 envelope and schema 4: `INTENT_COMPILED`, `AGENT_QUESTION`, `AGENT_DECISION`, `AGENT_TIMEOUT`, `APPROVAL_REQUESTED`, `OWNER_APPROVAL`, `OWNER_REJECTION`, `RISK_ALERT`, `SCREENING_DENIAL`, `POLICY_UPDATED`, `WALLET_FROZEN`, `WALLET_UNFROZEN`, `CALL_EXECUTED`, `X402_AUTHORIZED`. `AGENT_DECISION` records `{questionId,optionId|amount,rationale,rationaleHash,runtime,sdkVersion,model,toolCallId}` with basis `recorder_assertion`; model output is never treated as proof.

The verifier adds these checks: under **authority**, a valid owner Approval exists for every Action above the effective threshold at its block, and no agent Action executed while frozen; under **policy**, each Action respected the WalletPolicy version and blocklist in force at its block (from `WalletPolicyUpdated` events and calldata); under **settlement**, CALL outflows match `CallExecuted` and token Transfers, and X402 settlements match `X402Authorized`, the USDC `AuthorizationUsed(wallet, requestId)` event and the Transfer; no X402 settlement may occur after a stop that preceded it in chain order. AGENT_DECISION events are reported as assertions, never as PASS evidence.

#### S9.14 Additional native and client interfaces

```text
signApproval(accountId,typedJson) -> {address,signature,digest}
signWalletPolicy(accountId,typedJson,listsJson) -> {address,signature,digest}
signAdmin(accountId,typedJson)    // now also FREEZE/UNFREEZE
relayOwnerOperation(accountId,'ADMIN'|'OWNER_TRANSFER'|'WALLET_POLICY',typedJson,ownerSignature)
NativePush.register(accountId) -> {pushToken}
```

Native recomputes the Approval digest from displayed Action fields and the WalletPolicy list hashes from the displayed lists before signing. Push messages carry only an ID; details are always fetched over the authenticated API. The `mandate` CLI (`apps/cli`) wraps the SDK for scripts and agents, reads its token from the environment, and never prints it.

#### S9.15 Required agentic and policy acceptance cases

AQ01 the Claude Agent SDK agent completes a browser-check purchase using MCP tools only while the phone is offline; AQ02 a provider page with prompt-injection text cannot add recipients, amounts or tools, and the result is an allowed option or a default; AQ03 an answer outside options or bounds is rejected, and a missed deadline applies the recorded default; AQ04 attempts to use built-in shell/file/web tools are denied and recorded; AQ05 the intent compiler's draft with an unknown provider, asset or template is rejected, and the native screen shows exactly the signed terms; AQ06 an Action above the threshold reverts on direct call without owner approval, succeeds with it, and owner rejection pays nothing and releases the reservation; AQ07 FREEZE blocks execution while Permits survive, UNFREEZE resumes them, and PAUSE still invalidates; AQ08 policy tightening applies immediately to active Permits and loosening does not enlarge them; AQ09 a blocklisted recipient is denied by the sentinel and by the contract; AQ10 ALLOWANCE period caps hold across a period boundary; AQ11 a banned selector is rejected at policy update, and a CALL with outflow above amount, floor breach or leftover allowance reverts; AQ12 DemoUSD and USDC counters and caps are independent; AQ13 an X402 payment settles through the facilitator; changing any authorization field fails; `isValidSignature` rejects unrecorded digests and recorded ones after freeze, pause, revoke, epoch change or allowlist removal; two outstanding authorizations plus a PAY cannot break the floor; MANDATE_NATIVE fallback works; AQ14 a simulation mismatch denies signing, and a velocity trigger sets the inhibit and alerts the owner. Each case needs actual operation/hash or explicit failure evidence.

#### S9.16 Owners

| Area | Person1 | Person2 | Person3 | Person4 |
| --- | --- | --- | --- | --- |
| Types and contracts | v7 Permit/Action/Invoice/Approval/WalletPolicy/CallTemplate types, vectors, ABI; FREEZE, policy, co-sign, allowance, CALL, multi-asset, X402/ERC-1271 in MandateWallet | Consume vectors in policy/adapter | Consume vectors natively | Consume vectors in verifier/provider |
| Agent and decisions | — | Question/answer storage and routes, agent-token scopes, compile route hosting | Show agent questions/decisions in task view | `apps/agent` on the Claude Agent SDK, MCP tools, runbook questions, intent compiler library, CLI |
| Owner controls | Contract checks | Approval requests, push delivery, policy drafts, owner relays | Approval, policy editor, freeze controls, allowance approval, intent review screens | Approval/freeze scenarios |
| Risk | — | Risk sentinel, screening, simulation, inhibit | Alert display and freeze action | Injection and malicious-provider fixtures |
| Payments | Invoice domain 2, X402 path | USDC relaying and reservations per asset | Per-asset balances | x402-formatted provider responses, gate X402-G |
| Evidence | Event ABI | Write S9.13 events | — | Verifier S9.13 checks |
