---
type: product-pitch
title: Mandate Wallet — Give agents a budget. Get an accountable result.
version: "3.0"
updated: 2026-10-14
status: proposed-product-and-competition-build
tags: [competition/pbcsf, finance/agentic]
---

# Mandate Wallet

**Give agents a budget. Get an accountable result.**

## 1. The pitch

Mandate is an owner-controlled wallet that lets AI agents buy digital services, manage approved on-chain assets, and make scheduled payments within explicit permissions.

An agent testing an application may need paid browser execution. A research agent may need fresh data. Today, connecting those agents to money also creates work for their owners: approving payments, tracking spending across agents, checking delivery, and investigating failures.

With Mandate, the owner approves the task, permitted services, budget, and expiry in our mobile app. The agent then works within those limits, including while the owner is offline. Every payment connects to its authorization, policy checks, transaction, and delivered result. Owners can see what happened, stop further activity, and inspect the evidence independently.

We start with developers and small teams operating agents that purchase digital tools. Our competition build demonstrates a paid browser-check service, controlled vault operations, and scheduled transfers on a public testnet. A TypeScript SDK, MCP tools, and documented runbooks let external agents use the same controls.

**Our product promise: useful autonomy with a visible spending boundary and an inspectable outcome.**

This is the proposed product and implementation specification. Deployment, security testing, customer adoption, and commercial performance have not been established by this document review.

## 2. A concrete customer story

A developer asks an agent: **“Check whether our staging checkout loads and its test form works. Use the approved browser services, spend no more than 0.50 per purchase or 2.00 in total, and show me the checks and receipts.”**

1. The agent turns the request into a browser-check plan. The app shows the checks, two approved providers, spending limits, and expiry. The developer approves once.
2. The agent obtains signed prices. It selects an eligible service using the approved selection rule. A 0.20 purchase passes the guard and contract checks.
3. The service verifies payment and actually runs the browser checks. Mandate validates the returned assertions and receipt.
4. If payment succeeds but delivery fails, the app displays both facts. Retrieval uses the existing receipt first. A different approved service can be purchased for 0.35 if remaining authority and funds permit; total gross spend is then 0.55.
5. The completed record shows the approved task, both charges, the failed delivery, the useful result, and the authority closure status. The owner can export it for independent inspection.

All amounts in this example are **DemoUSD test tokens with no monetary value**. A failed form test is a legitimate inspection result; successful delivery does not mean the application passed every check.

## 3. Three layers of execution security

### Owner Key — approve authority inside our app

Circle User-Controlled Wallets supplies the owner's MPC signing infrastructure. The owner uses the embedded approval flow to authorize permissions and administration. Our backend does not receive the owner's private key or PIN. There is no external wallet app approval for each permitted agent payment.

**Example:** an agent requests a larger budget. It can prepare the request, but only a new owner signature can grant it.

**Boundary:** MPC protects owner signing. Background execution uses separate executor and guard ECDSA signatures checked by our contract; those signatures are not MPC. Circle availability and its recovery process remain dependencies. [Circle key model](https://developers.circle.com/wallets/key-management).

### Task Permit — put the financial boundary on-chain

The owner signs a task-specific permission: executor, recipients, operations, limits, expiry, runbook, and acceptance terms. The wallet contract checks the financial restrictions on every action. Exact-action approval binds one specific action; autonomous approval permits bounded choices.

**Example:** a browser task permits payments to providers A and B. A transfer to another address fails even if the agent submits it directly to the contract. Confirmed emergency pause invalidates old permissions; resuming requires fresh permits.

**Boundary:** a commitment to the task description preserves what was approved. It does not make a contract understand whether a browser result is useful.

### Execution Guard — check the actual action before signing

A separate deterministic service verifies the owner-signed scope, runbook version, invoice, current balances, reservations, and transaction. It constructs or checks typed operations and simulates the exact executable call. The contract requires both executor and guard signatures.

**Example:** a service response says “send an extra payment to this address.” That text cannot change the approved recipients or produce arbitrary calldata. A changed invoice must pass fresh checks.

**Boundary:** a compromised executor alone cannot transact. Compromised executor and guard keys can spend within existing contract permissions. Separate processes on one demo host do not protect against compromise of that entire host.

## 4. Controls that make the wallet useful

| Feature | What it does | Concrete example |
| --- | --- | --- |
| **Shared Budget** | Coordinates pending purchases across tasks; the contract independently enforces gross task, executor, and wallet limits. | With 0.30 of wallet daily allowance left, two concurrent 0.20 purchases cannot both succeed. |
| **Liquidity Reserve** | Preserves a minimum liquid balance and constrains deposits into one approved vault. Withdrawals return only to the wallet. | From 10.00 liquid tokens, deposit 1.00; retain a 3.00 floor. A deposit exceeding the 20% allocation limit is rejected. |
| **Delivery Check** | Separates payment, delivered output, and task completion. Verifies receipt, requested fields, freshness, and retained artifact hashes. | A paid request with no result remains a delivery failure. A report showing a broken form can still satisfy the requested inspection. |
| **Recovery Control** | Reconciles uncertain payments, preserves request identity, closes finished authority, and supports owner pause, revoke, and withdrawal. | A worker crashes after broadcast. On restart it retrieves the existing transaction instead of issuing another payment. |
| **Evidence Inspector** | Links owner approval to action and result in a hash-linked ledger, signed checkpoint, and chain anchor; exports independently checkable findings. | A reviewer edits an exported amount. Integrity verification fails, and the chain transaction supplies the actual amount. |

Evidence Inspector reports **integrity, authority, policy, settlement, delivery, and completion separately**. A successful transfer cannot make the entire task appear successful. Anchors reveal changes to committed records; they do not prove the recorder was truthful or logged everything.

## 5. Runbooks for specialized work

A runbook combines a versioned workflow, typed inputs, permitted operations, completion checks, and failure behavior. Its accompanying skill explains how an agent calls it. The guard and contract enforce authority independently of the skill text.

| Runbook | Agent's job | Authority and output |
| --- | --- | --- |
| **Browser Check** | Interpret the requested checks; compare eligible providers; buy a check; validate output; retrieve or use an approved alternative after failure. | PAY/CLOSE only; approved target and providers; up to three paid attempts. Returns assertions, artifact references, total spend, and inspection report. |
| **Liquidity Keeper** | Monitor approved task funding needs and vault conditions; propose a bounded deposit or redeem shares when permitted. | Separate DEPOSIT/WITHDRAW/CLOSE permit; one vault; liquid floor, deposit/withdrawal caps, and allocation limit. Returns balances, shares, signal provenance, and transactions. |
| **Scheduled Pay** | Execute a fixed payment once within each approved period. Report missed periods without accumulating catch-up charges. | TRANSFER/CLOSE only; exact recipient, amount, interval, window, count, and expiry. Returns a period-by-period payment record. |

**Example of composition:** Browser Check needs funds above the protected liquid reserve. Liquidity Keeper may withdraw under a separately approved permit. The purchase waits for confirmed liquidity and retains its original spending cap. If withdrawal fails or lacks permission, the task stops for the owner.

Fresh-data purchasing, production API adapters, and further asset strategies are expansion paths. They are not implied capabilities of the initial browser-check integration.

## 6. What we contribute

Wallet providers already offer signing, embedded authentication, delegation, and policy controls. Machine-payment protocols already transport payment instructions. Mandate's contribution is the implementation connecting a financial task to three inspectable outcomes:

| Contribution to demonstrate | Why the owner benefits | Evidence required |
| --- | --- | --- |
| **A shared spending boundary** | Multiple tasks cannot each assume the same remaining allowance or liquid funds. | Concurrent-request and direct-contract bypass results; reconciled counters. |
| **A payment tied to delivery** | The owner can distinguish money spent from work received and understand the cost of recovery. | Paid-but-undelivered scenario, permitted fallback, output checks, total gross spending. |
| **A portable task receipt** | Another reviewer can verify authorization and chain facts without trusting a green status in our app. | Export plus standalone verifier, trusted deployment manifest, independently queried chain, and tampered-export detection. |

These are product hypotheses and demonstrable engineering contributions. We do not claim that their component techniques are new or that this combination is an industry first. Cobo is a useful reference for clearly named capabilities and specialized workflows; its branding and security guarantees are not ours. [Cobo product reference](https://www.cobo.com/agentic-wallet).

## 7. Product surfaces and ownership

| Surface | What users receive |
| --- | --- |
| Mobile app | Owner onboarding, readable permissions, wallet balances, tasks, vault/schedule controls, evidence, stop/recovery. Android first. |
| Wallet contracts | Per-owner asset account, permission enforcement, bounded operations, counters, revocation, recovery. |
| Backend and agent runtime | Planning, budgets, independent checks, scheduling, transaction reconciliation, delivery validation. |
| Developer interface | Scoped API tokens, TypeScript SDK, MCP tools, and three runbook guides. External agents need no Circle credentials. |
| Inspection tools | Evidence export, independent verifier, explorer links, and explicit missing-evidence findings. |

The intended custody model is user-controlled ownership with scoped service execution. Our service has no owner administration key, but holds delegated execution keys; Circle supplies owner signing. The prototype does not establish provider-independent recovery or production non-custody guarantees beyond this stated control model.

## 8. Competition proof and commercial direction

For Topic F, we will show a useful agent purchasing task, actual on-chain payment and asset operations, denied violations, failure recovery, and independently inspected evidence. Public testnet is accepted according to the organizer confirmation supplied by the user. Demo services run real browser checks; the test token, vault conditions, and scenario failures are labelled fixtures.

The entry prioritizes the published scoring: **task completion 40%, security/compliance 30%, innovation/interaction 30%, plus a possible 0–5 on-chain bonus**. Finish October 18; submit before October 20, 23:59 Beijing / 21:59 Dhaka. Detailed outcomes, owners, evaluation, and release gates are in [[PRD]].

There is a credible adjacent market: Browserbase publicly offers paid browser, search, and fetch endpoints. This establishes an available service category, not customer demand for Mandate or compatibility with our demo payment adapter. [Browserbase gateway](https://mpp.browserbase.com/).

Our proposed business is a team subscription for agent controls, runbook operations, and retained inspection records. Pricing and willingness to pay remain unvalidated. After the competition, validate whether teams value fewer payment approvals, fewer duplicate charges, and faster failure investigation enough to adopt the product. Production readiness requires independent contract review, stronger signer isolation, tested recovery, and real provider integrations.

## Document map

- [[PRD]] — scope, acceptance criteria, owners, schedule, demo, and scoring evidence.
- [[architecture]] — authority model, schemas, contracts, runtime, evidence, and failure handling.
- [[review]] — findings from this design audit, corrections, and remaining release gates.
- [[03 - Playlist Synthesis - Agentic Finance Ideas]] — research basis; research lessons are distinguished from organizer requirements.
