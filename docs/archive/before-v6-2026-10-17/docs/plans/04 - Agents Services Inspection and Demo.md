---
type: implementation-handoff
title: Person 4 — Agents Services Inspection and Demo
version: "5.0"
updated: 2026-10-17
status: specified-not-built
owner: Person4
---

# Person 4 — Agents, Services, Inspection and Demo

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: follow the numbered tasks and the identical shared contract included below. You supply the task intelligence and real services; Person2 supplies durable financial execution. Build the independent verifier early enough to catch incompatible evidence before release. Implementation agents may execute directly without delegation.

**Goal:** make the wallet accomplish real bounded tasks and demonstrate, through independently inspectable evidence, exactly what permission, payment and useful output occurred.

**Architecture:** a typed runbook library proposes operations to Person2's worker. Two controlled provider identities sell actual Playwright browser checks for DemoUSD on Base Sepolia. The standalone verifier trusts separately supplied keys/contracts and independent RPC. SDK/MCP use the same scoped API, never direct signing keys.

**Stack:** Node22/TypeScript/Zod/viem/Playwright; canonical hashing/signature helpers from shared package; TS SDK; MCP stdio; standalone ZIP/JSON verifier. One structured model call can interpret browser goals; money movement uses deterministic code.

## 1. Complete deliverables

| Output | Owned files | Acceptance |
| --- | --- | --- |
| Preparation/runbooks | `packages/runbooks/src/{prepare,advance,browser,liquidity,schedule,validators}.ts`, versioned manifests/guides | Shared snapshot→decision interface; no direct signer access |
| Paid counterparties | `apps/provider/src/{quotes,payments,fulfillment,receipts,auth,controls}.ts` | Real on-chain invoice verification and actual browser output |
| Fixtures | `demo/targets/{healthy,broken}`, `demo/provider-config.json` | Genuine successful/failed checkout tests, protected failure modes |
| Agent integrations | `packages/sdk`, `apps/mcp`, `examples/external-agent.ts` | Read/prepare/run/evidence scopes, no Admin or signing bypass |
| Independent inspector | `packages/verifier/src/{bundle,integrity,authority,policy,settlement,delivery,completion,cli}.ts` | Six findings from files/chain without our backend |
| Evaluation/release | `evaluation`, `demo/script.md`, `submission`, `evidence/person4` | Measured full-system runs, ≤5min video, English deck/bundle |

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

### P4-02. Signed invoice/payment/fulfillment, G1–G2

**Create:** S6 check/result routes, provider invoice/result persistence and transaction verifier.

- [ ] `/providers/:id/check` returns HTTP402 with actual S3 invoice/provider signature. Hash exact fixed-ordered input.≤60s lifetime, invoiceId randombytes32, taskId chainbytes32, wallet correct; recipient equals provider. Quote idempotency/cache prevents uncontrolled duplicate invoice generation for same requested quote window, but a renewed expired quote has a fresh ID.
- [ ] `/providers/:id/result` authenticates worker-only credential with tenant invoice context; verify receipt canonical success, three confirmations, exact emitted ActionExecuted+DemoUSD Transfer amount/from wallet/to provider and invoice/request/input IDs. Use generated ABI and manifest token/wallet. A tx hash alone or unrelated token transfer is insufficient.
- [ ] Persist invoice fulfillment lock and status. Run actual Playwright once after qualifying payment; retries retrieve original output,202 while pending, never re-charge. Sign DeliveryReceipt over exact canonical resultHash and payment hash; output returns actual screenshot/log bytes and hashes as S6. Bound artifact/result sizes and reject malformed media.
- [ ] Protect controls behind demo operator auth: a paid provider-a timeout, a malformed output mode, repeat original request and tampered export copy. Failure switches affect only fixture/provider service, cannot change wallet permissions or execute arbitrary code. Paid timeout records an actual payment with failed delivery; no refund is assumed.
- [ ] Test unpaid/unrelated/reverted/insufficient-confirmation/reorged payment, mismatched invoice, duplicate result retrieval, wrong provider key, stale future-dated result and missing requested check. Reorg invalidates delivery's current settlement finding even if original output exists.

**Acceptance:** a real Base Sepolia200000-unit PAY unlocks actual browser output; duplicate retrieval returns same receipt/result without another wallet transfer. Provider has no wallet seed/executor share/agent Admin authority.

## 3. Bounded agent workflows and integrations

### P4-03. Durable runbook decisions, G1 stub → G3 complete

**Create:** `@mandate/runbooks` exported prepareTask/advance/validateResult, manifests and `skills/{browser-check,liquidity-keeper,scheduled-pay}/SKILL.md`.

**Consumes:** S5 snapshot/deps from Person2. **Produces:** only shared RunbookDecision. Financial actions are proposals, not already signed calls.

- [ ] Browser Check filters owner-allowed providers by required check support, gets signed quotes, chooses cheapest valid price with provider ID tie-break, then PROPOSES PAY. `decisionKey = chainTaskId + ':browser:pay:' + attemptIndex`; attemptIndex advances only after persisted previous settlement/delivery outcome, not on process restart.
- [ ] After proposal, wait for matching stored INCLUDED payment before retrieve; UNKNOWN/SIGNING/SUBMITTED do not permit another payment. On missing/invalid delivery, retrieve original receipt up to3 attempts with bounded backoff within10min/8steps/remaining invoice lifetime constraints. Subsequent fallback uses another approved eligible provider only if remaining gross cap/pay count permits. Never ask model to override limits.
- [ ] Validate requested checks/input/result hash/provider receipt/artifact bytes/freshness. Distinguish negative inspection from absent/malformed delivery. Return COMPLETE for valid requested observations; otherwise FAILED/NEEDS_OWNER with original failure and gross spend preserved. Person2 handles signed CLOSE separately.
- [ ] Liquidity Keeper proposes one explicitly approved deposit/redeem, uses trusted DemoVault preview/risk service and observed pending liquidity needs. Deposit needs fresh NORMAL signal; warning/stale stops deposit. Withdrawal is to wallet only; unresolved/failed redemption blocks dependent purchase. `decisionKey = chainTaskId + ':liquidity:' + command`; no autonomous repeated deposit cycle.
- [ ] Risk source `GET /demo/risk` returns `{sourceId:'demo-risk-v1',state:'NORMAL'|'WARNING',observedAt,sequence}` through authenticated service; signal is fixture/recorder assertion, not independently proven market risk. Person2 policy checks its own freshness/source. Label it simulated.
- [ ] Scheduled Pay derives due period from trusted chain time, exact owner Schedule, proposes unused current period only; skip missed windows, no model/catch-up. `decisionKey = chainTaskId + ':schedule:' + period`. Period and transfer amount cannot change after approval.
- [ ] Build reproducible manifests by canonical hash of emitted JS/schema/validator/lock artifacts. Publish hashes to Person1/2/3; changed code/hash requires fresh owner Permit. Skill guides document input schemas, owner handoff, permissions, status polling, denial and retry—not signing secrets or authority grants.

**Acceptance:** calling advance twice with same snapshot makes same decisionKey; restart cannot make another payment intent while old one unresolved; browser fallback totals0.55 gross for paid A failure+B success; asset/schedule follow separate explicit permissions.

### P4-04. TypeScript SDK and MCP, G3

- [ ] SDK exports `createTask`, `getTask`, `runTask`, `getWallet`, `getEvidence`; import generated API types and use caller-provided baseURL/token. Reuse original idempotency key on same request retry;409/UNKNOWN propagate instead of creating new money movement. No owner signing/Admin functions in agent SDK.
- [ ] MCP stdio tools `mandate_create_task`, `mandate_get_task`, `mandate_run_task`, `mandate_get_wallet`, `mandate_get_evidence` map one-to-one; credentials from environment, never tool results/logs. Enforce local input schemas and service scopes. Task creation may return AWAITING_OWNER and agent must wait for human approval, not manufacture a signature.
- [ ] `examples/external-agent.ts` demonstrates token-based prepare→owner handoff→run→poll→download evidence through same API. Works independently of app login session; cannot escape its wallet/task scope. Evidence download requires explicit evidence scope.
- [ ] Test read-only token denied prepare/run, prepare-only denied run, revoked/expired token rejected, wrong task/tenant denied. Prompt injection in provider output is treated as data and cannot add tools/permissions/raw contract calls.

**Acceptance:** external client starts already approved task while phone offline through the same budget/policy/MPC path. An MCP tool cannot spend without an active owner Permit.

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

## 5. Evaluation, demonstration and final packet

### P4-06. Full-system acceptance and release assembly, G3–G5

- [ ] Maintain `evaluation/cases.json` for Q01–Q14 with feature owner, expected observation, input/config/commit/run ID and result. Collect per-owner tests and integration cases; do not accept assertions without actual outputs.
- [ ] Execute18 normal user runs:2targets×3variants×3repeats. Variants: both providers/all requested supported checks; a declared capability filter making B eligible; tightened cap preventing purchase. Third variant's correct denial is recorded as authorized rejection, not a successfully completed inspection. Add2paid-failure,2contention/restart,1asset,1schedule runs. Report denominator/job category explicitly so successful task completion rate is not inflated by counting denials as delivery.
- [ ] Measure gross tokens/completed task, successful deliveries, accepted violations, duplicate logical charges, interventions after approval, time to inclusion/output, failed provider cost, confirmed stop/recovery, independent evidence coverage and unresolved findings. Never compare N/A incomplete-task cost to zero. Reference experiment is payment-only single provider with same auth/caps/idempotency, labelled internal fixture comparison—not Cobo/production benchmarking.
- [ ] Record ≤4:45 video: native approval+phone closes0:40; real paid check0:55; A-paid-failure/retrieval/B-fallback0:55; asset+schedule0:45; replay+tamper/inspector0:50; confirmed pause/old-permit rejection+cost0:40. Show real hashes, label test tokens/fixtures/simulated risk/accelerated schedule/cuts/prior transactions. Fresh run is INCLUDED; use clearly dated earlier FINALIZED run for finalized inspection.
- [ ] Demo controls are operator-authenticated fixture switches only. Near-cap scenario uses actual chain spends/refunds or local test specifically labelled; no hidden DB balance edits. Independent receipt tampering changes a copy, never original ledger.
- [ ] Assemble English deck target9min including3min demo excerpt: job/problem; product flow; architecture; named control layers; actual application; measured results; inspection; risks; contribution/next step. Competition maximum10min presentation, optional video5min.
- [ ] `submission/` contains README/deploy/test instructions, tagged source link/license notices, APK/hash from Person3, architecture/core algorithm/security report, deployment manifest/public tx index from Person1/2, evaluation JSON/report, authentic receipt bundle+verifier report, video/deck, known-risk list and actual upload receipt. Exclude mnemonics/share backups/PATs/API tokens/private keys. Assign each report section to its implementing owner; you assemble and check consistency.
- [ ] `make release-check` verifies file manifest/checksums, source tag, ABI/schema/native/MPC pins, APK install proof and links. Actual public uploads/submission use user-authorized competition workflow; do not message third parties or publish secrets as part of implementing this handoff.

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


---

## Shared implementation contract — included in all four handoffs

This appendix is identical in the four documents. It is specification version 5, dated 2026-10-17. On-chain EIP-712 domains remain version **4**, and receipt schema remains **4**: the MPC engine and team allocation changed, not the signed Solidity fields. Never change an interface in only one component. Person 1 owns `packages/schema`; consumers propose a change and update its fixtures before merging.

### S1. Product, boundary and ownership

Build **Mandate Wallet**: an Android owner wallet delegates bounded tasks to an online agent; the agent buys real browser checks, operates one approved test vault and makes fixed scheduled payments. Payments and useful delivery are recorded separately. An independent verifier reconstructs permission, spending and delivery from an export and public chain data.

| Person | Sole write ownership | Outputs consumed by others |
| --- | --- | --- |
| 1 | `packages/contracts`, `packages/schema`, `deployments`, root workspace/CI configuration | ABI, schemas, fixtures, deployment manifest, chain validation |
| 2 | `apps/api`, `apps/worker`, `services/policy`, `services/mpc-adapter`, `services/mpc-authorizer`, `infra`, migrations, evidence writer | Public API, durable execution, two-node MPCium, policy authorization, exports |
| 3 | `apps/mobile`, `modules/owner-wallet`, `tools/relay-admin.ts` | Native owner wallet and signed authority, installed APK, independent recovery sender |
| 4 | `packages/runbooks`, `apps/provider`, `packages/sdk`, `apps/mcp`, `packages/verifier`, `demo`, `evaluation`, submission assembly | Runbook driver, paid browser services, integrations, standalone inspector, recorded demonstration |

Person 2 owns the worker process; Person 4 supplies its runbook library. Person 2 writes evidence; Person 4 verifies it independently. Person 1 owns ABI/schema generation; other owners never hand-maintain copies. Each owner supplies tests, deployment instructions, known risks and screenshots/logs for their own deliverable. No unassigned fifth person is required.

Use one monorepo `./`, Node 22, TypeScript, pnpm workspaces with a checked-in lockfile; Solidity 0.8.28/OZ 5.x/Foundry; PostgreSQL 16; React Native with Expo 54 native Android build; Go 1.25.8 for MPCium. Person1 creates the workspace. All filenames here are relative to it and are planned files, not claims that source already exists. Pin resolved package versions in lockfiles; container images use resolved digests in the release manifest. Keep secrets out of Git and frontend bundles.

`DeploymentManifest` includes `{schemaVersion:4,chainId:84532,sourceTag,contracts:{factory,token,vault,anchor,walletImplementation:null},providers,targets,origins,mpc,evidence,runbooks,dependencyPins}`. Each non-null contract is `{address,deploymentBlock,codeHash}`; providers are `{providerId,recipient,capabilities}`; targets are `{targetId,url,expectedTitle}`; origins are `{api,provider}`; mpc is `{engine:'mpcium',commit,thresholdConfig:1,participants:2,initiatorPublicKey,authorizerPublicKey}`; evidence is `{ed25519PublicKey,publisher}`; runbooks is list of full hashed manifests. Strings for times/blocks, strict validated keys/addresses/hashes. Per-wallet mapping is `{walletId,owner,walletAddress,deploymentBlock,codeHash,mpcWalletId,executorAddress,executorPublicKey,keyVersion}` checked against factory and signed Permit. Keys in these structures are public only. Resolve real deployment addresses/versions at setup gates; do not fabricate them to fill the manifest.

### S2. Network, assets and financial identities

Base Sepolia, chainId **84532**. Six-decimal `DemoUSD`, no monetary value; one controlled ERC-4626 `DemoVault`. No other token/chain/vault is accepted. On-chain amounts are integers; JSON represents uint64/uint256 as decimal strings, enum/count fields as bounded integers, addresses as validated EVM addresses and bytes32/signatures as `0x` hex. API UUIDs never substitute for chain bytes32 IDs. Store explicit UUID ↔ chain ID mappings.

Identities: local owner EOA; per-wallet MPC executor EOA; wallet contract; separately funded normal/emergency/anchor relayers; two provider signer/recipient EOAs; Ed25519 evidence signer; Ed25519 MPC initiator and policy-authorizer identities. None of the service credentials is the owner key. An executor signature authorizes an Action; a relayer signature only pays gas.

Fixed ceilings: 500000 units/payment; 2000000/task gross spend; 5000000/executor/UTC day; 10000000/wallet/UTC day; minimum liquid floor 3000000; post-deposit allocation ≤2000 basis points; ≤20 financial actions/permit, browser ≤3 payments. Owner can tighten. Gross PAY/TRANSFER counters never decrease on refunds. Deposits/withdrawals have separate caps. UTC day is `block.timestamp / 86400`. Allocation limit applies when admitting a deposit, not as a perpetual ratio guarantee.

Permit lifetime ≤24h. Browser task ≤10min, 8 workflow steps, 3 paid attempts. Action and invoice lifetime ≤60s. Policy chain snapshot ≤15s old; risk signal NORMAL and ≤60s old before deposit. Scheduled transfer uses exact owner-approved period/window; missed periods skip. No arbitrary calls/approvals, swaps, bridges, credit, production yield, x402 interoperability, iOS, mobile MPC or open marketplace in this release.

### S3. Signed financial objects

Person 1 creates `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest}.ts`, Zod validators, generated ABI exports and `fixtures/*.json`. These are imported by every JS component. Solidity and native signing are checked against the same JSON golden vectors. EIP-712 field **order and types** are fixed:

```text
domain MandateWallet / version "4" / chainId 84532 / verifyingContract wallet
Permit(bytes32 taskId,address executor,uint8 kind,bytes32 runbookHash,
 bytes32 conditionsHash,bytes32 recipientsHash,bytes32 scheduleHash,
 uint64 issuedAt,uint64 startsAt,uint64 expiresAt,uint64 epoch,uint256 nonce,
 uint32 maxActions,uint32 maxPayments,uint256 maxPayment,uint256 spendCap,
 uint256 liquidFloor,uint256 depositCap,uint256 withdrawCap)
Action(bytes32 permitId,bytes32 requestId,uint8 operation,address target,
 uint256 amount,uint256 minOutput,bytes32 invoiceId,bytes32 inputHash,
 uint32 period,uint64 issuedAt,uint64 deadline)
Schedule(address recipient,uint256 amount,uint64 start,uint32 interval,
 uint32 window,uint32 periods)
Admin(uint8 command,bytes32 permitId,uint256 nonce,uint64 issuedAt,uint64 deadline)

kind: BROWSER=0 LIQUIDITY=1 SCHEDULE=2
operation: PAY=0 TRANSFER=1 DEPOSIT=2 WITHDRAW=3 CLOSE=4
command: PAUSE=0 UNPAUSE=1 REVOKE=2 RECOVER=3 RECOVER_LIQUID=4

domain MandateInvoice / "1" / 84532 / wallet
Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address recipient,
 uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)

domain MandateDelivery / "1" / 84532 / wallet
DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,
 bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)

domain MandateLogin / "1" / 84532 / zero address
Login(string origin,bytes32 nonce,uint64 issuedAt,uint64 expiresAt)
```

`permitId = hashStruct(Permit)`; signatures sign EIP-712 domain-separated digests. Shared helper `hashPermit(permit)` returns this struct hash/ID; `buildTypedData('Permit',permit,domain)` builds the signing payload; `hashAction(action,domain)` returns the domain-separated Action digest. Helpers never infer domain from untrusted payload. `recipientsHash = keccak256(abi.encode(address[]))` on sorted unique ≤4 recipients. `scheduleHash = keccak256(abi.encode(Schedule))`; non-schedule uses zero hash and zeroed Schedule. Other hashes are SHA-256 over RFC8785 canonical UTF-8 JSON, represented as bytes32. `runbookHash` hashes `{schemaVersion:4,runbookId,kind,version,entryArtifactHash,inputSchemaHash,outputSchemaHash,validatorArtifactHash,dependencyLockHash}`. Hash built artifacts/lockfile, omit own hash/timestamps. Installed runbook must match owner-signed hash. Contract does not attest worker execution.

`conditionsHash` commits exact owner-reviewed Conditions:

```ts
type Conditions = {
 schemaVersion: 4; runbookId: 'browser-check'|'liquidity-keeper'|'scheduled-pay';
 browser: null | {targetId:string; checks:('pageLoad'|'title'|'formSubmit')[];
   providerIds:('a'|'b')[]; maxPaidAttempts:number; maxSteps:number;
   taskDeadline:string; resultMaxAgeSeconds:300};
 liquidity: null | {vault:Address; command:'deposit'|'redeem'; amountUnits:string;
   maxSlippageBps:50; riskSourceId:'demo-risk-v1'; signalMaxAgeSeconds:60};
 schedule: null | Schedule;
}; // exactly one non-null branch; schema rejects unknown fields
```

Scope envelope is `{conditions,runbookManifest,providerBindings}` with `providerBindings:[{providerId,recipient}]` from trusted deployment manifest. Conditions provider IDs resolve only through that manifest; recipients must equal sorted permitted provider recipients. Goals are display metadata; executable interpretation is committed in Conditions and confirmed natively. Scope bytes must recompute both signed hashes. Deposit/redeem amount is explicit; no natural-language financial parameter reaches the signer unchecked.

Wallet ABI: `activatePermit(Permit,address[],Schedule,bytes ownerSignature)`; `execute(Action,bytes executorSignature,Invoice,bytes providerSignature)`; `applyAdmin(Admin,bytes ownerSignature)`; `getPermit(bytes32)`; `getBudget(address executor)`; `usedRequest(bytes32)`; `permitNonce()`; `adminNonce()`; `authorityEpoch()`; `paused()`; `owner()/token()/vault()`; factory `createWallet(address owner)`/`walletForOwner(address)`. Anyone can relay fixed-configuration wallet creation; the nonzero provided address is immutable owner, never the relayer. Non-PAY uses zeroed Invoice and empty provider signature. `getPermit` returns `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; counters uint256 except counts uint32, flags bool. `getBudget` returns uint256 `{day,walletGross,executorGross,liquidAssets,vaultShares,vaultAssets}`. ABI field names/bindings are generated by Person1; consumers never guess positional tuples. Required wallet events:

```text
ActionExecuted(bytes32 indexed permitId,bytes32 indexed requestId,uint8 operation,
 address target,uint256 assets,uint256 shares,bytes32 invoiceId,
 bytes32 inputHash,bytes32 actionDigest)
PermitActivated(bytes32 indexed permitId,bytes32 indexed taskId,address executor,uint64 epoch)
PermitRevoked(bytes32 indexed permitId)
WalletPaused(bool paused,uint64 epoch)
PermitClosed(bytes32 indexed permitId)
Recovered(uint256 liquidAssets,uint256 redeemedShares,uint256 redeemedAssets,bool vaultFailed)
```

Financial execution checks current epoch/time, executor signature, kind, recipient, counts, gross caps/floor, request/invoice uniqueness and invoice binding. BROWSER only PAY/CLOSE; LIQUIDITY only DEPOSIT/WITHDRAW/CLOSE; SCHEDULE only TRANSFER/CLOSE. WITHDRAW amount is shares and returns assets only to wallet; positive minOutput required for vault operations. Unused fields must be zero. CLOSE is signed, zero-value and exempt from financial quotas. PAUSE and either RECOVER pause/increment epoch; UNPAUSE never revives prior permits. REVOKE works on pending IDs. Recovery only to immutable owner, works while paused, separate admin nonce/lifetime ≤30min. `RECOVER_LIQUID` makes no vault call. No owner-admin operation requires MPC or backend consent.

### S4. Public API and mobile bridge

All endpoints under `/v1`. Mutations except challenge/verify require UUID `Idempotency-Key`; same tenant+route+key+body returns original response, changed body returns409. Challenge uses no bearer; normal owner routes use 15min JWT. Agent tokens have explicit `read`, `prepare`, `run`, `evidence` scopes, wallet/task restriction, expiry/revocation; no owner/admin authority. Evidence scope is separate because artifacts can be private.

| Route | Body / response |
| --- | --- |
| POST `/auth/challenge` | `{ownerAddress}` → `{challengeId,typedData}` |
| POST `/auth/verify` | `{challengeId,signature}` → `{accessToken,expiresAt,ownerAddress}` |
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

`terms` is exactly `{startsAt,expiresAt,maxActions,maxPayments,maxPayment,spendCap,liquidFloor,depositCap,withdrawCap,recipients,schedule}` using Permit/Schedule types. All fields required; kind-inapplicable fields zero. Server derives issuedAt/executor/kind/task ID/hashes/nonce/epoch from verified state and checks recipients/Schedule equal Conditions and trusted provider bindings. Unknown/redundant mismatched fields fail. At most one outstanding Permit draft per wallet; refreshed terms require new native confirmation. Admin nonce/lane is separate.

```ts
type OwnerApproval = {draftId:string; typedData:TypedPermit; scope:Scope;
 recipients:Address[]; schedule:Schedule; digest:Hex32};
type WalletView = {walletId:string; owner:Address; address:Address|null;
 chainId:84532; provisioningState:'DEPLOYING'|'KEYGEN'|'READY'|'FAILED';
 executorAddress:Address|null; paused:boolean; epoch:string;
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

Native methods: `createOwner()/restoreOwner()/getOwner() → {address,backupConfirmed}`; `signLogin(typedJson) → {address,signature}`; `signPermit(typedJson,scopeJson,recipients,schedule) → {address,signature,digest}`; `signAdmin(typedJson) → {address,signature,digest}`; `showRecoveryWords() → {completed}`. Seed words never cross the RN bridge. Native module recomputes scope hashes, validates permitted schemas/domains/trusted deployment and shows actual signed terms before biometric/device-credential unlock. No raw-sign method.

Errors: `{code,message,actionId:string|null,evidenceId:string|null,retryable:boolean}`. 401 auth,403 scope/tenant,409 idempotency/state conflict,422 invalid policy/input,503 unavailable dependency. Error codes include AUTH_SCOPE, PERMIT_INACTIVE, SCOPE_MISMATCH, RUNBOOK_VERSION, RECIPIENT_DENIED, PAYMENT_CAP, DAILY_CAP, LIQUID_FLOOR, RESERVATION_CONFLICT, QUOTE_EXPIRED, DUPLICATE_REQUEST, SCHEDULE_WINDOW, STALE_SIGNAL, MPC_UNAVAILABLE, SIGNING_UNKNOWN, SIMULATION_REVERT, SETTLEMENT_UNKNOWN, DELIVERY_INVALID, EVIDENCE_UNAVAILABLE. Never automatically retry a new financial request after UNKNOWN.

### S5. Worker ↔ runbook boundary

Person 4 exports `advance(snapshot,deps):Promise<RunbookDecision>` from `@mandate/runbooks`; Person 2 invokes it under a durable task lease. No provider or agent calls the signer directly.

```ts
type RunbookDecision = (
 | {type:'PROPOSE'; decisionKey:string; intent:ActionIntent; evidence:JsonObject[]}
 | {type:'WAIT'; dueAt:string; reason:string}
 | {type:'COMPLETE'; result:JsonObject; evidence:JsonObject[]}
 | {type:'NEEDS_OWNER'|'FAILED'; reason:string; evidence:JsonObject[]}
 ) & {nextState:RunbookState};
type ActionIntent = {operation:0|1|2|3; target:Address; amount:string; minOutput:string;
 invoice:Invoice|null; providerSignature:Hex|null; inputHash:Hex32; period:number};
```

Snapshot is `{taskId,chainTaskId,walletId,walletAddress,permitId,conditions,scope,permit,now,chainBlock,wallet,actions,observations,runbookState}` using shared schema types; `now`/times are seconds strings, `actions` includes stored decisionKey, Action, state, txHash and invoice, observations include signed provider output and risk signals. `RunbookState={schemaVersion:4,step:number,attempt:number,retrievals:number,selectedProvider:null|'a'|'b',quotes:QuoteEnvelope[],delivery:DeliveryEnvelope|null,missedPeriods:number[]}`; initialize zero counters/null/empty arrays. `deps` offers `quote(providerId,input)→QuoteEnvelope`, `retrieve(providerId,invoiceId,requestId,paymentTxHash)→{state:'PENDING'}|DeliveryEnvelope`, `readVault()→{blockNumber,liquidAssets,vaultShares,vaultAssets,previewDepositShares,previewRedeemAssets,maxRedeemShares}`, `readRisk()→{sourceId:'demo-risk-v1',state:'NORMAL'|'WARNING',observedAt,sequence}` only; all uint/time values are decimal strings. Vault previews use the amount in immutable Conditions. QuoteEnvelope/DeliveryEnvelope are the exact S6 response bodies, JSON types/validators exported from shared schema. COMPLETE records useful outcome; Person2 separately closes authority. Person4 cannot set signature, epoch, requestId or raw calldata.

Unique `(taskId,decisionKey)` makes repeated advance calls return the same logical action. Person 2 creates random requestId once, chooses issuedAt/deadline, validates input against Permit, stores immutable Action/invoice, reserves atomically and initiates signing. Old expired unbroadcast signatures can be replaced only after prior usability/history is reconciled; never simply release the reservation because a timer elapsed. runbookState update, observations, action insertion and job scheduling commit transactionally. External quote/retrieval calls may repeat; payment cannot repeat.

Outcome states: DRAFT/AWAITING_OWNER/READY/RUNNING/COMPLETED/DELIVERY_FAILED/NEEDS_OWNER/CANCELLED. Authority: PENDING/ACTIVE/CLOSING/CLOSED/REVOKED/EXPIRED/INVALIDATED. Action: PROPOSED/RESERVED/SIGNING/SIGNED/SUBMITTED/INCLUDED/FINALIZED/DENIED/REVERTED/UNKNOWN. Chain INCLUDED means three canonical confirmations; FINALIZED requires RPC finalized head. Delivery may proceed at INCLUDED; never label it finalized. Reorg returns action to unresolved and blocks dependent new spending.

### S6. Provider and inspection contracts

Trusted manifest maps target IDs `checkout-healthy`/`checkout-broken` to exact HTTPS fixture URLs; browser workers reject arbitrary URLs, scripts, selectors, redirects and private-network egress. Provider request `POST /providers/:id/check` body `{taskId:Hex32,wallet:Address,targetId,checks}` returns402 `{providerId,invoice,providerSignature}`. InputHash commits canonical `{taskId,wallet,targetId,checks}` with fixed check ordering pageLoad,title,formSubmit. Two providers a/b use prices200000/350000 units, distinct signer=recipient EOAs. Provider a supports pageLoad/title; b supports pageLoad/title/formSubmit. A+B fallback demonstration requests pageLoad/title; capability-filter variant requests formSubmit and selects b. No charge at quote generation.

Authenticated `POST /providers/:id/result {invoiceId,requestId,paymentTxHash}` returns202 `{state:'PENDING'}` or200 `{result,receipt,providerSignature,artifacts}`. It verifies canonical success + three confirmations + matching ActionExecuted and exact DemoUSD Transfer before running Playwright once. Unique invoice lock/cache; repeated retrieval returns original output. An invalid payment never triggers paid work. BrowserResult is `{schemaVersion:4,targetId,inputHash,checkedAt:string,checks:{pageLoad?:boolean,title?:{actual:string,expected:string,pass:boolean},formSubmit?:boolean},screenshotHash:Hex32,logHash:Hex32}`; exactly requested checks present; title expectation comes from trusted target fixture. Hash result canonical JSON; screenshot/log hashes cover actual bytes. Artifacts return `{artifactId,mediaType,sha256,base64}` through authenticated channel with a 10MiB/result bound. Provider signs DeliveryReceipt under S3. Negative form check is valid delivered inspection. First completed output must be ≤300s old, ≤5s future and consistent with receipt; retries never re-date old output.

Evidence event: `{schemaVersion:4,eventId,taskId:UUID,chainTaskId,wallet,sequence:number,recordedAt:string,type,requestId:Hex32|null,permitId:Hex32|null,payload,prevHash,eventHash}`. SHA-256 RFC8785 of whole event except eventHash, first prevHash zero32; append under task lock. Never overwrite corrections. Checkpoint `{schemaVersion:4,chainId:84532,wallet,taskId:Hex32,sequence,headHash}` is RFC8785 bytes signed Ed25519, digest SHA-256 anchored via `EvidenceAnchor.anchor(bytes32 taskId,bytes32 checkpointDigest,uint64 sequence)` with event `Anchored(bytes32 indexed taskId,bytes32 checkpointDigest,uint64 sequence,address publisher)`. Anchor is not an event in its own committed checkpoint; append it to a later checkpoint if needed.

Export ZIP: `manifest.json`, `events.jsonl`, `checkpoint.json`, `checkpoint.sig`, `authority.json`, `transactions.json`, `artifact-index.json`, `artifacts/`. Manifest lists schema, chain/wallet/task, inspection range, public keys, retained hashes and anchor tx; verifier trusts keys/addresses from a separately supplied deployment manifest, never export alone. Store artifacts AES256GCM unique IV, AAD taskId/artifactId; storage commitment SHA256(salt32 || plaintext), with salt+plaintext disclosed only in authorized export. Retain original unsalted provider content hashes too. Retention30days; absent retained bytes means UNVERIFIABLE. Export contains no seeds, shares, service tokens or hidden model reasoning.

`mandate-verify --bundle <zip> --trusted <manifest.json> --rpc <url> --out <report.json>` reads only files/RPC and returns `{schemaVersion:4,taskId,inspectionHead,findings:Finding[],unmatchedOutflows:[],limitations:[]}`. Exit0 only when all required findings PASS; exit1 any FAIL; exit2 no FAIL but pending/unverifiable; exit3 malformed input/tool error. Scan wallet transactions/logs from deployment to inspection head for unexplained supported-asset outflows. A fixture vault's Transfer events are distinguished from wallet PAY. Audit assertions without independent support remain UNVERIFIABLE even if hash integrity passes.

### S7. Delivery gates and honest evidence

| Gate, Dhaka time | Cross-owner result |
| --- | --- |
| G0, Oct17 15:30 | Workspace, ABI/schema fixtures, route examples, credentials, hosts, phone and test ETH agreed |
| G1, Oct17 18:00 | Native owner signature + restore; MPCium two-node signature recovered correctly; mandatory authorizer rejection; contract local payment |
| G2, Oct18 02:00 | One phone-approved real Base Sepolia purchase, actual browser output, durable export, initial independent report |
| G3, Oct18 10:00 | All three runbooks, fallback, reservations/restart, pause/recovery, SDK/MCP, full inspector |
| G4, Oct18 15:00 | Adversarial/evaluation results and fixes, rebuild/install/recovery evidence |
| G5, Oct18 18:00 | Tagged APK/source, manifest, deck, ≤5min demo, submission package frozen |
| Submission, Oct20 18:00 target | Upload and verify receipt; official cutoff Oct20 21:59 Dhaka /23:59 Beijing |

These are aggressive targets from Oct17, not estimates backed by an existing implementation. Record actual pass times; a failed gate remains incomplete. Keep a single scope and fix the blocker. No hidden ordinary-key MPC fallback, fabricated test results or guarantee of winning. Tests below are instructions for implementers; this documentation task does not run implementation tests.

Every owner contributes to Q01 native recovery, Q02 MPC isolation, Q03 scope, Q04 contention, Q05 crash durability, Q06 useful purchase, Q07 paid failure/fallback, Q08 assets, Q09 schedule, Q10 confirmed stop, Q11 tampered evidence, Q12 tenant/input isolation, Q13 outage/restore/API-offline recovery, Q14 closure/finality. Required evaluation: two target fixtures × three purchase variants × three repeats=18 runs: both providers, capability-filtered provider B, and budget-cap rejection. Report valid denials separately from useful task completion. Add two paid-failure, two contention/restart, one asset and one schedule run; record all outcomes. Direct contract/invariant checks are additional, not counted as user runs. Competition requires technical docs, source/README/deploy/test cases, security self-assessment, actual on-chain hashes, English presentation≤10min; optional demo≤5min. Scoring40% completion/30% security-compliance/30% innovation-interaction, possible0–5 on-chain bonus. Public testnet acceptance was confirmed by the user with organizer.
