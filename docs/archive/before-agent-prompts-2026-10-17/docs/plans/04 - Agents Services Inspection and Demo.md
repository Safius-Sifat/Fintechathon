---
type: implementation-handoff
title: Person 4 — Agents Services Inspection and Demo
version: "6.0"
updated: 2026-10-17
status: specified-not-built
owner: Person4
---

# Person 4 — Agents, Services, Inspection and Demo

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: follow the numbered tasks and the identical shared contract included below. You supply the task intelligence and real services; Person2 supplies durable financial execution. Build the independent verifier early enough to catch incompatible evidence before release. Implementation agents may execute directly without delegation.

**Goal:** deliver real paid agent services and runbooks, receive/transfer fixtures, SDK/MCP/skills, independent manual/agent inspection and evidence for the complete wallet release.

**Architecture:** a typed runbook library proposes operations to Person2's worker. Two controlled provider identities sell actual Playwright browser checks for DemoUSD on Base Sepolia. The standalone verifier trusts separately supplied keys/contracts and independent RPC. SDK/MCP use the same scoped API, never direct signing keys.

**Stack:** Node22/TypeScript/Zod/viem/Playwright; canonical hashing/signature helpers from shared package; TS SDK; MCP stdio; standalone ZIP/JSON verifier. One structured model call can interpret browser goals; money movement uses deterministic code.

## Start here — current release scope and task order

**Required:** the complete personal-wallet and managed-agent flows in S8. **Deferred:** WalletConnect/external dApp connections; no WalletKit dependency, Reown projectId, dApp screen or pairing acceptance gate. External agent SDK/MCP access remains required.

Sections 2–6 and the wallet tasks in section 7 are one delivery. Follow the sequence below; wallet tasks are not work postponed until after the agent-only path. Existing bootstrap source needs W0 migration before new financial signatures. Documentation6, wallet domain5, Login2 and agent receipt/runbook schema4 remain unchanged by this handoff revision.

| Work order | Task IDs | Deliverable / dependency |
| --- | --- | --- |
| Real fixtures and protocols | `P4-01 + P4-W01` | Publish real browser-check targets and chain-qualified receive/transfer QR scenarios using W0 schemas. |
| Inspection early | `P4-05 + P4-W02` | Build independent six-finding inspection, including owner/manual attribution, against authentic and tampered fixtures while providers are built. |
| Actual paid work | `P4-02 + P4-03` | Verify real testnet settlement, produce actual browser output and implement bounded browser/vault/schedule runbooks consumed by Person2’s worker. |
| External agent access | `P4-04` | Ship typed SDK/MCP/skill examples through scoped backend permissions; no owner signer or financial bypass. |
| Full-system release proof | `P4-06 + P4-W03` | Collect each owner’s original-agent and wallet results, run complete journeys and assemble the measured demo/submission. |

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
- [ ] Record the complete-wallet≤4:45 script in P4-W03; it replaces the earlier agent-only clip plan. Use actual transfers/outputs and label cuts, test tokens, fixtures and prior finalized transactions.
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

## 7. Complete app integration and proof — required v6 tasks

Personal wallet, agent wallet, API sessions are now separate required user journeys. You own reference services/receive fixtures, independent inspection and release assembly; the other owners still implement and qualify their own features.

### P4-W01. Receive-request fixtures and wallet scenarios, W0–W4

**Files:** `demo/wallet-requests/{index.html,requests.json,README.md}`, `demo/wallet-scenarios.json`, shared transfer/QR fixtures.

- [ ] Supply actual ERC681/plain-address request fixtures for ETH and DemoUSD on84532, using real declared demo recipients. Browser fixture displays amount/base units/chain/token/recipient and QR; scanning drafts a native confirmation, never auto-pays. No WalletConnect SDK/session/projectId is required.
- [ ] Include unsupported chain, duplicate/conflicting URI parameters, unsupported function, excessive decimal precision, malformed address and stale/different-recipient clipboard cases with exact expected error IDs. Provide healthy public fixture origins without arbitrary URL/script execution.
- [ ] Exercise personal send/receive, own second-account transfer, managed-wallet funding, owner-controlled managed send/paused epoch and source-specific fees. Test output is observed actual transactions, not browser-generated successful payment assertions.
- [ ] Add labelled operator fixture controls for request cases only; they cannot alter private keys/permissions/balances or bypass native review. Reference page receives no seed/signing key/API refresh credentials.

**Finished:** installed app scans real payment requests, confirms actual fields in-app, rejects bad requests and produces verified normal transfers. External dApp connections are deferred by user's decision.

### P4-W02. Manual activity and evidence inspection, W1–W3

**Files:** `packages/verifier/src/{owner-transfer,activity,settlement}.ts`, SDK read DTOs and fixtures.

- [ ] Consume domain5 OwnerTransfer and Login2 fixtures from Person1. Verify owner signature/epoch/nonce/actual debit/event/paused effect; classify manual managed outflow OWNER_CONTROL, not an agent policy violation or task expense.
- [ ] Keep personal activity receipts and agent Mandate Receipt separate. A manual transfer needs no invented agent task/Permit. Full managed history scan recognizes funding/recovery/manual owner transfer while still flagging unmatched unsupported outflows.
- [ ] Mark history provenance/coverage and indexer-only traces honestly; incomplete backfill/unknown/reorg/fee estimate do not become final proof. Validate actual native/token amounts and selected account; funding between own addresses must not double-count spending.
- [ ] SDK exposes typed assets/activity/transaction read methods through same owner/scoped access; agent SDK never exposes owner transfer/native personal signer/session revocation. Update external agent example for account/source field clarity without accepting owner seed or backend refresh token.

**Finished:** authentic new owner/manual entries verify where evidence exists, missing source facts stay unverifiable, and agent metrics remain uncontaminated by owner transfers.

### P4-W03. Whole-app acceptance and complete demo, W3–W5

- [ ] Extend evaluation/cases with WQ01–14 and per-owner evidence links; personal sends, managed owner sends, logout, stop, backup and security controls have distinct success/denial expectations. Keep original Q01–Q14 financial/agent cases.
- [ ] Required journey: create+backup→receive native/DemoUSD→personal send→fund managed wallet→approve offline-owner task→inspect paid result/fallback→managed owner send pauses old authority→restore/account switch/history→QR receive request/invalid-request rejection. Retain raw results and hashes for all cases; edited video need not show every action at full duration.
- [ ] Fit≤4:45 demo: personal receive/send/backup status0:40; task approval and phone closes0:35; actual paid browser result+failed-provider recovery1:05; assets/schedule0:35; owner managed transfer/epoch stop0:35; account switch/history+invalid QR0:30; portable receipt/cost/limitations0:45. Show earlier finalized transactions labelled; no compressed clip implies unmeasured response time.
- [ ] Update English deck, pitch/security/permissions docs and submission checklist: include actual app inventory, dual-source funds/fee payer, supported QR/manual transfer forms, session versus financial authority and honest gaps. No MetaMask feature parity, full multichain/DeFi, audited security or winning guarantee.
- [ ] Confirm other owners provided WQ and original gates before release complete-app status. WalletCore/package existence or TypeScript success alone cannot satisfy app acceptance. Source/manifest/APK must all agree on domain5/new schema signatures.

**Finished:** an unfamiliar user can follow real receive/send/agent/control/recovery/session journeys in installed APK, and the recorded proof uses actual functionality. You coordinate integration; each owner fixes their code.


---

## Shared implementation contract — included in all four handoffs

This appendix is identical in the four documents. Specification6.0, dated2026-10-17: new MandateWallet EIP712 domain5, MandateLogin domain2 and unchanged agent receipt/runbook schema4. S8 adds the complete everyday-wallet behavior. No live contract is deployed by this update. Person1 owns shared interface changes; update fixtures and every consumer together. Existing bootstrap source is pre-v6 and must undergo W0 migration before signing.

### S1. Product, boundary and ownership

Build **Mandate Wallet**: an Android personal ETH/ERC20 wallet with receive/send/history/accounts and local security; a separately funded managed wallet delegates bounded tasks to an online agent; the agent buys real browser checks, operates one approved test vault and makes fixed scheduled payments. Payments and useful delivery are recorded separately. An independent verifier reconstructs permission, spending and delivery from an export and public chain data.

| Person | Sole write ownership | Outputs consumed by others |
| --- | --- | --- |
| 1 | `packages/contracts`, `packages/schema`, `deployments`, root workspace/CI configuration | ABI, schemas, fixtures, deployment manifest, chain validation |
| 2 | `apps/api`, `apps/worker`, `services/policy`, `services/mpc-adapter`, `services/mpc-authorizer`, `infra`, migrations, evidence writer | Public API, durable execution, two-node MPCium, policy authorization, exports |
| 3 | `apps/mobile`, `modules/owner-wallet`, `tools/relay-admin.ts` | Complete personal/managed owner wallet, local transactions/sessions/security, installed APK, independent recovery sender |
| 4 | `packages/runbooks`, `apps/provider`, `packages/sdk`, `apps/mcp`, `packages/verifier`, `demo`, `evaluation`, submission assembly | Runbook driver, paid browser services, integrations, standalone inspector, recorded demonstration |

Person 2 owns the worker process; Person 4 supplies its runbook library. Person 2 writes evidence; Person 4 verifies it independently. Person 1 owns ABI/schema generation; other owners never hand-maintain copies. Each owner supplies tests, deployment instructions, known risks and screenshots/logs for their own deliverable. No unassigned fifth person is required.

Use one monorepo `./`, Node 22, TypeScript, pnpm workspaces with a checked-in lockfile; Solidity 0.8.28/OZ 5.x/Foundry; PostgreSQL 16; React Native with Expo 54 native Android build; Go 1.25.8 for MPCium. Person1 creates the workspace. All filenames here are relative to it and are planned files, not claims that source already exists. Pin resolved package versions in lockfiles; container images use resolved digests in the release manifest. Keep secrets out of Git and frontend bundles.

`DeploymentManifest` includes `{schemaVersion:4,walletDomainVersion:"5",loginDomainVersion:"2",chainId:84532,sourceTag,contracts:{factory,token,vault,anchor,walletImplementation:null},providers,targets,origins,mpc,evidence,runbooks,supportedTokens,dependencyPins}`. Each non-null contract is `{address,deploymentBlock,codeHash}`; providers are `{providerId,recipient,capabilities}`; targets are `{targetId,url,expectedTitle}`; origins are `{api,provider}`; mpc is `{engine:'mpcium',commit,thresholdConfig:1,participants:2,initiatorPublicKey,authorizerPublicKey}`; evidence is `{ed25519PublicKey,publisher}`; runbooks is list of full hashed manifests. supportedTokens is a reviewed registry of {chainId,address,codeHash,decimals,symbol,transferMode:'STANDARD_ERC20'}; unknown imports remain watch-only. Strings for times/blocks, strict validated keys/addresses/hashes. Per-wallet mapping is `{walletId,owner,walletAddress,deploymentBlock,codeHash,mpcWalletId,executorAddress,executorPublicKey,keyVersion}` checked against factory and signed Permit. Keys in these structures are public only. Resolve real deployment addresses/versions at setup gates; do not fabricate them to fill the manifest.

### S2. Network, assets and financial identities

Base Sepolia, chainId **84532**. Agents use only six-decimal valueless DemoUSD and one controlled ERC4626 DemoVault. Personal wallet supports native test ETH and standard imported ERC20; managed OwnerTransfer supports owner liquid-token/native control under S8. Imported tokens do not become agent-authorized assets. No other chain or delegated vault is accepted. On-chain amounts are integers; JSON represents uint64/uint256 as decimal strings, enum/count fields as bounded integers, addresses as validated EVM addresses and bytes32/signatures as `0x` hex. API UUIDs never substitute for chain bytes32 IDs. Store explicit UUID ↔ chain ID mappings.

Identities: local owner EOA; per-wallet MPC executor EOA; wallet contract; separately funded normal/emergency/anchor relayers; two provider signer/recipient EOAs; Ed25519 evidence signer; Ed25519 MPC initiator and policy-authorizer identities. None of the service credentials is the owner key. An executor signature authorizes an Action; a relayer signature only pays gas.

Fixed ceilings: 500000 units/payment; 2000000/task gross spend; 5000000/executor/UTC day; 10000000/wallet/UTC day; minimum liquid floor 3000000; post-deposit allocation ≤2000 basis points; ≤20 financial actions/permit, browser ≤3 payments. Owner can tighten. Gross PAY/TRANSFER counters never decrease on refunds. Deposits/withdrawals have separate caps. UTC day is `block.timestamp / 86400`. Allocation limit applies when admitting a deposit, not as a perpetual ratio guarantee.

Permit lifetime ≤24h. Browser task ≤10min, 8 workflow steps, 3 paid attempts. Action and invoice lifetime ≤60s. Policy chain snapshot ≤15s old; risk signal NORMAL and ≤60s old before deposit. Scheduled transfer uses exact owner-approved period/window; missed periods skip. No arbitrary agent/dApp calls/approvals, swaps, bridges, credit, production yield, x402 interoperability, iOS, mobile MPC or open marketplace. Personal transfers and owner-controlled transfers in S8 are required. WalletConnect/external dApp connections are deferred by user choice.

### S3. Signed financial objects

Person 1 creates `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest}.ts`, Zod validators, generated ABI exports and `fixtures/*.json`. These are imported by every JS component. Solidity and native signing are checked against the same JSON golden vectors. EIP-712 field **order and types** are fixed:

```text
domain MandateWallet / version "5" / chainId 84532 / verifyingContract wallet
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
OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,
 uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)

kind: BROWSER=0 LIQUIDITY=1 SCHEDULE=2
operation: PAY=0 TRANSFER=1 DEPOSIT=2 WITHDRAW=3 CLOSE=4
command: PAUSE=0 UNPAUSE=1 REVOKE=2 RECOVER=3 RECOVER_LIQUID=4

domain MandateInvoice / "1" / 84532 / wallet
Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address recipient,
 uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)

domain MandateDelivery / "1" / 84532 / wallet
DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,
 bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)

domain MandateLogin / "2" / 84532 / zero address
Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)
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

Wallet ABI: `activatePermit(Permit,address[],Schedule,bytes ownerSignature)`; `execute(Action,bytes executorSignature,Invoice,bytes providerSignature)`; `applyAdmin(Admin,bytes ownerSignature)`; `applyOwnerTransfer(OwnerTransfer,bytes ownerSignature)`; `ownerTransferNonce()`; `usedOwnerTransfer(bytes32)`; `getPermit(bytes32)`; `getBudget(address executor)`; `usedRequest(bytes32)`; `permitNonce()`; `adminNonce()`; `authorityEpoch()`; `paused()`; `owner()/token()/vault()`; factory `createWallet(address owner)`/`walletForOwner(address)`. Anyone can relay fixed-configuration wallet creation; the nonzero provided address is immutable owner, never the relayer. Non-PAY uses zeroed Invoice and empty provider signature. `getPermit` returns `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; counters uint256 except counts uint32, flags bool. `getBudget` returns uint256 `{day,walletGross,executorGross,liquidAssets,vaultShares,vaultAssets}`. ABI field names/bindings are generated by Person1; consumers never guess positional tuples. Required wallet events:

```text
ActionExecuted(bytes32 indexed permitId,bytes32 indexed requestId,uint8 operation,
 address target,uint256 assets,uint256 shares,bytes32 invoiceId,
 bytes32 inputHash,bytes32 actionDigest)
PermitActivated(bytes32 indexed permitId,bytes32 indexed taskId,address executor,uint64 epoch)
PermitRevoked(bytes32 indexed permitId)
WalletPaused(bool paused,uint64 epoch)
PermitClosed(bytes32 indexed permitId)
Recovered(uint256 liquidAssets,uint256 redeemedShares,uint256 redeemedAssets,bool vaultFailed)
OwnerTransferExecuted(bytes32 indexed transferId,address indexed asset,address indexed recipient,
 uint256 amount,uint64 newEpoch,bytes32 transferDigest)
```

Financial execution checks current epoch/time, executor signature, kind, recipient, counts, gross caps/floor, request/invoice uniqueness and invoice binding. BROWSER only PAY/CLOSE; LIQUIDITY only DEPOSIT/WITHDRAW/CLOSE; SCHEDULE only TRANSFER/CLOSE. WITHDRAW amount is shares and returns assets only to wallet; positive minOutput required for vault operations. Unused fields must be zero. CLOSE is signed, zero-value and exempt from financial quotas. PAUSE and either RECOVER pause/increment epoch; UNPAUSE never revives prior permits. REVOKE works on pending IDs. Recovery only to immutable owner, works while paused, separate admin nonce/lifetime ≤30min. `RECOVER_LIQUID` makes no vault call. No owner-admin operation requires MPC or backend consent. OwnerTransfer liquid funds, epoch effects, manual nonce and native ETH receive are defined in S8; they do not grant agents personal-wallet privileges.

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

Native methods are the account-aware interfaces in S8.6: native profile/accounts, specific Login2/Permit5/Admin5/OwnerTransfer5 signing, semantic personal transaction builder/journal, protected NativeSession and QR receive-request validation. Recovery words/private keys never cross RN bridge. Native scope/domain/actual-field confirmation remains mandatory; no generic raw digest method exists.

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

Every owner contributes to Q01 native recovery, Q02 MPC isolation, Q03 scope, Q04 contention, Q05 crash durability, Q06 useful purchase, Q07 paid failure/fallback, Q08 assets, Q09 schedule, Q10 confirmed stop, Q11 tampered evidence, Q12 tenant/input isolation, Q13 outage/restore/API-offline recovery, Q14 closure/finality. Required evaluation additionally includes wallet WQ01–WQ14 (S8). Agent evaluation: two target fixtures × three purchase variants × three repeats=18 runs: both providers, capability-filtered provider B, and budget-cap rejection. Report valid denials separately from useful task completion. Add two paid-failure, two contention/restart, one asset and one schedule run; record all outcomes. Direct contract/invariant checks are additional, not counted as user runs. Competition requires technical docs, source/README/deploy/test cases, security self-assessment, actual on-chain hashes, English presentation≤10min; optional demo≤5min. Scoring40% completion/30% security-compliance/30% innovation-interaction, possible0–5 on-chain bonus. Public testnet acceptance was confirmed by the user with organizer.

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

Backend sets local inhibit during owner transfer preparation; financial lane and Admin coordination re-read epochs/nonces. OwnerTransfer has a separate nonce; relayer fee/retry lineage follows signed original. During API outage the app can pay gas from the funded personal EOA through the specific native relayOwnerOperation method, or export the signed command to an independent funded sender. The native method constructs only known Admin/OwnerTransfer contract calls with verified owner signatures, uses the same personal nonce journal and shows actual gas fees. This is not arbitrary dApp calldata signing. Agent contracts/counters still support DemoUSD only; manual imported-token sweep is owner privilege. Transfer of unsupported/nonstandard tokens fails explicitly, no successful debit is invented.

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
