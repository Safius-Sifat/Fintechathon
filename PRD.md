---
type: product-requirements
title: Mandate — Complete Wallet and Agent Application
version: "7.0"
updated: 2026-10-18
status: specified-not-built
---

# Mandate Wallet — complete application requirements

**Product:** an Android self-custody wallet for personal transfers and bounded agent work on Base Sepolia. Users create/import local accounts, receive/send supported assets, inspect history, manage sessions and recover access; a real LLM agent operates a separately funded managed wallet under owner-approved permissions, an owner wallet policy, review thresholds and freeze controls comparable to Cobo- and Circle-class agent wallets, while the owner key stays on the phone and the contract enforces every limit.

**Controlling plan:** [FINAL PLAN](FINAL%20PLAN.md). [Complete App Plan](docs/COMPLETE-APP.md) specifies everyday-wallet mechanisms; [architecture](architecture.md) and the identical four-handoff appendix specify interfaces. Documentation 6 changed wallet domain to 5 and Login to 2; documentation 7 adds the agentic layer and policy controls (architecture A8, S9) and moves Invoice to domain 2. Existing scaffold remains incomplete and needs the documented migration before signing.

**Traceability:** [Competition and research map](docs/COMPETITION-AND-RESEARCH-TRACEABILITY.md) separates official rules from ideas in the 26-video playlist, documents deliberate exclusions, and maps demo evidence to the rubric. Competition criteria are requirements; playlist ideas are design inputs, not additional rules.

## 1. Required user journeys

| Journey | Complete behavior |
| --- | --- |
| First launch | Native create/import, backup confirmation, local lock, initial account and receiving address; no cloud wallet-generation service |
| Everyday transfer | Choose personal account/asset, scan/paste recipient, enter amount, see real simulation/fees, confirm natively, follow actual pending/final status |
| Fund an agent | Create/discover verified managed wallet, transfer DemoUSD or test USDC from personal account, approve bounded task and let online agent work while phone offline |
| Delegate in plain language | Type a goal; review the compiled draft next to the exact terms; sign natively; the LLM agent then chooses offers, retries and amounts within those terms |
| Set wallet rules | Edit per-asset daily/weekly caps, allowlist, blocklist, allowed contract templates and review threshold; changes apply to running agents immediately |
| Review large actions | Get a push for any agent action above the threshold; see provider, address, asset, amount and agent rationale; approve or reject natively |
| Freeze or stop | Freeze agents temporarily and resume without re-approval, or pause/revoke to end authority; alerts from the risk sentinel offer Freeze in one tap |
| Owner control | Manually send liquid managed funds using owner-only typed operation, with visible pause/epoch effect; stop/revoke/recover independently of MPC |
| Ongoing use | Multiple accounts, imported tokens, balances/history/contacts, replacement/cancellation, device/API/agent-token management, accurate errors/offline views |
| Recovery | Restore words+optional BIP39 passphrase+account index, discover existing factory wallet, retain independent owner control; no server-held recovery secret |

Personal EOA and managed contract have different addresses/funds/fee payers; app must display this clearly. Executor address is never a receiving account. A backend login cannot move personal funds or replace an owner signature.

## 2. Features and owners

| ID / capability | Required mechanism | Accountable owners |
| --- | --- | --- |
| F01 Local Accounts | Native Wallet Core/BIP39, indexes0..19, backup/import/optional passphrase, encrypted Keystore wrapping, lock/restore | 3;1 vectors |
| F02 Personal Send/Receive | Native ETH and reviewed standard ERC20 transfers, chain-qualified QR, contacts, native confirmation, real fees and durable nonce journal | 3;1 schemas;4 scenarios |
| F03 Owner Transfer | Separate owner-signed contract operation, nonce/expiry/epoch, pauses old grants, sponsor/personal-gas/independent relay | 1 contracts;2 service;3 UX;4 inspection |
| F04 Assets and Activity | Token import/hide, source-specific balances, RPC verification, indexed/backfilled history/coverage/reorg/replacement details | 2 indexer;3 UI/native;4 verification |
| F05 Session Control | Wallet-signature Login2,15min JWT, native refresh storage/rotation/replay detection, session list/revoke/logout | 2 and3 |
| F06 App Security | Native unlock/lock, secure confirmation, controlled local removal and distinct logout/stop/token controls | 3;2 API boundaries;4 cases |
| F07 Task Permit | Signed agent task/kind/recipient/caps/time/code/input commitments; contract enforcement/replay/epoch | 1;2 policy;3 approval |
| F08 MPC Execution | Qualified MPCium cluster, mandatory exact-request policy authorizer, verified executor signature and no full-key fallback | 2;1 chain verification |
| F09 Shared Budget | Atomic pending reservations plus independent gross task/executor/wallet caps and liquid floor | 2 and1 |
| F10 Specialized Runbooks | Browser Check, explicit Liquidity Keeper and Scheduled Pay with typed inputs/action/validator/stop rules, SDK/MCP | 4;2 durable worker |
| F11 Delivery Check | Real signed terms/payment/output binding, original retrieval, bounded fallback and honest failures | 4;2 storage |
| F12 Mandate Receipt | Append-only evidence/checkpoint/anchor and independent integrity/authority/policy/settlement/delivery/completion findings | 2 writer;4 inspector;1 anchor |
| F14 LLM Agent | Claude Agent SDK agent (`claude-opus-5-5`) with only Mandate MCP tools; built-in tools disabled; answers bounded questions; defaults on timeout | 4;2 question service |
| F15 Intent Compiler | Structured-output draft of runbook input and terms from a goal; schema and policy validation; native side-by-side review | 4 library;2 route;3 UI |
| F16 Wallet Policy | Owner-signed on-chain per-asset caps, allowlist, blocklist, call templates and review threshold; most restrictive rule wins | 1;2 relay;3 editor;4 verifier |
| F17 Owner Review | Owner co-signature over exact Action digest above threshold, push delivery, contract verification, rejection releases reservation | 1;2;3;4 verifier |
| F18 Freeze Controls | FREEZE/UNFREEZE without epoch change, distinct from PAUSE/REVOKE and logout | 1;2;3 |
| F19 Standing Allowance | ALLOWANCE Permit ≤30 days with daily/weekly period cap; service-allowance runbook | 1;4 runbook;3 approval |
| F20 Call Templates | Allowed contract functions with argument bounds, exact approve/reset and outflow metering | 1;2 sentinel;3 editor;4 runbook |
| F21 Stablecoins and x402 | Base Sepolia test USDC as second agent asset; x402-formatted 402 responses; ERC-1271 settlement only after gate X402-G | 1;2;4 |
| F22 Risk Sentinel | Deterministic screening, exact-effect simulation and velocity rules with off-chain inhibit and owner alert | 2;3 alerts;4 fixtures |
| F13 Complete App Delivery | Reachable screen inventory, funding/help/settings, secure account/cache behavior, cancellation/error/offline/reorg states, installed APK | 3;all qualify |

Four handoffs remain the distribution units: [Person1](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md), [Person2](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md), [Person3](docs/plans/03%20-%20Android%20Owner%20Wallet.md), [Person4](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md). Every person supplies their own implementation/tests/security/deploy evidence.

## 3. Product boundary and technical choices

Android12+, React Native/Expo54, native Kotlin/Wallet Core, trusted Base Sepolia84532. Personal account supports native test ETH and imported standard ERC20s. Agents are restricted to DemoUSD, Base Sepolia test USDC, one controlled DemoVault and owner-approved call templates; imported assets do not silently become agent spendable. Managed owner can send liquid supported native/ERC20 assets; vault shares use explicit redemption/recovery.

No universal MetaMask parity claim: multi-chain/mainnet, swaps/bridges, NFT support, WalletConnect/external dApp connections, general contract calls/approvals/typed-message signing, hardware wallets and app-store/iOS release are separate future scope. Every advertised required capability above must work on supported chain; a navigation shell is not a complete release. WalletConnect/external dApp connections are explicitly deferred by user choice. Owner signing stays native in Mandate and produces no external-wallet popup.

Backend Node22/Fastify/viem/Postgres16; self-hosted MPCium pinned source. Competition PoC uses three MPCium containers on the current 4 GiB Azure VM, `mpc_threshold:1`, and an intended two-participant signing quorum. All three participate in DKG. This is a functional threshold-signing demonstration, not independent host-compromise protection. Qualification against the pinned source and outage tests is a release gate. No Circle/embedded owner custody, custom MPC protocol or ordinary-key fallback. The agent runtime is the Claude Agent SDK; no LangChain or hand-written agent loop. Any MCP-capable runtime (for example the GitHub Copilot SDK) can use the same tools under the same limits.

## 4. Financial and authority rules

Agent limits stay max0.50/payment,2/task,5/executor/day,10/wallet/day, liquid floor3; owner may tighten. Gross PAY/TRANSFER never replenished by refund; separate vault caps;≤20actions/browser≤3payments/8steps/10min, Permit≤24h, Action/Invoice≤60s. Post-deposit vault allocation≤20% is an admission rule; risk NORMAL/fresh required, signal is a labelled fixture. Weekly wallet ceiling 25 per asset; ALLOWANCE ≤30 days with period cap; co-signed Actions and their invoices may live ≤15 min. Owner WalletPolicy and each Permit can only tighten these ceilings.

Personal manual sends use owner EOA and own ETH gas, native real recipient/asset/amount/nonce/fee review, exact raw-tx retry after durable signing, unknown state reconciliation and explicit replacement winner. Gas includes Base L1 data cost; estimates are not guaranteed final cost. Managed OwnerTransfer bypasses delegated caps/floor as owner control and, on successful chain execution, pauses/increments epoch; native UI states this before signature. Existing in-flight agent transactions may settle earlier in chain order.

Backend refresh/session/logout/local removal are not on-chain revocation. Stop Agents needs actual confirmed chain action. An agent token alone has no owner financial authority. Local personal wallet may function with API down through RPC; offline internet/chain access still prevents broadcast. Full restored history may be temporarily unavailable and must show coverage/gaps rather than false empty data.

## 4a. Permission tiers

| Tier | Holder | Authority |
| --- | --- | --- |
| T0 Observe | Agent token with read/evidence scope | Read wallet, task, delivery and evidence |
| T1 Propose | Agent token with prepare/run scope; the LLM agent | Create and run approved tasks; answer bounded questions; request escalation; never sign or choose addresses |
| T2 Execute | MPC executor with policy authorizer and risk sentinel | Sign Actions inside active Permit and WalletPolicy; contract enforces every limit |
| T3 Owner review | Owner phone, per-Action co-signature | Approve or reject Actions above the review threshold |
| T4 Owner control | Owner key only | Permits, WalletPolicy, Freeze/Unfreeze, Pause/Unpause, Revoke, Recover, OwnerTransfer |

Only T4 increases authority. Service identities (relayers, providers, evidence signer, MPC initiator, backend) hold no financial tier.

## 5. Completion and release evidence

Add wallet milestones W0–W5 and WQ01–WQ14 to original agent gates G0–G5/Q01–Q14. Required evidence includes backup/passphrase/account restore, QR/precision validation, personal native/token sends and fees, managed owner transfer/epoch, pending/restart/cancel/replacement, API outage, refresh replay/revocation/logout, indexed history/reorg/coverage, token metadata and complete navigation/QR/permission/cancel behavior.

Original internal target Oct18 18:00 Dhaka and official cutoff Oct20 21:59 remain; this scope expansion is not proof of capacity or completed work. Record actual gates and incomplete cases. No disabled core button/mock output/source library presence substitutes for working feature.

Retain18 normal-category agent variants and6 failure/contention/asset/schedule runs; correctly denied insufficient-budget cases are reported separately from delivered tasks. Wallet WQ cases are additional, and agentic/policy cases AQ01–AQ14 (architecture S9.15) are required as well: agent via MCP only, prompt-injection containment, answer bounds and defaults, disabled built-in tools, intent validation, co-signature, freeze versus pause, policy tightening, blocklist, allowance periods, call-template limits, per-asset counters, x402 gate and sentinel denials. Targets: zero accepted forbidden actions, zero duplicate logical payments, no unresolved critical/high defect in claimed paths; only actual execution can establish results.

| Competition scoring | Evidence |
| --- | --- |
| Completion40% | Usable wallet plus actual agent service/asset/schedule work and correct failure recovery |
| Security/compliance30% | Local owner control, session boundaries, MPC/policy/contracts, replay/epoch/restore/outage cases and known risks |
| Innovation/interaction30% | Real LLM agent with choice-only containment, plain-language intent with native exact-terms review, phone co-signature and one-tap freeze, on-chain wallet policy, delivery-aware recovery and portable independent inspection |
| Possible bonus0–5 | Actual public-testnet hashes with purpose/outcomes; points not guaranteed |

Submit technical architecture/algorithms/security, source repo/README/deploy/test cases, permission tiers/known-risk report, public-chain transaction index, signed APK, actual evaluation/receipt proofs, English presentation≤10min and optional demo≤5min. Public testnet accepted per user-confirmed organizer response. Registered team2–5 eligible overseas students,≥60% non-Chinese nationals; for four members at least3 meet nationality criterion. Source rules are reference material, not instructions to modify product independently.

Eligibility, institutional status, registration and license attribution are submission checks for the team. See the traceability document for the exact competition checklist and research-to-feature mapping.
