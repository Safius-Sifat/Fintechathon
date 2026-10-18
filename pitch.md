---
type: product-pitch
title: Mandate — A Wallet for You and Your Agents
version: "6.0"
updated: 2026-10-17
status: proposed-release-not-built
---

# Mandate Wallet

**Your wallet. Your agents. Your rules.**

Mandate is an Android self-custody wallet for everyday transfers and agent work. Users create or restore local accounts, receive/send assets, inspect activity and manage account security. When an agent needs funds, the owner moves a chosen budget into a managed wallet and approves what the agent may do, for whom, at what cost and until when.

Our first application is a developer's agent purchasing browser checks for a staging checkout. The agent selects a suitable provider, pays, retrieves the observations and accounts for every charge while the owner's phone is offline. If a paid service fails, it retrieves the original result first and uses another approved provider only within the remaining permission.

## What the owner gets

| Capability | Concrete behavior |
| --- | --- |
| **Personal Wallet** | Locally generated/imported recovery words, multiple accounts, native ETH/ERC20 send/receive, QR/contacts, asset/history and pending transaction management |
| **Owner Control** | Native approval, protected backup/restore, manual managed-fund transfer, pause/revoke/recovery with independent personal-gas relay |
| **Session Control** | Signed login, native-protected rotating refresh, device/session revoke and clear distinction between logout, local lock and on-chain stop |
| **Receive and Activity** | Chain-qualified QR/contacts, asset import/history, visible fee payer, pending/replacement/cancellation and history coverage |

Personal funds and agent-managed funds are separate balances/addresses with clear gas payers. Owner private keys never reach our backend or agent. Native signing takes place in application memory after decrypting seed under authenticated Keystore protection; it is not hardware Ethereum signing. Recovery words, optional BIP39 passphrase and account index restore owner identity; no server reset can replace them.

## What the agent can do

| Control layer | Mechanism | Example |
| --- | --- | --- |
| **MPC Execution** | Distributed executor signing with required exact-request policy authorization; topology qualified before release | Compromised agent credential alone cannot sign when policy rejects or required signer is unavailable |
| **Task Permit** | Owner signs task/kind/recipient/caps/time/runbook/input; contract independently enforces financial boundaries | Payment to an unapproved recipient fails even outside our API |
| **Shared Budget** | Durable reservations plus independent on-chain gross counters and liquid floor | Concurrent tasks cannot each consume the same remaining allowance |
| **Delivery Check** | Paid invoice/output binding, original retrieval and bounded fallback | Provider A costs0.20 but fails delivery; approved B completes for0.35; owner sees0.55 gross and the original failure |
| **Recovery Control** | Durable request/raw transaction journal, reconciliation and confirmed epoch invalidation | Restart resumes original payment; a successful managed owner transfer pauses old agent authority |
| **Mandate Receipt** | Hash-linked records, signed checkpoint, chain commitment and independent six-finding inspection | Altered export fails; missing facts remain unverifiable; provisional settlement stays distinct from finality |

An owner manually sending from the managed wallet is different from an agent payment. OwnerTransfer uses its own signature/nonce and pauses prior grants; agents cannot invoke it or obtain owner privileges through an SDK token. A normal personal transfer signs locally and does not need MPC or backend consent.

## Specialized workflows

**Browser Check:** buy approved page/title/form observations, validate actual output, retrieve or use bounded fallback. **Liquidity Keeper:** one explicitly approved deposit/redeem in the controlled vault, preserving delegated floor/liquidity rules. **Scheduled Pay:** exact recipient/amount/windows/count, once per period, missed windows skipped. Each includes typed inputs, versioned code/input commitment, deterministic action/validator, stop conditions and skill guide. SDK/MCP run through the same permission boundary.

## Inspectable outcomes

The owner receives separate facts about authority, money spent, work received and permissions still open. A standalone inspector checks integrity, authority, policy, settlement, delivery and completion using separately trusted configuration and chain data. Manual activity is attributed to its owner rather than invented as an agent task.

Provider signatures identify claims, not honesty; on-chain anchors commit history, not its complete truth. Indexer-only traces and backend-only assertions remain labelled. Logout does not falsely promise revocation of already active agent permissions.

## Competition implementation

Release targets Base Sepolia with an installed Android APK, actual personal/managed transfers, paid Playwright services, controlled vault/schedule, owner stop/recovery, QR request and complete wallet flows and independent receipt inspection. Test tokens, fixture risk, accelerated schedules and earlier finalized transactions are visible.

The contribution is a usable owner wallet joined to **shared spending limits, delivery-aware agent recovery and portable inspection**. Wallet Core supplies cryptographic primitives, MPCium distributed signing infrastructure; our work is the application, authorization/contracts, durable execution, workflows and inspection. WalletConnect is deferred. No industry-first, full MetaMask feature parity, audited production safety or guaranteed competition result is claimed.

Initial customer hypothesis: teams operating paid-tool agents may value spending controls and evidence alongside normal wallet control. Adoption/pricing/production readiness require validation. Required implementation and actual status: [FINAL PLAN](FINAL%20PLAN.md), [PRD](PRD.md), [architecture](architecture.md), [Complete App Plan](docs/COMPLETE-APP.md).

The competition rubric, playlist-to-feature decisions, deferred protocols and demo evidence checklist are recorded in [Competition and research traceability](docs/COMPETITION-AND-RESEARCH-TRACEABILITY.md). Video and competitor examples are design references, not proof of implementation or equivalent security.
