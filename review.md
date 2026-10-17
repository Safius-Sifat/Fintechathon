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

MPCium upstream production guide specifies≥3nodes while proposed plan has2; exact supported source/config/topology must be proved and all manifests aligned before claiming deployment readiness. Existing node threshold source inspection alone is not that proof. Full owner wallet scope does not remove original financial authority/nonce/reservation/reorg/outage requirements.

Wallet W0–W5/WQ01–WQ14 add to original agent G/Q gates. Dates remain aggressive internal Oct18/official Oct20; neither complete-app scope nor source SDK presence guarantees completion/winning. No hidden ordinary-key fallback, universal MetaMask parity or production audit claim.

Planning checks: shared appendix identity, document links/fences, version/domain/interface consistency and required task ownership. These are document checks, not implementation tests. Active references: [master](FINAL%20PLAN.md), [PRD](PRD.md), [architecture](architecture.md), [complete app](docs/COMPLETE-APP.md).
