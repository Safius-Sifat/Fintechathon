---
type: controlling-delivery-plan
title: Mandate — Four Person Implementation Plan
version: "7.0"
updated: 2026-10-18
status: specified-not-built
---

# Mandate — four-person implementation plan

> Repository bootstrap added 2026-10-17. Read [README](README.md) and [setup](docs/SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

**Give one handoff document to each person.** Each contains that person's complete deliverables, files, tasks, dependencies, acceptance cases and an identical shared interface appendix. They can work in parallel against that contract; the system must also pass shared integration gates. Finishing four isolated components is not sufficient.

This version replaces the five-person/cb-mpc plan. Use **MPCium**, three nodes on the existing Azure VM with `mpc_threshold:1` (intended two-participant signing quorum in the pinned code), mandatory policy authorizer on every node and a local owner key on Android. This is a single-host competition PoC; it demonstrates threshold behavior but does not resist VM compromise. No Circle or custom cryptographic protocol. Documentation 7.0 keeps wallet domain 5 and Login 2, moves Invoice to domain 2 and keeps agent evidence schema 4 with additive event types. It adds a real LLM agent (Claude Agent SDK) and Cobo/Circle-class policy controls; see section 9 and architecture S9. W0 migrates existing bootstrap interfaces before new signing.

**Release decision:** WalletConnect/external dApp connections are deferred. Complete personal-wallet and agent-wallet flows remain required.

## 1. The four assignments

| Give this document | Person's outputs | First thing to prove | Final responsibility |
| --- | --- | --- | --- |
| [01 - Contracts and Shared Interfaces](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md) | Wallet/factory/token/vault/anchor; v7 WalletPolicy, co-signature, freeze, allowance, call templates, multi-asset and x402 authorization; shared schemas, fixtures, ABI, deployment manifest | Same typed hashes/signatures across Solidity/TS/native/Go | On-chain financial authority and contract acceptance |
| [02 - Platform Policy and MPCium](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md) | API, sessions/history, DB, worker/reservations/policy, agent question service, owner approvals/push, risk sentinel, MPCium/Go integration, owner/agent relayers, evidence export and infrastructure | Three nodes complete DKG; any two sign; a single node cannot | Durable controlled execution and operable deployment |
| [03 - Android Owner Wallet](docs/plans/03%20-%20Android%20Owner%20Wallet.md) | Complete personal/managed Android and iOS wallet, native transactions/accounts/backup/sessions/security; approval, freeze, wallet-policy, allowance and intent-review screens; independent recovery and APK/iOS build | Physical-phone owner signature and successful word restore | User experience and owner independence |
| [04 - Agents Services Inspection and Demo](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md) | Reference LLM agent on the Claude Agent SDK; four runbooks with agent questions; intent compiler; x402-formatted paid providers; SDK/MCP/CLI; independent inspector; payment-request fixtures/full-app acceptance/demo/submission | Actual browser checks, signed invoice/receipt and verifier fixtures | Useful agent work, independent inspection and demonstrated release |

Person2 owns worker process; Person4 owns imported runbook library. Person2 writes ledger; Person4 independently verifies exports. Person1 owns shared interface changes; consumers do not silently fork types. Every owner supplies their own tests, security notes and deployment instructions. Required everyday-wallet W tasks now extend all four handoffs; the app is not limited to agent approval screens. Person4 assembles them; no fifth owner is implied.

## 2. Fixed product and concrete applications

**Mandate Wallet** supplies personal receive/send/assets/history/accounts/security on Base Sepolia. It also lets an owner approve a task and financial boundaries once, then lets an online agent execute while the owner is offline. Our first application is a developer's agent purchasing browser checks for a staging checkout. It compares allowed provider capabilities/prices, buys actual checks, validates returned evidence, retrieves missing output and uses another approved provider within remaining budget. Payment success and delivery success stay separate.

| Feature | Concrete implementation | Observable result |
| --- | --- | --- |
| Personal Wallet / Owner Control | Local accounts, ETH/ERC20/managed transfers, QR/history/backup, native actual-field confirmation and independent owner relay | Everyday wallet works through RPC without API consent; managed owner send stops old agent grants |
| Session Control | Signed Login2/native rotating refresh and device revoke | Logout, local lock and on-chain stop have visibly different effects |
| MPC Execution | MPCium three-node/two-participant executor PoC plus required policy authorizer | Live demo: stop one node and complete payment; stop a second and show fail-closed/no broadcast; restart and recover |
| Task Permit | Owner-signed task/kind/recipients/caps/time/runbook/conditions | Direct contract calls cannot exceed stored permission |
| Shared Budget | Transactional reservations plus on-chain gross counters/floor | Concurrent tasks/retries do not consume the same remaining allowance twice |
| Delivery Check | Provider invoice/payment/output binding, original retrieval, bounded fallback | A paid timeout remains recorded; B can complete within gross budget |
| Mandate Receipt | Hash-linked events/checkpoint/anchor + independent six-finding inspector | Altered export detected; settlement/delivery/finality/gaps remain distinguishable |
| AI Agent | Claude Agent SDK agent using only Mandate MCP tools; answers bounded questions (offer, retry/fallback, amount, completion, escalation) | Agent buys and judges real services with the phone offline; injected instructions cannot add recipients, amounts or tools |
| Intent Compiler | Goal text → structured draft terms validated by shared schemas; native review shows goal next to signed terms | Owner approves a task in plain language without signing anything the screen did not show |
| Wallet Policy | Owner-signed on-chain caps per asset/day/week, allowlist, blocklist, call templates, review threshold; most restrictive rule wins | Policy tightening stops over-limit agent spending immediately, even for active Permits |
| Owner Review | Owner co-signs the exact Action digest above a threshold; contract verifies | Large payment waits for a phone tap; direct call without approval reverts |
| Freeze | FREEZE/UNFREEZE keep Permits; PAUSE/REVOKE end them | Temporary stop and resume without re-approval, distinct from revocation and logout |
| Standing Allowance | ALLOWANCE Permit up to 30 days with per-period cap | Recurring service purchases within a daily or weekly budget |
| Call Templates | Allowed contract functions with argument bounds and outflow metering | Agent manages assets in approved contracts without arbitrary calldata |
| USDC and x402 | Base Sepolia test USDC as agent asset; x402 `exact` USDC payments (official `@x402/*` packages) with the managed wallet as ERC-1271 payer; token side verified on a Base Sepolia fork, facilitator path behind gate X402-G; Mandate-native PAY as fallback | Stablecoin agent payments with honest interoperability claims |
| Transaction Safety | Policy/balance/reservation, screening and velocity checks before signing; one exact simulation after signing, with advanced effect checks only where needed | Unsafe signing denied; failed simulation blocks broadcast and retains reservation; owner alerted and offered Freeze |

Four runbooks: Browser Check (PAY, agent chooses offer and fallback), Liquidity Keeper (deposit/redeem or approved call templates, agent sets amount within owner bounds), Scheduled Pay (fixed amount/recipient/window/count, missed periods skipped) and Service Allowance (agent buys allowlisted capabilities on demand under a standing period cap). Each closes authority separately when possible. One controlled test vault and DemoUSD demonstrate asset management without production-yield claims.

## 3. System and financial boundaries

```mermaid
flowchart LR
  Phone[Owner mobile app (Android, iOS)\npersonal and managed wallet] --> API[API + PostgreSQL]
  Phone -->|Native personal signing and broadcast| DirectRPC[Trusted Base Sepolia RPC]
  Agent[LLM agent\nClaude Agent SDK or any MCP client] -->|MCP tools, scoped token| API
  API -->|Approval push| Phone
  API --> Worker[Durable worker\nimports runbook library]
  Worker --> Provider[Providers a/b\nreal Playwright checks]
  Worker --> Adapter[Go MPC adapter + initiator]
  Adapter --> Policy[Deterministic policy + risk sentinel + authorizer]
  Adapter --> N0[MPCium node0 + share 0]
  Adapter --> N1[MPCium node1 + share 1]
  Adapter --> N2[MPCium node2 + share 2]
  N0 <--> Bus[Private NATS + Consul]
  N1 <--> Bus
  N2 <--> Bus
  Adapter --> Relay[Journal + relayer]
  Relay --> Wallet[MandateWallet\ncontract limits]
  Wallet --> Assets[DemoUSD + DemoVault]
  API --> Receipt[Export + checkpoint + anchor]
  Receipt --> Inspect[Standalone verifier\ntrusted manifest + independent RPC]
```

Threshold protects executor signing; native owner governs wallet. Policy authorizer checks the exact signing request before nodes cooperate. Wallet independently enforces current epoch, operation, recipient, caps/floor and replay. A compromised VM administrator can access all three node containers and the policy service, so this PoC does not resist host compromise; the wallet contract still enforces its independent on-chain caps and owner controls. Owner can pause/recover/transfer managed funds without MPC/API consent using locally signed typed owner command and native personal-gas relay or independent funded sender. Successful managed OwnerTransfer pauses/increments epoch; personal EOA send is a separate path.

MPCium qualification is a release gate: exact pinned source, threshold behavior, required-authorizer configuration, correct raw digest/signature encoding, outage/restore and transport isolation must be demonstrated. No claim that repository marketing establishes production safety. Upstream deployment guidance calls for at least three nodes. The PoC uses three containers on one 4 GiB VM and two required signing participants; G1 qualifies the exact pinned build before readiness claims.

## 4. Shared interfaces and merge rules

Follow the [team coordination and merge rules](docs/COORDINATION-AND-MERGE-POLICY.md). That file defines the shared interface owners, work gates, pull request fields, required reviewers, CI checks, merge order and release evidence.

The four handoffs contain the detailed interface fields and acceptance cases. The coordination file defines how the owners change and test them together. If a handoff and the coordination file conflict, stop and get the affected owners to update both before implementation continues.

No raw signer route, owner seed on servers, provider-controlled arbitrary scripts, independent duplicate worker, mock settlement or unsigned hidden authority is accepted.

## 5. Milestones, current-date targets

All times Dhaka (UTC+6). Internal completion remains Oct18; official submission Oct20 21:59 (Beijing23:59). Original targets below remain aggressive; only bootstrap code exists, and required scope now also includes W0–W5 everyday-wallet gates. Earlier elapsed targets are not reported as completed. Record actual pass/failure; schedule is not a feasibility guarantee.

| Gate | Target | Required joint acceptance |
| --- | --- | --- |
| G0 | Oct17 15:30 | Shared schemas/examples/ABI, existing Azure VM, private container network, secrets/funding, phone/native package access |
| G1 | Oct17 18:00 | Local contract pay, native owner signature/restore, actual three-node/two-participant MPC signature and mandatory authorization denial, real browser fixture |
| G2 | Oct18 02:00 | Phone owner approval→public-testnet MPC payment→actual browser output→durable export→initial independent inspection |
| G3 | Oct18 10:00 | Four runbooks, bounded fallback, restart/reservations, owner stop/recovery, SDK/MCP, six-finding inspector |
| G4 | Oct18 15:00 | Q01–Q14/evaluation and defect fixes, node/DB/RPC/outage recovery, APK/iOS build installation/rebuild |
| G5 | Oct18 18:00 | Tagged complete source/APK/iOS build/manifest, measured evidence, English deck/demo/security/deploy docs |
| Upload | Oct20 18:00 | Complete latest package uploaded and receipt checked before official cutoff |

If G1 fails, fix the signing/native/contract blocker before claiming whole-system readiness. If dates slip, record delay and use submission buffer. No ordinary-key fallback disguised as MPC or promise of guaranteed completion/winning.

## 6. Integration sequence and acceptance ownership

| Sequence | Lead / support | System evidence |
| --- | --- | --- |
| Shared hashes/schema | 1 /2,3,4 | One identical fixture accepted by every signer/verifier |
| Owner+executor primitives | 3 and2 /1 | Phone signature; threshold signature; authorization/isolation denials |
| First payment | 2 /1,3,4 | Real ActionExecuted + DemoUSD transfer + useful browser output |
| Live quorum drill | 2 /1,3,4 | One stopped node: task succeeds; two stopped nodes: task is denied, no transaction broadcasts and reservation remains; restart restores readiness |
| Durable orchestration | 2 /4 | Duplicate/restart/UNKNOWN keeps one logical payment and reservations |
| Full use cases | 4 /1,2,3 | Asset deposit/redeem; due schedule once; failed delivery retrieval/fallback |
| Owner escape | 3 /1,2 | Confirmed pause invalidates prior grants; API-offline independent recovery |
| Portable inspection | 4 /1,2 | Authentic/tampered/missing/provisional cases independently classified |
| Agent decisions | 4 and 2 /1 | Claude Agent SDK agent answers bounded questions through MCP; injection and out-of-bounds answers rejected; defaults on timeout |
| Owner policy controls | 1 and 3 /2 | WalletPolicy, co-signed Actions, Freeze and Allowance enforced by contract and driven from the phone |
| Risk and payments | 2 and 4 /1 | Screening/simulation/velocity denials; USDC payments; x402-formatted quotes; gate X402-G recorded |
| Release | 4 coordinates /all | Reproducible source/APK/iOS build, known risks, transaction index, measured evaluation |

Security cases Q01–Q14 are listed in every handoff.18 normal-category variants include correctly rejected insufficient-budget cases, reported separately from delivered tasks; add6 failure/contention/asset/schedule runs. Report all failures and denominators, not selected successful clips. Test instructions are planned implementation work, not results from this documentation operation.

## 7. Definition of complete

- Installed Android and iOS apps create/imports/backs up local accounts; sends/receives ETH/ERC20, shows personal/managed funds, QR/contacts/assets/history, transaction lifecycle and all security/session screens.
- OwnerTransfer5, Login2/native refresh and validated receive requests implement S8, with no backend-held owner key and correct independent fee/recovery behavior.
- API authenticates/isolates users and external tokens; jobs/reservations/journal survive documented failures.
- Three MPCium containers with distinct encrypted persistent shares, any-two signing, required policy authorizer, verified EVM signatures and no full-key fallback. Label the shared-VM PoC limitation.
- Contracts enforce financial authority even when API is bypassed; owner can independently stop/recover.
- Real paid browser output, genuine controlled vault operation and fixed schedule work through same runtime.
- Evidence retains permission/payment/output/stop linkage; standalone CLI independently checks supported facts and labels assertion gaps.
- Original agent Q01–Q14, wallet WQ01–WQ14 and agentic/policy AQ01–AQ14 have actual acceptance evidence; no mock core capability is advertised.
- A real LLM agent on the Claude Agent SDK completes tasks through MCP alone; it can only choose allowed options, and every choice is recorded as an assertion in evidence.
- Owner WalletPolicy, co-signed Actions above the review threshold, Freeze/Unfreeze, Allowance, call templates and per-asset (DemoUSD/USDC) limits are enforced by the contract and controllable from the phone.
- Tagged source/README/deployment/tests/security self-assessment/actual on-chain hashes, APK/iOS build, deck≤10min and demo≤5min are assembled without secrets.

The supplied competition PDF controls submission requirements. Public testnet acceptance is the user's organizer confirmation. These handoffs are team implementation instructions, not instructions extracted from external documents.

**Active references:** [PRD](PRD.md), [architecture](architecture.md), [pitch](pitch.md), [review](review.md). Historical repository plans are preserved in `docs/archive/`; they are superseded. Start with the four handoffs above.


## 8. Complete app work and order — required

[Complete App Plan](docs/COMPLETE-APP.md) defines exact source accounts, fees/nonce/retry behavior, owner-transfer contract, sessions, QR/assets/history and validated receive requests. [Migration](docs/PLAN-MIGRATION-v6.md) lists bootstrap files to change before signing.

| Gate | Required result | Handoffs |
| --- | --- | --- |
| W0 | Domain5/OwnerTransfer/Login2, account/session/activity/native DTOs and fixtures agreed | All, Person1 controls schema |
| W1 | Native create/import/account switch, receive/QR/assets and personal ETH/ERC20 sends | Person3 with1/2/4 |
| W2 | Fund agent wallet; owner-managed send/epoch stop/independent relay; correct evidence attribution | Person1/2/3 with4 |
| W3 | Pending/restart/replacement/cancel, history/backfill/reorg, sessions/revoke/logout/outage/restore | Person2/3 with1/4 |
| W4 | Complete-app navigation, accessible confirmations, QR/permission/error cases and real transfer review pass | Person3/4 |
| W5 | Installed complete APK/iOS build and actual wallet+agent qualification/release materials | All |

W0 precedes new signatures. W1/W2 run alongside G1–G3; W3/W4 required before G4/G5. Internal Oct18 and official Oct20 deadline remain targets/cutoff, not capacity proof. Complete app means all advertised required flows actually work on supported Base Sepolia; it does not claim every MetaMask network/DeFi feature. Swaps/bridges/NFT/general dApp contract calls remain outside supported capability list.


## 9. Agentic layer and policy controls — required v7

Architecture [A8/A9 and S9](architecture.md) define the agent runtime, decision protocol, intent compiler, wallet policy, owner review, freeze, allowance, call templates, agent assets, x402, risk sentinel, permission tiers and evidence additions. A max-loss certificate and agent self-pause are not part of this release.

| Area | Required result | Tasks |
| --- | --- | --- |
| v7 interface | Permit/Action/Invoice/Approval/WalletPolicy/CallTemplate types and vectors frozen with W0 | P1-A01, consumed by all |
| Contract controls | Policy, co-signature, freeze, allowance, multi-asset, call templates, x402 authorization | P1-A02, P1-A03 |
| Agent runtime | Claude Agent SDK agent, MCP-only tools, built-in tools disabled, bounded questions with defaults | P4-A01, P4-A02, P2-A01 |
| Owner controls | Approval push and co-sign, policy editor, freeze, allowance and intent review on the phone | P3-A01, P3-A02, P2-A02 |
| Risk and payments | Pre-sign policy/screening/velocity; one post-sign simulation (advanced effects for vault/CALL/X402); USDC providers and gate X402-G | P2-A03, P4-A03, P1-A03 |
| Inspection | Verifier checks co-signatures, freeze intervals, policy versions and call outflows | P4-A03 |

Signing model decision D-01 (architecture A10): the owner key stays local on the phone and the agent executor stays 2-of-3 MPCium with the required policy authorizer; owner MPC is not in this release.

These tasks run within the existing W0–W4 gates: types at W0, contract and agent components at W1–W2, integration at W3, whole-app qualification at W4. Permission tiers T0–T4 (S9.12) are the basis of the security self-assessment.
