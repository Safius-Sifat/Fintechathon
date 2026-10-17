---
type: product-requirements
title: Mandate — Four Person Release Requirements
version: "5.0"
updated: 2026-10-17
status: specified-not-built
---

# Mandate Wallet — product requirements

> Repository bootstrap added 2026-10-17. Read [README](README.md) and [setup](docs/SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

**Product:** an owner-controlled agent wallet for buying digital services, operating explicitly approved funds and making fixed scheduled payments. The owner approves once; online agents execute within contract-enforced limits; payment and useful delivery remain separately inspectable.

**Controlling plan:** [FINAL PLAN](FINAL%20PLAN.md). Four standalone handoffs contain tasks and identical interfaces. Documentation version5 uses MPCium and four owners; signed Solidity domain remains4. Historical five-person/cb-mpc documents are superseded.

## 1. User and first useful job

Primary user: developer/team running agents that need paid tools. Initial job: inspect a staging checkout through a paid browser service and return requested page/title/form observations, with bounded cost and a traceable result.

Owner reviews target/checks/provider identities/budget/expiry in native app, grants task, closes app. Agent picks an eligible signed quote, pays on Base Sepolia, retrieves genuine browser output, verifies requested fields/artifacts and closes authority. On paid delivery failure it retrieves original result first, then uses another approved provider only within remaining permission. Negative form result can be successful inspection; payment without output is failed delivery.

## 2. Release features and accountable owners

| ID / feature | Required behavior | Implementation owner |
| --- | --- | --- |
| F01 Owner Control | Native local create/backup/import, actual-field typed confirmation/login, separate owner recovery | 3;1 reviews schema |
| F02 MPC Execution | MPCium two-node DKG/signing; either alone cannot; both require exact-request policy authorization | 2;1 reviews signature/contract boundary |
| F03 Task Permit | Signed executor/kind/scope/recipients/budget/time/code commitments; contract invalidates expired/replayed/old-epoch actions | 1;2 policy;3 approval |
| F04 Shared Budget | Atomic pending reservations + independent gross task/wallet/executor counters/floor | 2 and1 |
| F05 Specialized Runbooks | Typed Browser Check, explicit Liquidity Keeper and Scheduled Pay, deterministic action/stop rules, guide/SDK/MCP | 4;2 runtime |
| F06 Liquidity Reserve | Actual bounded deposit/redeem in one vault, preserve floor,20% admission allocation, fresh normal signal | 1 contracts;2 policy;4 runbook;3 UI |
| F07 Delivery Check | Signed invoice/payment/output binding, requested observations/artifacts/freshness, retrieval-before-fallback | 4;2 durable results |
| F08 Recovery Control | Restart/idempotency/UNKNOWN handling, confirmed pause/epoch/revoke, liquid-only independent owner escape | 2 runtime;1 contracts;3 owner |
| F09 Mandate Receipt | Durable events/encrypted artifacts/checkpoint/anchor; standalone integrity/authority/policy/settlement/delivery/completion findings | 2 writer;4 inspector;1 anchor |

Only four handoffs are needed: [01 - Contracts and Shared Interfaces](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md), [02 - Platform Policy and MPCium](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md), [03 - Android Owner Wallet](docs/plans/03%20-%20Android%20Owner%20Wallet.md), [04 - Agents Services Inspection and Demo](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md). Each person owns tests/docs for their output. Person4 assembles submission from their evidence.

## 3. Fixed technical choices

Android12+ physical-phone release build, React Native/Expo54, Kotlin/Wallet Core JNI. Owner seed encrypted under authenticated Android Keystore AES wrapping key; Ethereum signing occurs natively after decryption, not hardware secp256k1 signing. No seed on backend/RN bridge. No server recovery if device+words lost.

MPCium commit `90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2`; two online Linux share hosts, `mpc_threshold:1` in inspected t+1 semantics, required policy authorizer on both. Go adapter/authorizer use same upstream serialization. This configuration/signature/isolation must pass G1, not assumed deployed. Owner key conventional local signing; executor key MPC.

Base Sepolia84532; six-decimal valueless DemoUSD, one controlled DemoVault, non-upgradeable wallet/factory/anchor. Backend Node22/Fastify/viem/Postgres16 durable jobs. Two provider identities in one real Playwright service; custom HTTP402 adapter, no x402 interoperability claim.

No Circle/embedded-wallet vendor, custom MPC protocol/mobile MPC, arbitrary contract calls/approvals, swaps/bridges/credit, live yield promise, autonomous website repair, iOS/app-store launch or open marketplace.

## 4. User flows and visible states

| Screen | Required information/actions |
| --- | --- |
| Setup/restore | Native words/import/word confirmation, owner address, backup and loss consequences |
| Wallet | TESTNET, liquid/floor/reserved/vault/spendable, daily limits, chain snapshot |
| Task/approval | Interpreted observations, target/provider bindings, exact financial scope/time/runbook; native confirm/cancel |
| Task results | Step/provider reason, every charge/tx/status, valid/failed delivery, fallback/gross cost, separate authority closure |
| Assets/schedule | Separate permits, actual position, fixture risk/freshness, recipient/amount/windows/count/missed periods |
| Inspection/control | Six findings/reasons/basis, explicit export, local inhibit versus confirmed pause/revoke/recover |

INCLUDED=three canonical confirmations; FINALIZED=RPC finalized head. Useful output may be COMPLETED while authority CLOSING. UNKNOWN reserves funds and blocks another payment. Confirmed pause/recovery increments epoch; unpause cannot revive old permissions.

## 5. Risk and financial rules

Max0.50/payment,2/task,5/executor/day,10/wallet/day; minimum liquid3. Gross PAY/TRANSFER consumed even on service failure/refund. Separate deposit/withdraw caps,≤20financial actions, browser≤3payments/8steps/10min; Permit≤24h and Action/Invoice≤60s. Owner may tighten.

Deposits only approved vault, preserve floor/pending liquidity;≤20% allocation immediately after deposit. Later ratio increase warns/blocks new deposit, not a perpetual invariant. Withdrawal only to wallet, positive minOutput, fresh preview; unavailable redemption blocks dependent purchase. Risk source is labelled simulation.

Policy reads recent chain state independently and authorizes exact request; contract repeats enforceable financial boundaries. Relayer normal/emergency/anchor lanes, persisted raw tx before broadcast, fee-admission estimates with reserve. Direct bypass cannot enlarge signed contract authority. Both signing hosts compromised may misuse allowed remaining scope; this risk remains disclosed.

## 6. Acceptance, schedule and scoring

[FINAL PLAN](FINAL%20PLAN.md) G0–G5 targets Oct17–18, internal freeze Oct18 18:00 Dhaka; submission target Oct20 18:00, official cutoff21:59 Dhaka. These are aggressive targets, not evidence implementation already exists. G1 proves native signing/restore + actual two-node signing/mandatory authorization; G2 proves one real end-to-end purchase; G3 full mechanisms; G4 evaluation; G5 release.

Q01–Q14 cover owner recovery, MPC isolation, scope/caps, contention, crashes, actual service, paid failure/fallback, assets, schedule, stop/epoch, tamper/inspection, tenant/injection, outages/restore, closure/finality.18 variant runs plus6 failure/asset/schedule runs report correct denials separately from useful delivery. Direct contract/invariant checks are additional. Targets: zero accepted forbidden actions, zero duplicate logical transfers, no unresolved critical/high issue on claimed paths. All results require actual execution.

| Competition scoring | Evidence |
| --- | --- |
| Completion40% | Useful paid output, real asset/schedule operations, durable restart/failure recovery |
| Security/compliance30% | Native owner authority, policy+MPC isolation, on-chain rules, independent stop/recovery, known risks/tests |
| Innovation/interaction30% | Shared financial boundary, delivery-aware recovery, portable independent inspection, clear app |
| Possible bonus0–5 | Actual public on-chain hashes with explained purpose/results; points not guaranteed |

Required submission: technical architecture/core algorithms/security, source repo/README/deployment/test cases, permission tiers/known-risk report and real on-chain tx hashes. English presentation≤10min; optional demo≤5min. Public testnet accepted per user-confirmed organizer response. Registered team2–5 qualifying overseas students,≥60% non-Chinese nationals; for four registered members at least3 meet nationality requirement. Source: supplied competition PDF; eligibility is document context, not a separate task instruction.
