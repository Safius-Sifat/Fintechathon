---
type: design-review
title: Mandate — v5 Decisions and Integration Audit
version: "5.0"
updated: 2026-10-17
status: planning-review-only
---

# Version 5 — decisions and integration review

> Repository bootstrap added 2026-10-17. Read [README](README.md) and [setup](docs/SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

**Request addressed:** four independently usable implementation handoffs that assemble into one coherent system, incorporating the inspected MPCium infrastructure.

## Decisions now fixed

| Question | Decision / consequence |
| --- | --- |
| Team | Four owners: contracts/schema; platform/policy/MPCium; native owner app; agents/services/inspection/demo |
| MPC | MPCium pinned commit90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2, two nodes, threshold config1 (two required in code), mandatory authorizer on every node |
| Scope ownership | Person2 worker imports Person4 runbooks; Person2 writes evidence, Person4 independently verifies; Person1 controls schema/ABI |
| Owner | Native local EOA, not MPC; no Circle/embedded signing dependency, external wallet popup or server recovery |
| Versioning | Documentation5, unchanged on-chain EIP7124/evidence schema4; no unnecessary redeployment solely from MPC engine change |
| Integration | Identical generated appendix in every handoff, shared fixtures/ABI, explicit source paths and gates |
| Historical plans | Archived both old component-plan folders; new four handoffs are the only active per-person assignments |

## Concrete inconsistencies corrected

1. Factory creation explicitly accepts immutable owner address so a sponsored relayer cannot accidentally become wallet owner.
2. Configured MPC threshold follows inspected t+1 code rather than ambiguous README terminology.
3. Authorizer enabled flag alone is insufficient: required-authorizer list must be nonempty and checked on both nodes.
4. Go client/authorizer use one upstream serialization; repeated Ed25519 initiator signature checked before publish; exact digest/wallet/network/attempt/path binding specified.
5. Person4 has no financial side channel: runbook returns action intent; Person2 owns request ID/signing/journal. Persistent decisionKey and nextState support restart.
6. API amounts/times use integer strings; redemption amount is shares, withdrawal cap measures actual received assets. Native confirmation must display that distinction.
7. UNKNOWN/issued signature cannot silently free reserved funds; history is reconciled before replacement/release. Included/finalized are not double-counted.
8. Inspector can correctly return UNVERIFIABLE on backend-only claims. No requirement to manufacture six PASS findings from signed service assertions.
9. Provider capabilities and use-case fixtures are explicit. A paid-failure fallback requests checks both providers support; formSubmit requirement selects b. Correct budget denials are not counted as delivered inspections.
10. API-offline recovery has actual discovery/read/sign/export/independent-funded-relay steps and distinct owner nonce lane.

## Remaining qualification work — no implementation claim

| Must be proved by implementers | Gate / owner |
| --- | --- |
| Pinned MPCium two-node config/DKG/signature/isolation/required-auth behavior | G1 /2 with1 |
| Native dependency loading, EIP712 scope parity, authenticated Keystore and restore | G1 /3 with1 |
| Actual payment→browser output→export→initial independent findings | G2 /all |
| Node transport ACLs/tunnels, separate administration/backups and safe restore | G3–G4 /2 |
| Race/restart/UNKNOWN/reorg and confirmed stop/recovery behavior | G3–G4 /1,2,3 |
| Verifier historical coverage, canonical hashes, signature/anchor/artifact checks | G3–G4 /4 with1,2 |
| Full system/security/evaluation/release evidence | G4–G5 /all |

No source implementation, deployment, implementation tests or performance measurements were produced by this document update. Dates remain targets, not guarantees. The active plan has no silent full-key fallback. A qualification failure is a named blocker to fix, not grounds to overstate readiness.

## Review method and limits

Read existing PRD/architecture/pitch/master/component documents and competition extract; inspected MPCium public pinned source for threshold, authorization, raw request/client behavior and dependency replacement. Reorganized ownership and cross-component DTOs, signed fields, runbook/provider/evidence contracts; checked document structure/shared appendix identity/links and stale plan routing. Source inspection is not cryptographic review or deployment testing.

Known production risks: shared-host administration can defeat threshold separation; owner key enters native memory; compromised owner device/words threaten custody; controlled vault/risk source/providers/test token are fixtures; hash/anchor does not prove all truth or completeness; private NATS/Consul availability and independent RPC/history availability matter. No winning, production-grade security or industry-first claim.

Sources: supplied competition PDF and [MPCium pinned source](https://github.com/fystack/mpcium/tree/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2). Public testnet acceptance comes from user's organizer confirmation. [FINAL PLAN](FINAL%20PLAN.md) and [architecture](architecture.md) control the actual implementation tasks/interfaces.
