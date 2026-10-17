---
type: product-requirements
title: Mandate Wallet — Product and Delivery Requirements
version: "3.0"
updated: 2026-10-14
target_completion: 2026-10-18
status: specification-not-implemented
---

# Mandate Wallet — PRD

## 1. Decision and document ownership

**Build an owner-controlled agent wallet that purchases useful digital services, operates an approved vault, and executes bounded scheduled payments. Every action must have enforceable authority and inspectable evidence.**

Primary customer: developers and small teams whose agents need paid digital tools. Primary job: let an agent buy a browser check and return the result without an owner approval for every payment. Asset management exists to manage the funds used by those agents.

| Document | Purpose |
| --- | --- |
| [[pitch]] | Product story and named capabilities; no unimplemented capability presented as available. |
| **This PRD** | Product requirements, acceptance, priorities, ownership, deadlines. |
| [[architecture]] | Exact technical interpretation and implementation interfaces. |
| [[review]] | Design audit findings and remaining validation gates. |

All four are version 3.0 and replace inconsistent earlier plans. If implementation requires a material change, update the affected requirement and architecture together, then align the pitch. Repo paths below are proposed implementation outputs. This revision reviews documents, not deployed code.

## 2. Competition requirements and constraints

| Source | Requirement | Our response |
| --- | --- | --- |
| Organizer Topic F | Autonomous on-chain asset management, transaction execution, risk control. | Browser purchase, approved vault deposit/redeem, bounded schedule, enforced denials. |
| Organizer scoring | Completion 40%; security/compliance 30%; innovation/interaction 30%; on-chain bonus 0–5. | Measure outcomes, demonstrate enforcement and inspection, make controls understandable. |
| Organizer deliverables | Architecture/algorithm/security docs; source/README/deploy/test cases; security self-assessment; real transaction hashes. | Release checklist in §11. |
| Organizer presentation | English; presentation ≤10 min; optional demo ≤5 min. | 9-minute deck and 4:45 video. |
| Organizer eligibility | 2–5 eligible students; at least 60% non-Chinese nationals; qualifying overseas institutions; independent work and licensed dependencies. | Verify registration separately; extra helpers must not undermine team-size or independent-work rules. |
| User confirmation | Public testnet accepted. | Base Sepolia with actual transactions; label fixtures and valueless tokens. |
| User deadline | Finish October 18; official October 20, 23:59 Beijing. | Freeze Oct 18; upload target Oct 20, 18:00 Dhaka; cutoff 21:59 Dhaka. |
| User experience | Own wallet app; no external app approval for each agent payment. | Embedded owner approval followed by contract-scoped unattended execution. |

The organizer does not require our particular provider, framework, SDK, MPC design, or demo service. Those are implementation choices. No feature count guarantees a score.

## 3. Scope and release order

**Selected stack:** React Native/TypeScript/Expo development build, Android; Circle User-Controlled EOA owner; Base Sepolia; custom non-upgradeable wallet; executor + guard ECDSA delegation; Node/Fastify/PostgreSQL; one model planner; one DemoUSD token; one ERC-4626 DemoVault.

| Priority | Must deliver | Gate |
| --- | --- | --- |
| P0 — complete financial task | Native owner approval, task permit, guard, contract payment, actual browser output, budget enforcement, replay recovery, evidence export, revoke. | One public-testnet purchase completed by Oct 15 evening. |
| P1 — full Topic F demonstration | Deposit/redeem and liquidity controls; bounded schedule; evidence anchoring/verifier; SDK/MCP and three runbooks; full evaluation. | All required scenarios runnable by Oct 17 midday. |
| Later | iOS/store release, standard x402/MPP adapters, live data services, swaps, additional chains/tokens, real yield strategies, marketplace/reputation, external hardware signing. | Start after Oct 18 freeze and competition submission. |

P0 and P1 are the intended submission. P0 defines the critical path; P1 is not optional marketing scope. If delivery slips, remove unfinished claims and demonstrate the completed path honestly. Do not trade away authority checks, ledger durability, real outputs, or reproducible evidence to add integrations.

### External dependency gate

Within the first four working hours: obtain Circle test access/App ID and Android package credentials; build on a physical phone; create an owner EOA; sign and recover an exact Permit; verify cancellation; compare the reviewed payload with the signing request. Also obtain testnet ETH and prove RPC access.

Circle is a selected dependency, **not a validated integration**. Freeze its viability by Oct 15 morning. A clearly labelled development EOA may unblock local contract work; it does not satisfy the MPC owner feature or justify an undisclosed custody change. If Circle remains blocked, record the submission limitation and avoid claiming the owner experience is complete.

## 4. Features with testable outcomes

IDs below are stable across documents and evaluation files.

| ID / feature | Required behavior | Observable acceptance | Owner |
| --- | --- | --- | --- |
| F01 **Owner Key** | Embedded owner creation/recovery and Permit/Admin signing; no owner key/PIN in our API. Bind every signing session to the app account. | Physical phone signs the exact typed payload; cancelled approval activates nothing; another account cannot access the challenge. | D, C |
| F02 **Task Permit** | Signed financial scope, runbook commitment, expiry, action/paid-attempt caps; exact-action and autonomous modes. | Wrong recipient/token/action, changed exact action, expired or invalidated permit fails at contract boundary. | A, D |
| F03 **Execution Guard** | Independent deterministic checks, signed-scope revalidation, current chain reads, typed construction and exact-call simulation. | Model-generated instructions cannot alter authority; executor signature alone fails; guard produces rule IDs and input snapshots. | C, A |
| F04 **Runbooks** | Browser Check, Liquidity Keeper, Scheduled Pay; versioned inputs, action sequence, output validator, stop/recovery rules. | Each runs through SDK/API; changing its executable version requires new approval; skill prose grants no authority. | B, E |
| F05 **Shared Budget** | Reserve pending amounts; enforce task, executor, and wallet gross limits on-chain; preserve pending liquidity. | Concurrent requests cannot overspend; daily rollover and crash recovery do not free unresolved spending. | C, A |
| F06 **Liquidity Reserve** | Preserve a liquid floor; approved vault only; bounded deposits/redeems, positive output minimums, deposit allocation cap. | Real deposit/redeem; floor/exposure violations fail; withdrawals return to wallet; stale signals block deposits. | A, B |
| F07 **Delivery Check** | Bind invoice/payment/output; validate required checks and freshness; show payment and delivery independently. | Missing result remains failure even after payment; same receipt retrieves output without another charge; negative form result can be valid delivery. | B, E |
| F08 **Recovery Control** | Durable transaction identity; reconcile uncertainty; close completed permits; immediate local stop plus on-chain revoke/pause; recovery to owner. | Restart produces no duplicate transfer; pause invalidates old permits even after unpause; recovery works while paused. | C, A, D |
| F09 **Evidence Inspector** | Durable hash-linked events, checkpoint, chain anchor, export, independent six-part verifier. | Valid export checks; edited export fails; missing artifacts produce UNVERIFIABLE; unanchored tail is visible. | E, C |

### Permission tiers

| Tier | Permitted capability |
| --- | --- |
| Read | Tenant-bound balances, task states, allowed evidence. |
| Prepare | Propose task/runbook, fetch free catalog/quotes, draft authority; cannot move assets. |
| Exact action | Owner signs a permit binding a single ActionIntent hash, one financial action, and short validity. |
| Autonomous task | Owner signs bounded recipients/operations/caps and runbook; agent chooses within that scope. |

App/API tokens identify the caller; contract permits authorize money movement. A token alone cannot create authority. New recipients, wider limits, different runbooks, or changed acceptance terms require a new owner-signed permit. In this build, providers and contracts must also exist in the release manifest; approving an address does not install a new integration.

## 5. Runbook catalog

### RB01 — Browser Check

**Input:** plain-language goal, approved `targetId`, required checks (`pageLoad`, `title`, `formSubmit`), budget, providers, expiry. Explicit checkboxes in the approval screen resolve the model's interpretation.

**Flow:** interpret goal → filter capable providers → obtain quotes → select lowest-priced eligible provider (provider ID breaks ties) → reserve → pay → retrieve output → validate → close permit. The model explains the plan and interprets the goal; deterministic code checks capability, price, authority, and output structure. On delivery failure, retrieve first, then consider an eligible provider not already failed in this task.

**Scope:** PAY/CLOSE; ≤3 paid attempts; ≤8 planning/validation steps; 10-minute task timeout. A/B normally cost 0.20/0.35 DemoUSD. Configure capability/price variants to show that choices respond to inputs. If no service qualifies, return NEEDS_OWNER without payment.

**Output:** requested assertions, signed provider receipt, screenshot references, gross cost, payment/delivery findings, permit closure. Screenshot digests and provider signatures support provenance, not proof of truth.

### RB02 — Liquidity Keeper

**Input:** approved vault, floor, cumulative deposit/withdrawal caps, expiry, desired additional liquid funds or a bounded deposit amount. Authority is separate from RB01.

**Flow:** read balance, reservations, vault conversion/maxRedeem and timestamped signal → propose amount → deterministic eligibility → deposit or redeem → reconcile resulting balance. A warning stops deposits. Withdrawal requires existing WITHDRAW permission; failure stops any dependent purchase.

**Scope:** DEPOSIT/WITHDRAW/CLOSE; one vault; allocation ≤20% immediately after a deposit; preserve liquid floor and pending spending. Passive ratio increases after spending are shown as a warning and block new deposits; this is not a continuously guaranteed allocation ratio. No auto-deposit after every receipt and no yield optimization claim.

**Output:** before/after liquid assets and shares, signal source/time, checks, actual transaction. Monitor every 10 seconds while the task is active; a goal is complete when the authorized funding/allocation request is satisfied.

### RB03 — Scheduled Pay

**Input:** fixed recipient and amount, start, interval, permitted window, period count ≤20, spend cap, expiry ≤24 hours.

**Flow:** worker identifies due period → checks current authority/liquidity → executes once → records outcome. Contract checks the actual inclusion time. A missed period is recorded and skipped; do not combine missed payments. A transaction still unresolved is reconciled before any subsequent spending for that wallet.

**Output:** scheduled/executed/missed periods, remaining cap, transaction references. Scheduling is deterministic; do not present it as a separate intelligent model.

### Common runbook package

Each runbook ships `manifest.json`, input/output JSON schemas, `plan.ts`, `buildAction.ts`, `validateResult.ts`, and a short skill guide. Pin versions and file digests in the release manifest and owner-approved scope. All use F03/F05/F08/F09. No arbitrary URLs, bytecode, contract calls, or shell commands from model output.

## 6. Rules and user experience

All amounts are integer base units; DemoUSD has six decimals. The following are immutable wallet ceilings or stricter signed permit limits, except rows explicitly marked service rules.

| Rule | Initial value / behavior |
| --- | --- |
| Purchase task / payment | ≤2.00 total; ≤0.50 per PAY/TRANSFER; owner can choose less. |
| Executor / wallet daily spend | 5.00 / 10.00; gross PAY+TRANSFER, UTC block-day; all permits share counters. |
| Liquid floor | 3.00 or stricter permit floor; spending/deposits leave it intact. Owner recovery is an explicit exception. |
| Vault | One immutable address; 20% maximum allocation after deposit; exact approvals reset to zero; positive output bounds. |
| Time | Permit ≤24h; signed Action ≤60s from issuance; invoice ≤60s from issuance; exact-action review has a ≤10min permit window but action/invoice expiry still applies. |
| Execution count | ≤20 financial actions/permit; RB01 ≤3 paid actions; closure does not consume this quota. |
| Frequency | Guard ≤5 proposed payments/minute/executor; service rule, not contract guarantee. |
| Gas | Service sponsors gas; default admission estimate ≤0.0005 ETH/tx and 0.02 ETH/day across relayers, including anchors/admin. Include L1 and L2 costs; separate emergency allowance described in architecture. |
| Failure budget | Delivery failure still consumes gross spending. Refunds/inflows do not restore spent allowance. |
| Resume | Reuse logical request/invoice identity; reconcile existing transaction before a new paid attempt. |
| Stop | Local stop is immediate; contract effect begins at confirmed inclusion. Pending actions can settle first. |

### App screens

| Screen | Required content |
| --- | --- |
| Onboarding | App account, embedded owner creation/PIN/recovery, owner and wallet addresses, persistent TESTNET label. |
| Wallet | Liquid, floor, pending reservations, vault value, spendable now, remaining daily allowances; fixture faucet. |
| New task | Goal, selected runbook, interpreted checks/terms, eligible providers, proposed cap. |
| Approve | Human summary and expandable exact terms; chain/token/address, recipients, runbook version, limits, expiry, mode. Reject/approve in app. |
| Task | Decision and current step; separate payment, delivery, completion, and authority-closure states; denial reason and available next action. |
| Assets / schedule | Explicit vault approval, allocation warning, redemption status; schedule windows and missed periods. |
| Inspector / controls | Six findings with evidence links; authorized export; stop/revoke/recovery with local/pending/confirmed states. |

Poll every 2s on an open task and every 10s otherwise. Backend workers run while the app is closed. App copy must distinguish “received a result” from “settlement finalized” and “stopped locally” from “permission invalidated on-chain.”

## 7. Evaluation and release acceptance

No results are claimed yet. Save inputs, release commit, expected/actual results, timings, transaction references, and failures in `evidence/evaluation.json`.

| ID | Case | Required result |
| --- | --- | --- |
| T01 | Approve and close phone | Permitted browser task completes; no further owner action. |
| T02 | Change goal/capability/price | Plan/provider changes appropriately or no payment; required checks remain those approved. |
| T03 | Wrong recipient/action/token; stale/expired authorization | Guard rejects; direct contract bypass also reverts. |
| T04 | Exact-action substitution | Changing any bound action field invalidates the approval. |
| T05 | Two tasks compete for 0.30 remaining cap | At most one 0.20 payment; no reservation or counter overspend. |
| T06 | Crash after signing/broadcast/inclusion; midnight rollover | Resume original logical payment; unknown funds stay reserved; no double accounting. |
| T07 | Paid provider times out or returns malformed result | Payment remains spent; delivery fails; bounded alternative succeeds or task stops. |
| T08 | Vault deposit/redeem; floor/exposure breach; stale signal; withdrawal blocked | Valid operations settle; forbidden ones fail; dependent payment waits or stops. |
| T09 | Schedule early/due/late/repeated | Only a due unused period executes; missed period does not catch up. |
| T10 | Pause → unpause; recovery; delayed old permit activation | Old permits and old drafts remain invalid; new owner authority required. |
| T11 | Modify export / remove artifact / omit chain action | Integrity fails / evidence unverifiable / unmatched chain activity flagged respectively. |
| T12 | Malicious provider text, cross-user API access, revoked agent token | No authority escalation, no cross-tenant data, no new run after token revocation. |
| T13 | DB unavailable; stale RPC; guard unavailable | New signing stops; already submitted work reconciles after recovery. |
| T14 | Complete task but CLOSE transaction delayed | Task result remains visible; authority closure is PENDING, never falsely closed. |

**Evaluation protocol:** run 12 end-to-end cases: six normal purchase cases (two approved page targets × three goal/price/capability variants), two failed-delivery cases, two contention/restart cases, one liquidity case, and one schedule case. Run all T01–T14 security/recovery scenarios, including direct contract calls, separately. Report numerators and denominators; expected denials are not failed legitimate tasks. Repeat normal cases three times for 18 observations; do not generalize a small fixture suite to production reliability. Record each fixture's starting balance/counters; use separate funded fixture wallets where isolation is needed. Public-testnet state cannot be reset like a local chain, and evaluation must not pretend it can.

Compare against a documented **single-provider, payment-only reference flow** using the same services and inputs. It retains basic authorization and idempotency; omit Mandate's fallback and independent delivery/evidence features. Run the reference in local simulation or public testnet with fixture funds only. Do not portray it as a named competitor or intentionally weaken it to manufacture gains.

Measures: valid tasks completed; required checks returned; gross tokens per completed task; redundant charges per logical request; owner interventions after initial approval; time to inclusion and time to output separately; violations accepted; recovery outcomes; inspector findings. Gate release on **zero accepted out-of-scope actions and zero duplicate successful transfers in the defined suite**, every claimed feature having evidence, and no unresolved critical/high implementation defect. Targets are not achieved measurements.

## 8. Team ownership and interfaces

| Owner | Outputs | Handoff / reviewer |
| --- | --- | --- |
| A — contracts/security | Wallet/factory/token/vault/anchor; authority schemas; deployment; contract invariants and bypass cases. | ABI, typed-data vectors, manifest to C/D/E; C reviews permissions and counters. |
| B — agent/runbooks | Goal interpretation, provider selection, bounded runner, liquidity decisions, delivery validation. | Typed proposals/results to C; E checks actual provider compatibility. |
| C — platform | Auth/Circle adapter, API, DB/outbox, reservations, guard, executor/relayers, reconciliation, ledger. | OpenAPI/status/error schema to D/E; A reviews signer boundary. |
| D — mobile | Android app, owner approval/recovery, task/assets/schedules/inspector controls. | APK and approval recording; A verifies displayed versus signed scope. |
| E — integrations/evaluation | Providers/fixtures, SDK/MCP/skills, independent verifier, evaluation, deck/video assembly. | Reproducible cases and evidence bundle; B verifies delivery semantics. |

Four-member allocation: B takes providers; C takes SDK/MCP; A owns verifier review; D assembles presentation/video. Agree these assignments immediately; do not leave “shared” tasks without a named lead. Everyone supplies evidence for their own feature.

## 9. Delivery sequence, Dhaka time

| Date / gate | Work | Exit evidence |
| --- | --- | --- |
| Oct 14 — foundations | Signing spike; freeze V3 schemas; local contract activate/pay/revoke; provider invoice/output; auth skeleton. | Phone signature vector, ABI, actual Playwright output, funded relayers. |
| Oct 15 morning — dependency decision | Confirm native signing; schemas consumed by app/backend; first guard/relayer path. | Explicit Circle go/no-go and recorded limitation if blocked. |
| Oct 15 evening — P0 vertical flow | Public-testnet approval → purchase → output → export → revoke. | First complete task with linked hashes and phone recording. |
| Oct 16 — P1 integration | Vault/schedule; concurrency/recovery; closure/anchors/verifier; SDK/MCP/runbooks. | All feature paths callable and basic failure cases reproducible. |
| Oct 17 midday — evaluation entry | Freeze feature additions; execute defined suite; security self-assessment. | T01–T14 results, metrics, issue list with owners. |
| Oct 18 — release | Fix demonstrated blockers, rebuild APK, finalize docs, record demo/deck. | Tagged reproducible release and complete submission bundle. |
| Oct 19–20 — buffer | Upload, check access/links/English/timing; repair submission blockers only. | Submission receipt before Oct 20 21:59 Dhaka. |

The schedule is aggressive for four or five people. Reduce UI polish and defer all “Later” integrations first. Preserve the complete task and security/evidence path. If a must-have gate fails, label the gap rather than recording an apparent success.

## 10. Demonstration and presentation

**Video target 4:45.** Prepare two wallets: a normal 10.00-token wallet for the user journey, and an explicitly labelled near-cap fixture for denial/concurrency. Keep the recording tied to the release manifest.

| Time | Show | What it proves |
| --- | --- | --- |
| 0:00–0:40 | Goal and readable in-app permit approval | Owner intent and bounded authority. |
| 0:40–1:35 | Agent selects provider, pays, receives actual browser checks | Useful financial task while phone approval is no longer needed. |
| 1:35–2:20 | Paid delivery failure and permitted fallback; replay original receipt | Honest outcome tracking and no duplicate logical payment. |
| 2:20–3:05 | Vault deposit/redeem, unsafe deposit rejection, one due scheduled transfer | Asset management and risk control. |
| 3:05–4:00 | Shared-cap denial; six-part inspector; altered export fails | Independent enforcement and inspectable evidence. |
| 4:00–4:45 | Confirmed stop, rejected old permission, final result/cost | Owner control and precise closure. |

Some chain finalization can outlast the video. Show fresh actions as INCLUDED, and separately inspect a previously finalized run with a visible timestamp. Disclose cuts, fixture failures, accelerated schedule intervals, pre-recorded actions, and simulated vault signals. No fabricated transaction or service output.

Deck target 9 minutes: customer/problem (1), product/runbooks (1), architecture and controls (2), demonstration excerpt (3), measured evidence/limits (1), contribution and next validation (1). The separate 4:45 video is not played in full inside that nine-minute allocation. Keep the detailed security/evaluation appendix available for questions.

## 11. Release artifacts and research traceability

- [ ] Android `app.apk`; installation instructions and tested device/version.
- [ ] Tagged source, dependency lockfiles/licences, README, environment template without secrets, deployment instructions.
- [ ] `deployments/base-sepolia.json`: code/ABI hashes, addresses, keys that are public, versions and commit.
- [ ] `evidence/transactions.json`: purpose, transaction hash, result, chain/block and linked task for every claimed on-chain capability.
- [ ] `evidence/task-export.json`, `verification.json`, `evaluation.json`; independent verifier invocation and trusted manifest.
- [ ] Technical architecture, core algorithm/runbook description, security self-assessment with permission tiers and unresolved risks.
- [ ] English deck ≤10 minutes and optional video ≤5 minutes; eligibility and submission receipt.

| Research lesson | Implemented response | Check |
| --- | --- | --- |
| Useful task and measurable adoption (talks 03, 10, 23) | Paid browser checks, clear customer, outcome/cost metrics | T01/T02; evaluation |
| Intent and bounded loops (04, 09, 19, 22) | Reviewed scope, runbooks, deadlines, closure | F02/F04/F08 |
| Independent controls (02, 07, 16, 17, 25) | Guard + contract; narrow keys/tools | T03/T04/T12/T13 |
| Allocation and staged risk response (05, 06, 15) | Explicit vault permission, fresh signals, stop deposits before permitted withdrawal | T08 |
| Discovery/payment/delivery separation (08, 11, 12, 14, 18, 24, 26) | Catalog, signed terms, delivery validation, separate findings | F07/F09; T07 |
| Identity versus authority, privacy (09, 18, 26) | Scoped tokens + signed permit + encrypted artifacts | T12; security report |
| Settlement is not finality (21) | INCLUDED/FINALIZED and reconciliation | T06/T14 |
| Skills and repeatable operations (13, 16, 22) | Versioned executable runbooks plus instruction guides | F04 |
| Credit creates extra liability (20) | Prefunded wallet; credit excluded | Scope |
| Credible communication across ecosystems (01) | Separate demonstrated facts, assumptions and product plans | Pitch and release review |

Sources: [[01 - Competition Brief Notes]], original competition PDF/extracted text; [[02 - Playlist Video Index]]; [[03 - Playlist Synthesis - Agentic Finance Ideas]]. Technical source checks and design findings: [[architecture]], [[review]].
