---
type: product-pitch
title: Mandate Wallet — Product and Control Layers
version: "5.0"
updated: 2026-10-17
status: proposed-release-not-built
---

# Mandate Wallet

> Repository bootstrap added 2026-10-17. Read [README](README.md) and [setup](docs/SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

**Give agents a budget. Get an accountable result.**

Mandate is an owner-controlled wallet that lets agents buy digital services, operate approved funds and make scheduled payments under clear permissions. Owners approve the task and boundaries once in our app; agents then work while the owner is offline.

Our first application is a developer's agent buying browser checks for a staging checkout. It selects an eligible provider, pays, checks the returned observations and accounts for every charge. When a paid service fails, it retrieves the original result first and uses another approved provider only within the remaining budget. The owner sees work received, money spent and authority still open as separate facts.

## Control layers

| Feature | Exact mechanism | Example |
| --- | --- | --- |
| **Owner Control** | Local Android owner key, native confirmation/backup/import; independent owner pause/recovery | Our servers stop; owner restores words or signs locally and uses independent relayer to recover supported funds |
| **MPC Execution** | MPCium two-node executor; both nodes require authorization of the exact request from separate policy service | Agent/API credential alone cannot bypass a rejecting or unavailable policy signer |
| **Task Permit** | Owner signature binds executor/kind/providers/recipients/caps/time/runbook/conditions; contract validates current epoch and limits | Direct payment to unapproved recipient fails outside our API too |
| **Shared Budget** | Durable pending reservations coordinate tasks; independent contract gross counters and liquid floor constrain settlement | Two concurrent tasks cannot each treat the same remaining allowance as available |
| **Delivery Check** | Invoice/payment/output binding, freshness/artifact validation, original retrieval and bounded fallback | A pays0.20 but times out; approved B completes for0.35; owner sees0.55 gross and original failure |
| **Recovery Control** | Persistent logical IDs/raw transaction journal, reconciliation, signed CLOSE and confirmed pause/epoch invalidation | Restart resumes original transaction; unpause cannot resurrect old permissions |
| **Mandate Receipt** | Hash-linked ledger, signed checkpoint, on-chain commitment, portable export and independent six-finding inspector | Altered export fails; missing bytes remain unverifiable; provisional settlement is not called finalized |

Owner key is conventional local signing, encrypted under authenticated Android Keystore wrapping key; Ethereum signing occurs in native memory. Agent executor is MPC, separate from owner authority. Both online signing hosts are necessary; the owner need not be online. Colluding hosts can misuse remaining permitted scope, but cannot enlarge the wallet's on-chain authorization. We do not claim production certification or equivalence to another wallet provider.

## Specialized runbooks

| Runbook | Work | Boundary |
| --- | --- | --- |
| **Browser Check** | Interpret requested observations, compare signed eligible quotes, purchase real checks, validate/retrieve/fallback | Approved targets/providers;≤3paid attempts,8steps,10min; PAY/CLOSE only |
| **Liquidity Keeper** | One explicit approved deposit/redeem in one vault, preserve pending-task liquidity and liquid floor | Separate asset Permit; fresh NORMAL signal for deposit; return funds only to wallet; no yield promise |
| **Scheduled Pay** | Exact approved recipient/amount/window/count | Once per due period, missed periods skipped, no catch-up |

Each runbook includes typed inputs, versioned code commitment, deterministic action builder/validator, stop rules and skill guide. SDK/MCP let external agents use the same scoped API. Neither a skill nor an API token can create owner authority or access raw signing.

## Evidence and inspection

An export links approved scope, signed action, transaction, output, fallback and authority closure. An inspector using separate trusted keys/contracts and independent RPC reports **integrity, authority, policy, settlement, delivery and completion** individually, with PASS/FAIL/PENDING/UNVERIFIABLE and a supporting basis.

Provider signatures identify claims; they do not prove provider honesty. Anchors establish published commitments, not complete truthful history. Backend-only policy assertions without independent support remain unverifiable. These limits are visible in the receipt instead of hidden behind one success badge.

## What we contribute

Our contribution is a coherent implementation connecting **shared spending boundaries, delivery-aware recovery and portable inspection around useful agent work**. MPC, delegation and runbooks are existing techniques; MPCium supplies signing infrastructure. Our product supplies owner experience, on-chain authority, task policies, shared reservations, real service workflows, recovery and inspection.

The competition demo uses actual Base Sepolia payments, controlled paid browser services, real test-vault operations and accelerated fixed payments. Owner approves once and closes app; paid failure exercises retrieval/fallback; replay cannot charge twice; independent inspection detects altered evidence; confirmed pause blocks old authority. Test tokens, fixtures, simulated risk and earlier finalized transactions are labelled.

Initial customer hypothesis: teams operating agents may pay for reusable financial controls and operational evidence. Adoption, pricing and production safety remain to be validated. No claim that this release already has commercial usage or guarantees competition results.

**Implementation:** [FINAL PLAN](FINAL%20PLAN.md), [PRD](PRD.md), [architecture](architecture.md) and the four handoffs. Four owners jointly qualify the system; the documentation is a specification, not an implemented-product claim.
