# Competition and research traceability

**Status:** planning reference, not implementation or security evidence. Competition rules below come from the organizer PDF. Video ideas are research inputs; they are not competition requirements. Product status is specified, not built.

Sources: [competition rule notes](</Users/safiussifat/Obsidian-Vault/Research/PBCSF Topic F/01 - Competition Brief Notes.md>), [playlist synthesis](</Users/safiussifat/Obsidian-Vault/Research/PBCSF Topic F/03 - Playlist Synthesis - Agentic Finance Ideas.md>), and [index of 26 videos](</Users/safiussifat/Obsidian-Vault/Research/PBCSF Topic F/02 - Playlist Video Index.md>). The index links to each individual note.

## Official requirements mapped to deliverables

| Official requirement | Mandate response | Evidence to submit/show | Status or caveat |
| --- | --- | --- | --- |
| Topic F: autonomous on-chain wallet for asset management, transaction execution and risk control | Personal wallet plus separately funded managed wallet; bounded agent payments, a controlled vault workflow, deterministic policy and contract checks | Android flow, contract tests/deployment, service task, denial cases and receipt | Planned; no financial implementation yet |
| Task completion — 40% | Complete one real user task end to end and show correct recovery | Actual service output, payment and outcome linked by task ID | Weight is official; no score is guaranteed |
| Security and compliance — 30% | Owner-held local account, bounded permit, policy gate, qualified MPCium, contract enforcement, explicit known risks | Threat model, permission tiers, denial tests, recovery and security self-assessment | MPC topology is planned as three nodes/two required participants on one PoC VM; exact pinned-build quorum behavior remains unqualified |
| Innovation and interaction — 30% | Separate personal/agent funds, concurrent budget reservations, delivery-aware fallback and independent evidence inspection | App demo and independent verifier output | Differentiation claim, not an official judging rubric item by itself |
| Optional on-chain challenge — 0–5 points | Use public Base Sepolia; publish transaction hashes with purpose and outcome | Public explorer links and transaction index | Organizer acceptance of public testnet was confirmed by the user; bonus is optional and not guaranteed |
| Technical documents | Architecture, core algorithm, security design | PRD, architecture, risk assessment | Planned |
| Code and reproducibility | Source, README, deployment and test instructions/results | Repository and release evidence | Planned; current code is a bootstrap only |
| English presentation, at most 10 minutes; optional demo video, at most 5 minutes | Demonstrate a successful flow and a meaningful rejection/recovery flow | Deck and optional edited video | Planned |
| Eligibility and registration | Team has 2–5 eligible full-time students at qualifying overseas institutions; at least 60% are non-Chinese nationals | Team registration and organizer confirmation | Administrative check: for a 4-person team, at least 3 must meet the nationality threshold. The project cannot establish eligibility from code. |
| Official deadline | Submit by 20 October 2026, 23:59 Beijing time (21:59 Dhaka time) | Submission confirmation | Internal target 18 October 2026, 18:00 Dhaka time is a team target, not an organizer rule |
| Integrity and third-party material | Track licenses and attribute SDKs, dependencies, datasets and borrowed code | Dependency/license inventory and references | Must be completed before submission |

## Playlist ideas mapped to product decisions

The statuses mean: **adopted** = a concrete release mechanism; **adapted** = the principle is used within the smaller testnet scope; **deferred** = intentionally outside this release; **framing** = informs the story, not a feature. Video numbers and titles match the 26-entry Obsidian index.

| # | Video idea | Mandate decision and status |
| --- | --- | --- |
| 01 | Opening: agentic finance context | **Framing.** Explain the problem; no standalone feature. |
| 02 | Enterprise spend controls and trust | **Adopted.** Task permits, gross caps, expiry, pause and a readable evidence trail. |
| 03 | Capital allocation and treasury | **Adapted.** Owner chooses/funds a bounded task; no portfolio manager or autonomous treasury. |
| 04 | Programmable strategy | **Adapted.** Exact typed task terms, windows and stop conditions; no general strategy engine. |
| 05 | Risk as an asset class | **Adapted.** Risk checks and a labelled fixture gate the controlled vault; no insurance or risk-token product. |
| 06 | Yield for agents | **Adapted.** One testnet vault workflow; no yield promise or autonomous protocol search. |
| 07 | Institutional settlement controls | **Adopted.** Pre-sign policy checks, independent authority, transaction journal and explicit settlement states. |
| 08 | Payment rail selection | **Adapted.** One known testnet payment asset and approved recipients; no multi-rail router. |
| 09 | Consent, liability and audit trail | **Adopted.** Owner-signed scope and inspectable evidence; disclose what the verifier cannot prove. |
| 10 | Agent adoption | **Adapted.** Report task success, spend, failure/recovery and evidence coverage; do not claim production adoption. |
| 11 | x402 agent payments | **Adapted (v7).** Providers return x402-formatted 402 responses next to the signed Mandate invoice; settlement is Mandate-native. ERC-1271 x402 settlement is claimed only after gate X402-G passes (architecture S9.10). |
| 12 | Discovery, trust and settlement | **Adapted.** Allowlisted providers and separate payment, delivery and completion; no open marketplace or reputation score. |
| 13 | Agent operating system and skills | **Adopted.** Typed, versioned runbooks plus SDK/MCP access through the same policy boundary. |
| 14 | Cross-asset routing | **Deferred.** No swaps, bridges or route optimizer in this release. |
| 15 | Quantum optimization | **Framing only.** No quantum service or optimization claim. |
| 16 | Agent finance SDK and wallet | **Adapted.** Typed SDK/MCP methods expose proposals and permitted tasks, not a raw signer. |
| 17 | Secure agent workspace | **Adopted.** Separate agent runtime, policy authorizer and signer hosts; host separation still needs operational proof. |
| 18 | Agent identity, reputation and verification | **Adapted.** Bind provider identity and signed claims to records; identity is not owner authorization or proof of honest work. No reputation system. |
| 19 | Judgment in agent commerce | **Adapted.** Agent may compare approved service offers; deterministic policy decides whether the resulting payment is allowed. |
| 20 | Credit for machines | **Deferred.** Prefunded balances only; no credit, borrowing or underwriting. |
| 21 | Blockspace and faster settlement | **Adapted.** Distinguish submitted, included and finalized; no preconfirmation or MEV-protection service. |
| 22 | Financial intent and agent loops | **Adopted.** Persist task intent, budget, deadline, checkpoints and stop conditions for restartable work. |
| 23 | Agent payment stack | **Adapted.** Separate provider discovery/terms, authorization, settlement and service verification; no general payments marketplace. |
| 24 | Coinbase x402 vision | **Adapted (v7).** Same scope as row 11; no interoperability claim until gate X402-G passes. |
| 25 | Microsoft future web/payments | **Adapted.** Keep payment tooling replaceable; demonstrate low-value testnet payments only. |
| 26 | Cloudflare agent identity/security | **Adopted.** Separate agent identity from owner authorization; minimize sensitive data in receipts. No standards interoperability claim. |

## Product precedent versus our implementation

| Precedent or concept | What we take as a design reference | What Mandate actually proposes |
| --- | --- | --- |
| Cobo’s Pacts, MPC and Recipes | Scoped human authorization, distributed signing and repeatable workflows | Owner-signed on-chain task permits, MPCium with a separate required policy authorizer, and typed runbooks. This is not Cobo’s architecture, does not claim equivalent security, and must pass its own topology/recovery gates. |
| Embedded wallet SDKs | Usable wallet/account primitives | Local owner key generation/signing plus an app-controlled account experience. A provider SDK is not itself Mandate’s policy, contracts, evidence or delivery verification. |
| x402 and Cloudflare MPP | Machine-payment protocols can simplify service checkout | x402-formatted responses are in v7 scope, with interoperability claimed only after gate X402-G. MPP stays out of scope. |
| Playlist research | Bounded autonomy, clear consent, deterministic checks and evidence from intent to outcome | Use the traceability above; video claims are inspiration and are not independently validated product guarantees. |

## Demo proof and measures

The PRD’s existing acceptance gates remain authoritative. The demo must show: (1) an owner creates/funds a managed wallet and approves exact scope; (2) a valid runbook completes a useful task with a public testnet transaction; (3) an altered recipient, excess amount, expired permit or unavailable policy authorizer is rejected with a recorded reason; (4) a provider failure is recovered only within remaining scope; and (5) an operator stops one MPCium node during a task and the other two complete signing, then stops a second node and shows a fail-closed denial with no transaction broadcast and a retained reservation; (6) restart recovers node readiness from persistent share storage without key regeneration; and (7) an independent verifier distinguishes authority, settlement, delivery and completion. Show actual hashes and results, not screenshots of simulated success. Label that all three nodes ran on one VM and do not claim host-compromise resilience.

Report measured counts from the exact demo run: eligible tasks, completed tasks, correctly denied unsafe requests, duplicate payments, total paid, failed/recovered tasks, transaction status, evidence checks passed and checks that remain unverifiable. Label the run size and test fixtures. Do not infer production reliability from a small demo.

## Readiness finding

The documents are substantially aligned with the competition and the research themes. **The implementation is not ready:** the repository currently has a health-only API, placeholder mobile screen, shared type/layout foundations and no deployed financial contracts, wallets, MPC nodes or end-to-end tests. The planned release scope is much larger than a single demo. Treat every feature as unbuilt until its owner supplies the required acceptance evidence. The three-node/two-participant proposal is a release gate until DKG, pairwise signing, one-node outage, two-node fail-closed, authorizer and signature-recovery cases pass. The shared VM is a PoC trust boundary, not host-compromise protection. Do not tell judges that the product is implemented, audited, equivalent to Cobo, or guaranteed to win.
