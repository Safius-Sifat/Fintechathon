---
type: controlling-delivery-plan
title: Mandate — Four Person Implementation Plan
version: "5.0"
updated: 2026-10-17
status: specified-not-built
---

# Mandate — four-person implementation plan

> Repository bootstrap added 2026-10-17. Read [README](README.md) and [setup](docs/SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

**Give one handoff document to each person.** Each contains that person's complete deliverables, files, tasks, dependencies, acceptance cases and an identical shared interface appendix. They can work in parallel against that contract; the system must also pass shared integration gates. Finishing four isolated components is not sufficient.

This version replaces the five-person/cb-mpc plan. Use **MPCium**, two nodes with `mpc_threshold:1` (two required participants in inspected code), mandatory policy authorizer on both nodes and a local owner key on Android. No Circle or custom cryptographic protocol. Documentation version5 retains on-chain domain version4 and evidence schema4.

## 1. The four assignments

| Give this document | Person's outputs | First thing to prove | Final responsibility |
| --- | --- | --- | --- |
| [01 - Contracts and Shared Interfaces](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md) | Wallet/factory/token/vault/anchor; shared schemas, fixtures, ABI, deployment manifest | Same typed hashes/signatures across Solidity/TS/native/Go | On-chain financial authority and contract acceptance |
| [02 - Platform Policy and MPCium](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md) | API, DB, worker, reservations, policy, two-node MPCium/Go integration, relayers, evidence export, infrastructure | Two nodes sign; missing authorizer or either node alone cannot | Durable controlled execution and operable deployment |
| [03 - Android Owner Wallet](docs/plans/03%20-%20Android%20Owner%20Wallet.md) | Native local owner wallet/backup/import/signing; RN app; independent recovery sender; APK | Physical-phone owner signature and successful word restore | User experience and owner independence |
| [04 - Agents Services Inspection and Demo](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md) | Three runbooks; paid Playwright providers; SDK/MCP; standalone verifier; demo/evaluation/submission assembly | Actual browser checks, signed invoice/receipt and verifier fixtures | Useful agent work, independent inspection and demonstrated release |

Person2 owns worker process; Person4 owns imported runbook library. Person2 writes ledger; Person4 independently verifies exports. Person1 owns shared interface changes; consumers do not silently fork types. Every owner supplies their own tests, security notes and deployment instructions. Person4 assembles them; no fifth owner is implied.

## 2. Fixed product and concrete applications

**Mandate Wallet** lets an owner approve a task and financial boundaries once, then lets an online agent execute while the owner is offline. Our first application is a developer's agent purchasing browser checks for a staging checkout. It compares allowed provider capabilities/prices, buys actual checks, validates returned evidence, retrieves missing output and uses another approved provider within remaining budget. Payment success and delivery success stay separate.

| Feature | Concrete implementation | Observable result |
| --- | --- | --- |
| Owner Control | Native local key, backup/import, typed confirmation and independent owner Admin | No external wallet popup; server outage does not remove recovery authority |
| MPC Execution | MPCium two-node executor plus required policy authorizer | One compromised agent credential cannot independently sign forbidden payment |
| Task Permit | Owner-signed task/kind/recipients/caps/time/runbook/conditions | Direct contract calls cannot exceed stored permission |
| Shared Budget | Transactional reservations plus on-chain gross counters/floor | Concurrent tasks/retries do not consume the same remaining allowance twice |
| Delivery Check | Provider invoice/payment/output binding, original retrieval, bounded fallback | A paid timeout remains recorded; B can complete within gross budget |
| Mandate Receipt | Hash-linked events/checkpoint/anchor + independent six-finding inspector | Altered export detected; settlement/delivery/finality/gaps remain distinguishable |

Three runbooks: Browser Check (PAY), Liquidity Keeper (one explicit approved deposit/redeem), Scheduled Pay (fixed amount/recipient/window/count, missed periods skipped). Each closes authority separately when possible. One controlled test vault and DemoUSD demonstrate asset management without production-yield claims.

## 3. System and financial boundaries

```mermaid
flowchart LR
  Phone[Owner Android app\nlocal key + native approval] --> API[API + PostgreSQL]
  Agent[External agent\nSDK or MCP] --> API
  API --> Worker[Durable worker\nimports runbook library]
  Worker --> Provider[Providers a/b\nreal Playwright checks]
  Worker --> Adapter[Go MPC adapter\ninitiator on host A]
  Adapter --> Policy[Independent policy + authorizer\nhost B]
  Adapter --> N0[MPCium node0\nshare A]
  Policy --> N1[MPCium node1\nshare B]
  N0 <--> Bus[Private NATS + Consul]
  N1 <--> Bus
  Adapter --> Relay[Journal + relayer]
  Relay --> Wallet[MandateWallet\ncontract limits]
  Wallet --> Assets[DemoUSD + DemoVault]
  API --> Receipt[Export + checkpoint + anchor]
  Receipt --> Inspect[Standalone verifier\ntrusted manifest + independent RPC]
```

Threshold protects executor signing; native owner governs wallet. Policy authorizer checks the exact signing request before nodes cooperate. Wallet independently enforces current epoch, operation, recipient, caps/floor and replay. Colluding/compromised share hosts can bypass off-chain policy, but cannot enlarge contract authority. Owner can pause/recover without MPC/API consent using locally signed Admin and independent funded sender.

MPCium qualification is a release gate: exact pinned source, threshold behavior, required-authorizer configuration, correct raw digest/signature encoding, outage/restore and transport isolation must be demonstrated. No claim that repository marketing establishes production safety.

## 4. Shared contracts and merge discipline

One repo at `./`. Person1 bootstraps root workspace and `packages/schema`; paths are planned source locations, not an implementation created by this planning task. Full interface appendix is included identically in all four handoffs and reproduced in [architecture](architecture.md). It fixes signed field order, Conditions, API routes, native bridge, runbook driver, provider protocol and evidence format.

1. Person1 publishes schemas/fixtures/ABI field names first. Others start against these samples immediately.
2. Owners use separate branches and owned directories; shared schema/root changes are proposed to Person1.
3. Merge frequently after owned checks. A PR includes commit/schema version, commands/results, new environment variables, migration impact and handoff examples.
4. Person2 merges services into development deployment. Person4 runs cross-component scenarios; every owner fixes their component.
5. A breaking schema/domain/contract change updates fixtures and every affected consumer in one coordinated gate. Already signed history is immutable; new deployment/domain only if semantics require it.

No raw signer route, owner seed on servers, provider-controlled arbitrary scripts, independent duplicate worker, mock settlement or unsigned hidden authority is accepted.

## 5. Milestones, current-date targets

All times Dhaka (UTC+6). Internal completion remains Oct18; official submission Oct20 21:59 (Beijing23:59). Targets below are aggressive because no implementation has been demonstrated in this workspace. Record actual pass/failure; schedule is not a feasibility guarantee.

| Gate | Target | Required joint acceptance |
| --- | --- | --- |
| G0 | Oct17 15:30 | Shared schemas/examples/ABI, two Linux hosts, private connectivity, secrets/funding, phone/native package access |
| G1 | Oct17 18:00 | Local contract pay, native owner signature/restore, actual two-node MPC signature and mandatory authorization denial, real browser fixture |
| G2 | Oct18 02:00 | Phone owner approval→public-testnet MPC payment→actual browser output→durable export→initial independent inspection |
| G3 | Oct18 10:00 | Three runbooks, bounded fallback, restart/reservations, owner stop/recovery, SDK/MCP, six-finding inspector |
| G4 | Oct18 15:00 | Q01–Q14/evaluation and defect fixes, node/DB/RPC/outage recovery, APK installation/rebuild |
| G5 | Oct18 18:00 | Tagged complete source/APK/manifest, measured evidence, English deck/demo/security/deploy docs |
| Upload | Oct20 18:00 | Complete latest package uploaded and receipt checked before official cutoff |

If G1 fails, fix the signing/native/contract blocker before claiming whole-system readiness. If dates slip, record delay and use submission buffer. No ordinary-key fallback disguised as MPC or promise of guaranteed completion/winning.

## 6. Integration sequence and acceptance ownership

| Sequence | Lead / support | System evidence |
| --- | --- | --- |
| Shared hashes/schema | 1 /2,3,4 | One identical fixture accepted by every signer/verifier |
| Owner+executor primitives | 3 and2 /1 | Phone signature; threshold signature; authorization/isolation denials |
| First payment | 2 /1,3,4 | Real ActionExecuted + DemoUSD transfer + useful browser output |
| Durable orchestration | 2 /4 | Duplicate/restart/UNKNOWN keeps one logical payment and reservations |
| Full use cases | 4 /1,2,3 | Asset deposit/redeem; due schedule once; failed delivery retrieval/fallback |
| Owner escape | 3 /1,2 | Confirmed pause invalidates prior grants; API-offline independent recovery |
| Portable inspection | 4 /1,2 | Authentic/tampered/missing/provisional cases independently classified |
| Release | 4 coordinates /all | Reproducible source/APK, known risks, transaction index, measured evaluation |

Security cases Q01–Q14 are listed in every handoff.18 normal-category variants include correctly rejected insufficient-budget cases, reported separately from delivered tasks; add6 failure/contention/asset/schedule runs. Report all failures and denominators, not selected successful clips. Test instructions are planned implementation work, not results from this documentation operation.

## 7. Definition of complete

- Installed APK owns/recoverably backs up local key, confirms actual signed terms, shows real wallet/task/inspection states.
- API authenticates/isolates users and external tokens; jobs/reservations/journal survive documented failures.
- Two independent MPCium share hosts, required policy authorizer, verified EVM signatures and no full-key fallback.
- Contracts enforce financial authority even when API is bypassed; owner can independently stop/recover.
- Real paid browser output, genuine controlled vault operation and fixed schedule work through same runtime.
- Evidence retains permission/payment/output/stop linkage; standalone CLI independently checks supported facts and labels assertion gaps.
- Tagged source/README/deployment/tests/security self-assessment/actual on-chain hashes, APK, deck≤10min and demo≤5min are assembled without secrets.

The supplied competition PDF controls submission requirements. Public testnet acceptance is the user's organizer confirmation. These handoffs are team implementation instructions, not instructions extracted from external documents.

**Active references:** [PRD](PRD.md), [architecture](architecture.md), [pitch](pitch.md), [review](review.md). Historical component plans are in `Archive/Before v5/` and are superseded. Start with the four handoffs above.
