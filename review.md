---
type: design-review
title: Mandate — v6 Complete Wallet Plan Review
version: "6.0"
updated: 2026-10-17
status: planning-review-only
---

# Version6 — complete app review and decisions

User requested that everyday wallet capabilities become real required work in all plans. Prior v5 bootstrap/plans are archived; this is not implementation or security qualification.

## Fixed additions

| Area | Decision |
| --- | --- |
| Funds | Personal local EOA funds and managed agent contract balances visibly separate; executor is not receive address |
| Personal sends | Native ETH/standard ERC20 semantic transaction builder, real L1/L2 fee estimate, shared EOA nonce journal/retry/replacement/cancel |
| Managed sends | New OwnerTransfer5, independent nonce/owner signature, liquid asset control; successful send pauses/epoch-invalidates old agent grants |
| Auth | Login2 binds installation deviceId;15min revocable-session JWT, native refresh storage/rotation,7day idle/30day absolute expiry, session revoke and original auth_time |
| App | Account indexes0..19, import/optional passphrase/backup, receive/QR/contacts, token metadata/assets/history, state/error/security/funding/help screens |
| dApps | WalletConnect/external dApp connections explicitly deferred by user choice; no SDK/projectId/release gate required |
| Evidence | Manual owner activity distinct from agent task; OwnerTransfer correctly attributed, history coverage/provenance visible |
| Versions | Documentation6/new wallet domain5/Login2; agent evidence/runbook4 and Invoice/Delivery1 unchanged |
| Ownership | Person1 contracts/schema;2 auth/history/relay/runtime;3 complete native app;4 payment-request fixtures/inspection/full-app acceptance; no fifth owner |

## Concrete integration corrections

New owner operation cannot be requested with an agent token/executor signature. It stops previous managed authority rather than racing reserved budgets invisibly; personal sends remain independent. Personal nonce manager also owns native Admin/OwnerTransfer gas relays. Logout/local removal do not falsely stop on-chain agents. Restore needs words+optional passphrase+index and does not recreate MPC shares. Indexer errors never imply empty history; personal RPC balance/send can operate without API. Native recovery identifies core DemoUSD/vault versus separate imported-token/native sweeps and partial failures.

Existing code remains pre-v6 bootstrap: schema domain4/Login1/structs are migration inputs, not compatible implementation. [Migration](docs/PLAN-MIGRATION-v6.md) owns order. No runtime source, keys, deployment, tests or financial behavior changed in this documentation operation.

## Sources and outstanding gates

Public Etherscan V2 chainlist lists84532; authenticated account endpoint/quota still needs supplied API key qualification. Anonymous Base Sepolia Blockscout requests returned403 in this environment, so no availability assumption was used. WalletConnect is deferred, so Reown SDK compatibility is not a release dependency. EIP681/712 and Wallet Core/Android references define primitives only; native integration still needs real device qualification.

MPCium plan now specifies three nodes on one VM with an intended two-participant quorum. The pinned source/config must prove DKG, each signing pair, one-node tolerance, two-node fail-closed behavior, authorization and signature recovery before deployment readiness. The shared VM does not provide host-compromise resilience. Full owner wallet scope does not remove original financial authority/nonce/reservation/reorg/outage requirements.

Wallet W0–W5/WQ01–WQ14 add to original agent G/Q gates. Dates remain aggressive internal Oct18/official Oct20; neither complete-app scope nor source SDK presence guarantees completion/winning. No hidden ordinary-key fallback, universal MetaMask parity or production audit claim.

Planning checks: shared appendix identity, document links/fences, version/domain/interface consistency and required task ownership. These are document checks, not implementation tests. Active references: [master](FINAL%20PLAN.md), [PRD](PRD.md), [architecture](architecture.md), [complete app](docs/COMPLETE-APP.md).

## Competition and playlist audit — 2026-10-17

The detailed source-to-plan matrix is [docs/COMPETITION-AND-RESEARCH-TRACEABILITY.md](docs/COMPETITION-AND-RESEARCH-TRACEABILITY.md). It keeps the official 40/30/30 scoring split, 0–5 optional on-chain challenge, submission package, eligibility and deadline separate from ideas in the 26 talks. The PRD, architecture and pitch now link to that matrix.

**Review result:** the PRD covers the stated Topic F work and submission artifacts; the architecture describes how the named controls should work; the pitch describes the product and its limits without claiming it is built or security-equivalent to Cobo. Most playlist themes appear as bounded permits, deterministic authorization, runbooks, risk checks, service-delivery verification, transaction lifecycle states and inspectable evidence. x402, MPP, credit, cross-asset routing, open marketplace/reputation and quantum optimization are marked deferred or out of scope rather than implied as features.

**Release blockers and risks:** the repo is still the bootstrap described in `docs/BOOTSTRAP-STATUS.md`; there are no deployed financial contracts, operational MPC nodes, wallet flows or end-to-end financial tests. The three-node/two-participant MPC PoC remains unqualified until the pinned build passes its defined DKG/quorum/outage tests. The scope is very large for the remaining competition window. Do not claim completion, audit, Cobo-equivalent security or a guaranteed result until the corresponding evidence exists. The pitch itself needed no feature rewrite; its status and qualification statements are consistent with the codebase.

**Review type:** document/source alignment only. No implementation tests were run and no runtime behavior was verified.
