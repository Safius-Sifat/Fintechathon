# Security self-assessment (working draft)

Status: development document. It describes the designed controls and their verification status; it is not an audit. Contract-level detail is in [contracts-security.md](contracts-security.md); permission tiers are in architecture S9.12; the compromise matrix is in architecture A9. The competition submission version is assembled from this document by Person4.

## 1. Delegation model

The owner delegates authority to an agent with a **Permit**: an EIP-712 message signed by the owner's local key that names the task, executor, asset, recipients, caps, period limits, review threshold, runbook hash, conditions hash and validity window. It is:

- **Verifiable:** anyone can recompute the signed digest and read the activation from the wallet contract.
- **Scoped and purpose-bound:** `conditionsHash` commits the exact reviewed task; the goal text is display only. `runbookHash` pins the code that runs it.
- **Time-bound:** at most 24 hours (30 days for ALLOWANCE), with per-day or per-week period caps.
- **Revocable:** REVOKE ends one Permit (also before activation); FREEZE stops all agent execution while keeping terms; PAUSE and RECOVER end all Permits by changing the epoch.
- **Enforced, not just presented:** the wallet contract checks every limit at execution, so the API, the agent and the MPC signers cannot exceed it even if compromised.

**No sub-delegation.** An agent cannot pass any part of its authority to another agent, key or contract. Only the owner key creates Permits (tier T4). This is a deliberate safety property: there is no delegation chain to verify, attenuate or revoke hop by hop, and every authority traces back to one owner signature.

## 2. How the design meets common agent-wallet principles

| Principle | Mandate mechanism | Verified by |
| --- | --- | --- |
| Verifiable, scoped, time-bound, revocable delegation | Owner-signed Permit enforced by MandateWallet; REVOKE, FREEZE, PAUSE | Foundry `Authority`, `Payment`, `Admin`, `Freeze`, `Epoch` tests |
| Purpose binding | `conditionsHash` and `runbookHash` in the signed Permit | Schema golden vectors; activation tests |
| Trust without a central lookup | Authority is read from the wallet contract on chain; no registry service | Independent verifier design (S6) |
| Verifiable audit trail | Hash-chained evidence events, Ed25519 checkpoints, on-chain anchors | Verifier (Person4, P4-05) |
| Human oversight | Owner co-signature above the review threshold; NEEDS_OWNER escalation; freeze and pause | Foundry `Cosign`, `Freeze` tests |
| Agent provenance | Runbook hash per Permit; agent runtime, SDK version, model, agent token and MCP toolset hash per decision | Schema `AgentDecisionPayloadSchema` test |
| Minimal disclosure | Only hashes, amounts and addresses on chain; artifacts encrypted with salted commitments, disclosed only in an authorized export | Evidence design (S6) |

## 3. Accountability mapping (EU AI Act–style obligations)

The project is not a regulated deployment; this table shows how each common obligation is evidenced by a mechanism rather than by documentation alone.

| Obligation | Mechanism | Evidence a reviewer can check |
| --- | --- | --- |
| Traceability | Every agent question, answer, approval, payment and alert is a hash-chained evidence event | Export bundle, checkpoint signature, on-chain anchor |
| Record-keeping | Append-only event chain; corrections are new events, never rewrites | Verifier integrity finding |
| Human oversight | Owner approves each Permit natively; co-signs Actions above the threshold; can freeze, pause, revoke or recover without the backend | Contract events `PermitActivated`, `ActionExecuted(ownerApproved)`, `WalletFrozen`, `WalletPaused` |
| Transparency | Agent rationale is shown to the owner and stored, labelled as untrusted model output | `AGENT_DECISION` events with basis `recorder_assertion` |
| Accuracy and robustness | Deterministic policy, pre-sign checks and a post-sign simulation; the contract re-checks every limit | Foundry suites and invariants; sentinel tests (Person2) |
| Accountability for each decision | Each decision names the agent token and the MCP toolset hash it ran with | `agentTokenId`, `mcpToolsetHash` in `AGENT_DECISION` |

## 4. Privacy

- Owner seed, BIP39 passphrase and private keys never leave the phone's native module; the backend never sees them.
- On chain: amounts, addresses, hashes and events only. Task inputs and outputs are committed as hashes.
- Evidence artifacts are encrypted (AES-256-GCM) with salted commitments; plaintext is disclosed only in an authorized export.
- See risk R1 for the main privacy limitation.

## 5. Known risks

| ID | Risk | Mitigation | Residual |
| --- | --- | --- | --- |
| R1 | **Linkability.** One managed wallet per owner makes all of that owner's agent payments publicly linkable on chain, and linkable to funding from the owner's personal address. | Testnet only; no personal data on chain. | Accepted for this release. Per-task wallets or private payment rails are future work. |
| R2 | **No agent attestation.** The runtime, SDK version, model and toolset are recorded, but nothing proves which code actually ran (no TEE or remote attestation). | The contract limits what any code can do; the owner sees decisions and can freeze. | Records are assertions; the verifier reports them as such. |
| R3 | Single-VM MPC: all three MPCium nodes and the policy service share one host. | Contract caps, allowlist, blocklist, co-sign threshold and owner stop still hold (A9). | High against host compromise; disclosed. |
| R4 | No external audit of the contracts. | 120+ Foundry tests, invariants, EIP-170 size test, fork test against real USDC. | Medium; disclosed. |
| R5 | Prompt injection through provider content. | The agent can only pick listed options or bounded amounts; addresses and calldata never come from the model. | Low: a worse allowed choice. |
| R6 | Provider takes payment and does not deliver. | Payment bound to a signed invoice; retrieval and bounded fallback; failure recorded. | Loss limited to the invoice amount. |
| R7 | Rooted or stolen unlocked phone. | Keystore wrapping, biometric per signature. | Owner authority is the root of trust. |
| R8 | x402 facilitator path not yet verified end to end. | Token side verified on a Base Sepolia fork; manifest stays `MANDATE_NATIVE` until gate X402-G. | Interoperability not claimed. |
| R9 | Relayer key compromise. | Relayers hold gas only and have no financial authority. | Gas loss only. |
| R10 | Lying RPC endpoint. | Independent RPC for policy and verifier; the contract checks real state. | Low. |

Severity and test references are updated as each owner's acceptance cases run; see `evidence/person*/`.
