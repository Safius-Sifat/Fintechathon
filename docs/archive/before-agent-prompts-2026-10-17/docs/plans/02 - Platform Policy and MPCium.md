---
type: implementation-handoff
title: Person 2 — Platform Policy and MPCium
version: "6.0"
updated: 2026-10-17
status: specified-not-built
owner: Person2
---

# Person 2 — Platform, Policy and MPCium

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: execute the numbered tasks in order and save real acceptance results. The identical appendix defines interfaces with the other three owners. You own the runtime and signer integration; do not delegate an unspecified missing service to another person. Implementation agents may execute directly without subagents.

**Goal:** deliver account authentication/sessions, assets/history, owner-transfer relaying, durable agent execution, qualified MPC signing, policy enforcement and inspectable exports.

**Architecture:** API/worker/Postgres on host A; MPC node0 and Go adapter on A; separately administered host B runs MPC node1, deterministic policy service and Go authorizer. Both nodes require the policy authorizer. NATS/Consul are private infrastructure. One combined executor signature reaches the wallet; the owner's key never reaches either host.

**Stack:** Node22/Fastify/Zod/viem/PostgreSQL16; Go1.25.8; MPCium commit `90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2`; upstream's pinned Fystack tss-lib fork. No custom cryptography/C++ transport/embedded-wallet provider.

## Start here — current release scope and task order

**Required:** the complete personal-wallet and managed-agent flows in S8. **Deferred:** WalletConnect/external dApp connections; no WalletKit dependency, Reown projectId, dApp screen or pairing acceptance gate. External agent SDK/MCP access remains required.

Sections 2–6 and the wallet tasks in section 7 are one delivery. Follow the sequence below; wallet tasks are not work postponed until after the agent-only path. Existing bootstrap source needs W0 migration before new financial signatures. Documentation6, wallet domain5, Login2 and agent receipt/runbook schema4 remain unchanged by this handoff revision.

| Work order | Task IDs | Deliverable / dependency |
| --- | --- | --- |
| Auth and API foundation | `P2-03 + P2-W01` | Implement Login2, account isolation, native refresh rotation/session revocation and business migrations against Person1’s W0 schema commit. |
| MPC qualification | `P2-01 + P2-02` | In parallel, prove the pinned topology and exact-request mandatory authorization; the upstream minimum-node discrepancy is a blocker until resolved. |
| First integrated payment | `P2-04 + P2-W03` | Connect durable reservations/worker/relayer and managed owner-transfer draft/submit; retain separate authority and nonce lanes. |
| Wallet continuity | `P2-W02 + P2-W04` | Provide actual assets/history/backfill/reorg coverage, indexer credentials and outage/session behavior. |
| Evidence and operations | `P2-05 + P2-06` | Export inspectable records; qualify deployment/restore and report original-agent plus wallet gates. |

**Completion record:** for each task record source commit, shared-schema commit, command/device or chain reference, observed result and known gaps. Unrun or failed cases stay incomplete. Both original G/Q and wallet W/WQ gates apply; no acceptance or implementation tests were executed by updating this document.

## 1. Complete outputs and trust boundaries

| Output | Owned location | Required behavior |
| --- | --- | --- |
| Public service | `apps/api/src/{auth,accounts,assets,activity,transactions,wallets,tasks,permits,admin,tokens,evidence}` | Appendix routes, Login2/sessions, history, owner transfers, tenant isolation and idempotency |
| Durable runtime | `apps/worker/src/{jobs,advance,reservations,execution,relayer,reconcile}` | Shared runbook driver; one logical action across retries/crashes |
| Storage | `apps/api/migrations`, `apps/api/src/db` | Constraints/locks/leases/outbox, refresh families/revocation, history coverage and encrypted artifacts |
| Policy service | `services/policy/src/{load,validate,rules,authorize}` | Independently reload owner scope, immutable Action and current chain state |
| MPC Go adapter | `services/mpc-adapter/{cmd,internal}` | Build exact signed requests, route results, normalize/recover EVM signature |
| MPC Go authorizer | `services/mpc-authorizer/{cmd,internal}` | Verify initiator+policy-approved exact bytes, authorizer key only on B |
| Operations | `infra/{compose.dev.yaml,host-a,host-b,mpcium.lock.json}`, `docs/platform-operations.md` | Private authenticated services, independent shares/backups, restore and deploy |
| Evidence | `apps/worker/src/evidence`, `evidence/person2` | Ledger/artifacts/checkpoint/anchor/export with no secret leakage |

Person1 supplies ABI/schema; Person3 signs owner Login2/Permit5/Admin5/OwnerTransfer5; Person4 supplies runbooks/providers and independent inspector. You provide the stable backend those components use. Person4 cannot call a generic signer or bypass your worker.

## 2. Prove MPCium first

### P2-01. Pinned two-node setup and EVM signature, G1

**Create:** `infra/mpcium.lock.json`, development compose, deployment templates, Go adapter package, `evidence/person2/mpcium-qualification.json`.

- [ ] Pin exact MPCium commit above plus `go.sum` and resolved images; record the replaced dependency `github.com/fystack/tss-lib/v3 v3.0.1`. Retain Apache2.0 notices. Do not claim the complete integration is audited.
- [ ] Use **two nodes with `mpc_threshold: 1`**, meaning2 participating signers in the inspected t+1 implementation. Do not copy README's `mpc_threshold:2` as2-of-2. Run DKG and prove neither node can sign alone. If upstream startup rejects this configuration or signing fails, stop G1 and fix/version the integration; no assumption that this design already ran successfully.
- [ ] Provision encrypted per-node identity and Badger share storage with different passwords/backup credentials. Generate node private identities on their own hosts and distribute public peer identities only; do not leave both private keys/share backups on a bootstrap machine. Generate one common32-byte chain_code as upstream requires; no child derivation in release (`DerivationPath` canonical empty). Generate one executor master wallet per Mandate wallet, no shared derived customer key tree. Set max_concurrent_keygen=1 and max_concurrent_signing=1 initially. Keygen is an administrative command, unavailable to end-user agent tokens.
- [ ] Enable `authorization.enabled:true` and **nonempty `required_authorizers:[mandate-policy-v1]` on every node**; public key on A+B, private policy-authorizer key only on B. Refuse application readiness if config is disabled/missing/empty/mismatched. Keygen also requires this authorizer through an explicit administrative ceremony; reshare is denied in release.
- [ ] Private NATS JetStream and Consul only; configure server TLS and client authentication/ACLs supported by pinned build, restricted firewall/VPN, Consul ACL token and encrypted disks. Verify unauthorized publish/read/register attempts fail. Inspect actual upstream TLS/config options rather than assuming every SECURITY.md claim is enabled. If native client cannot support required TLS authentication, keep all endpoints bound to authenticated encrypted private tunnels and document this transport boundary. Never expose plaintext services publicly.
- [ ] Register result handlers **before publishing**, set stable unique adapter ClientID `mandate-adapter-a`, permit one active client process with that ID, serialize sessions per key. Match response walletId+TxID+expected key/digest; never accept an arbitrary success from result topic.
- [ ] Decode R/S/recovery returned by ECDSA path; pad r/s to32 bytes, normalize low-S with vetted secp256k1 library and adjust/recover parity, produce canonical65-byte Ethereum signature. Recover expected executor on original32-byte Action digest, including leading-zero digest vectors. No extra hash/text signing. Verify in viem and Person1's Solidity test harness.

**Acceptance:**20 sequential fresh requests validate; node0 alone and node1 alone fail; missing/wrong authorizer fails; mutated request fails; node restart does not substitute full-key signing. Save public vector/timing/config hashes, not private MPC transcript/share data.

### P2-02. Exact request authorization, G1–G2

**Create:** adapter `request.go`, authorizer `authorize.go`, policy `authorize.ts`, private endpoint contract test.

Use upstream **Go** client/types at the same commit. This avoids dependence on a separately versioned TS client's serialization. Our public TypeScript SDK calls the API, never MPCium directly.

```text
internal SignAction(actionId) — no raw digest input
1. Adapter loads committed Action, Invoice and Permit; recomputes EIP712 digest.
2. Build SignTxMessage:
   KeyType=secp256k1, WalletID=registered MPC UUID, TxID=signing attempt UUID,
   NetworkInternalCode="eip155:84532", Tx=exact 32 digest bytes,
   DerivationPath=nil (frozen by golden Go JSON fixture).
3. Sign msg.Raw() using A's local Ed25519 initiator.
4. Send {actionId,attemptId,message} over authenticated private channel to B.
5. B independently verifies initiator signature and runs policy on stored data;
   compare wallet/key/network/path/TxID/Tx against reconstructed expected message.
6. B uses upstream ComposeAuthorizerRaw(message), signs those exact bytes with
   policy-authorizer Ed25519 key, returns only required authorizer signature.
7. Attach signature; Go client.SignTransaction signs Raw() again and publishes.
   Ed25519 is deterministic: assert repeated initiator signature unchanged.
8. Both nodes verify initiator + required authorizer before threshold signing.
9. Recover executor from returned signature; persist before sending to relayer.
```

`POST /internal/sign-actions {actionId}` on adapter returns202 `{actionId,attemptId,state}`; `GET /internal/sign-actions/:actionId` returns same stored status or `{actionId,attemptId,keyVersion,executorAddress,signature,state:'SIGNED'}`. Private caller is worker only. `POST /internal/authorizations {actionId,attemptId,message}` is Go authorizer on B; its local-only call `POST /internal/policy/check {actionId,attemptId,message}` returns `{allowed,ruleIds,expectedDigest,expectedMpcWalletId,expectedNetwork,expectedTxId,expectedDerivationPath,chainBlock}`. B compares every field before authorizing. Policy never accepts caller-supplied expected digest as truth. `GET /health/ready` reveals status only, not config/keys.

- [ ] B reads immutable owner-signed records through restricted DB role, verifies owner signature/hash commitments and queries its own RPC at one recent block. It does not trust API's admitted flag, current balance claim or model explanation.
- [ ] Check current active epoch/time, installed runbook/hash, Conditions, target/recipient, token/vault, quote/provider signature, request identity, quotas/floor, durable reservation and rate≤5proposals/min/executor. Deposit also fresh NORMAL signal/preview-derived minOutput with≤50bp margin; no available liquidity from pending withdrawal. Compare exact invoice/input binding.
- [ ] Store attempt UUID→business action/digest/keyVersion before publish. Unique attempt and explicit message fingerprint; signed request has no independent policy-expiry field, so contract Action deadline and replay IDs remain mandatory. Replayed queue messages cannot create a second payment. Do not claim authorizer itself provides on-chain nonce protection.
- [ ] Serialize per executor, bound timeouts/queue length; on uncertainty record SIGNING_UNKNOWN. No mid-protocol state restoration, custom nonce cache or automatic reuse of ephemeral state. Reconcile before new attempt on same business action; fresh upstream session only after safe abort. Completed action returns stored signature/status.
- [ ] Deny remote reshare/keygen routes and arbitrary digest signing. Local keygen ceremony uses fixed planned walletId, admin operator approval and authorizer binding. Agent bearer tokens never reach either Go endpoint.

**Acceptance:** initiator compromised alone cannot get unauthorized Action signed; authorization for one digest/wallet cannot authorize another. B unavailable stops new signing. Document that both share hosts compromised can bypass off-chain authorizer checks, while wallet caps remain enforced.

## 3. API and persistent financial runtime

### P2-03. Database, auth and provisioning, G0–G2

**Create:** migrations for users, wallets, auth_challenges, agent_tokens, tasks, permit_drafts, permits, actions, reservations, signing_attempts, transactions, jobs/outbox, events, artifacts, checkpoints, idempotency_keys.

- [ ] Unique owner wallet; wallet/requestId; wallet/invoiceId; task/decisionKey; schedule permit/period; sender/nonce lineage; task/event sequence; tenant/route/idempotency key. Decimal strings map to Postgres numeric(78,0); never JS Number for funds. Add state/tenant foreign-key checks.
- [ ] Signed Login2 as S8, nonce once transactionally,≤5min challenge,15min revocable-session JWT/native refresh, origin/deviceId pinned; rate-limit. Hash-store32-byte random scoped tokens, reveal once; default no evidence scope. Every route checks owner and wallet/task restrictions. No tenant identifiers trusted from token caller alone.
- [ ] Implement S4 routes/OpenAPI and sample responses. Authenticated POST wallets relays factory.createWallet(owner), waits inclusion, then administers per-wallet DKG; mark READY only when manifest-matched wallet and executor available. Do not return fake address while provisioning.
- [ ] Interpret runbook goal via Person4's prepare function before draft. Owner terms may tighten defaults; invalid/ambiguous interpretation stays AWAITING_OWNER/NEEDS_OWNER. Draft fresh nonce/epoch and hashes; one outstanding draft per wallet. Activation validates returned signature and unchanged immutable draft before sponsored submit.
- [ ] Admin draft immediately sets local inhibit on pause/revoke, but API labels unconfirmed until chain ordered; independent emergency lane, owner signature verified, no MPC requirement. Recovery does not need an active task.
- [ ] Add durable jobs with leased row locks, SKIP LOCKED, heartbeat, bounded retry and transactional outbox. API process can restart without losing scheduled task or approval.

**Acceptance:** phone signs actual Login/Permit; no password/vendor auth; cross-tenant/read-run/evidence violations fail; duplicate HTTP mutation returns same logical record, differing body409.

### P2-04. Reservations, worker and transaction journal, G2–G3

**Create:** worker reservation/advance/execution/relayer/reconciliation files.

- [ ] Import Owner4 `advance` and S5 schemas; task lease reads snapshot and atomically commits decisionKey/action/runbookState/events/job. COMPLETE records delivery outcome; enqueue separately signed CLOSE only if authority still usable. User outcome does not imply permission already closed.
- [ ] Lock wallet+permit in stable order. Compute each spend total as chain-included actual spend plus unresolved not-yet-included reservations; finalized is a subset of included, never added twice. Exclude included outflow from liquid reservation subtraction because chain balance already includes it. Pending deposit reserves liquid, pending redeem adds none. UNKNOWN reservations survive restart/day rollover; later refunds do not reset gross.
- [ ] Serialize one outstanding financial transaction per wallet. Proposal prep may be concurrent; serialize signing per executor; count accepted pending requests against caps. `spendable=max(0,chainLiquid-effectiveFloor-unincludedOutflowReservations)`. Risk reads and reservations are explicitly off-chain assertions in evidence.
- [ ] Fill immutable Action requestId/time once. Run pre-sign checks, invoke Go adapter by actionId, persist signature, simulate exact execute, then build relayer tx. Journal sender/nonce/chain/raw signed bytes/hash/payload BEFORE RPC broadcast. Retry exact raw bytes; fee replacement retains nonce/business calldata and records all hashes.
- [ ] If simulation fails after signature exists, mark action denied for broadcasting but retain risk reservation until executable authority/chain history safely resolved. No automatic release on deadline alone; an earlier unknown inclusion could exist. For known reverted transaction release unused reserved amount, record actual gas.
- [ ] Poll2s; three canonical confirmations INCLUDED, RPC finalized head FINALIZED; UNKNOWN at60s and attention120s keep funds reserved. Reorg removes provisional receipt and pauses dependents until reconciled. Inspect full nonce/hash lineage and chain logs before deciding no payment happened.
- [ ] Three funded sender lanes normal/emergency/anchor; reserve fee estimate incl L1+L2+20% buffer. Admission≤0.0005ETH/tx,≤0.02/day with0.002 emergency partition. Insufficient fee budget stops new normal work; owner independent relay remains possible. Record estimated/actual fees separately.

**Acceptance:** kill processes before/after signing, journaling, broadcast and inclusion; original logical request resumes without duplicate transfer. Two tasks racing for insufficient remaining allowance cannot both be admitted or settled beyond contract caps.

## 4. Evidence, operations and qualification

### P2-05. Ledger/export and independent consumer, G2–G3

- [ ] Implement exact S6 append-only event/hash/checkpoint format. Retain original owner typed data/signature, scope/manifests, immutable actions/invoices, public MPC authorization result/digest/keyVersion, tx lineages/receipts, provider bytes/receipt, recovery and CLOSE status. Never log secrets/round material or hidden reasoning.
- [ ] Store artifact ciphertext/AAD/unique IV/salt, restrict authorized task access,30day expiry and deletion record. Export decrypted bytes+salt only for explicit owner/evidence-scoped token; filenames normalized, zip paths bounded, no permanent public links.
- [ ] Sign checkpoint Ed25519 and enqueue bounded anchor publication. Return provisional export before finality with explicit pending findings; later terminal/reconciled checkpoint anchors final chain. Avoid self-referential anchor inclusion.
- [ ] Export one documented bundle at G2 for Owner4. Compare canonical bytes/hashes byte-for-byte with shared fixture. Do not make backend's own verdict authoritative for inspector. Preserve original facts when integrity/tamper test changes an exported copy.
- [ ] Scan for supported-asset outflows without stored action and alert/freeze new signing pending inspection. Evidence omission remains a limitation; no claim hash-chain proves every event true.

### P2-06. Deployment, restoration and release, G3–G5

- [ ] Deploy A/B with separate accounts/secrets/admin controls; infrastructure single NATS/Consul may be availability bottleneck, acknowledged. Nodes are online while owner offline. Go adapter key permits requests; authorizer key approves requests; neither is Ethereum executor share or owner key.
- [ ] Encrypt separate long-term node backups and DB/artifact backups; keys outside archives. Restore into isolated environment with signing disabled, reconcile jobs/attempts/journal/chain before fresh signing. Never restore mid-sign ephemeral state as executable session.
- [ ] Lost/compromised signer → local inhibit, owner confirmed pause/revoke, fresh per-wallet DKG/new executor, fresh owner Permit. No full-key reconstruction or unqualified reshare workflow. Owner can recover supported funds through independent CLI even if both hosts unavailable.
- [ ] DB/RPC/stale snapshot/NATS/Consul/policy failure → no new signing. Record previously released signatures as possibly usable until revoked/expired and chain reconciled. Test participant outage, wrong initiator/authorizer, mixed client result, API-offline recovery and backup restoration.
- [ ] Supply exact `.env.example` names with descriptions but no secrets, health/readiness endpoints, deploy/restart/backup/loss guide, image/source pins, fee/faucet funding checklist and clean-start demonstration.
- [ ] Cross-review with Person1 financial rules, Person3 API/owner flow, Person4 schema/export/driver. Deliver platform security report/test results/cost data with actual commit and final deployment manifest entries.

## 5. Verification commands and pass conditions

Implement root targets `make check-platform` and `make check-integration`; package commands include policy/API/worker tests and `go test ./...` in adapter/authorizer modules. Test code should contain specific assertions such as:

```ts
expect(secondSameIdempotencyKey.actionId).toBe(first.actionId);
expect(await tokenCanReadAnotherWallet()).toBe(false);
expect(await reservedAfterUnknownRestart()).toBe(reservedBeforeCrash);
expect(await requestsWithoutRequiredAuthorizer()).toEqual({signed: false});
```

Qualification matrix: auth replay/scope; amount/hash mutation; cap race; signed-before-broadcast crash; response-lost-after-broadcast; failed simulation after signing; UTC rollover with UNKNOWN; receipt reorg; node unavailable; wrong authorizer; restarted consumer; finality distinction; API-offline recovery; export round trip/tamper. Use valueless fixtures for fault injection. Provide exact case IDs and observed state transitions, not only a green aggregate.

**Done means:** API and worker complete phone-approved real tasks while owner offline; either MPC node alone cannot sign; policy approval is mandatory; payment/reservation never duplicates under documented failures; verifier consumes authentic exports without your server.

## 6. Reference implementation details

Sources inspected2026-10-17: [MPCium](https://github.com/fystack/mpcium/tree/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2), [t+1 participant logic](https://github.com/fystack/mpcium/blob/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2/pkg/eventconsumer/sign_consumer.go), [authorizer requirement](https://github.com/fystack/mpcium/blob/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2/pkg/identity/identity.go), [signed request bytes](https://github.com/fystack/mpcium/blob/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2/pkg/types/initiator_msg.go), [Go client](https://github.com/fystack/mpcium/blob/90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2/pkg/client/client.go). These support integration choices, not a claim this plan has already passed qualification.

## 7. Complete-wallet platform — required v6 tasks

Keep financial execution, account sessions and chain facts separate. The native personal wallet must continue to read/send through RPC when this backend is unavailable. S8 gives exact new routes/native interfaces and does not authorize server-held owner keys.

### P2-W01. Sessions and account isolation, W0–W3

**Files:** `apps/api/src/auth/{challenge,verify,refresh,logout,sessions}.ts`, migrations for sessions/refresh_token_families; task/owner authorization middleware.

- [ ] Implement Login2/deviceId one-use≤5min challenge. Successful native signature issues15min JWT with owner/session/audience/auth_time plus random32byte refresh token delivered to NativeSession, not persisted in RN AsyncStorage. Preserve opaque owner addresses, never upload seed/passphrase/derivation secret.
- [ ] Hash refresh tokens at rest, atomic rotation/family replay revocation, single-flight refresh,7day idle/30day absolute expiry. Refresh preserves original auth_time. Response-lost refresh asks for fresh native login; no insecure reuse grace silently accepts replay.
- [ ] Check revoked session on every private API call; auth store outage denies backend access. List/revoke sessions for selected owner; other/all-device revoke requires actual signed-login auth_time≤5min, not a refreshed JWT timestamp. Logout revokes session only, never pretends to stop on-chain agents.
- [ ] Store independent per-address owner contexts; same seed's different EOAs are not one backend identity by assumption. Every account/assets/history/session/transfer route enforces JWT subject. No agent scope reaches owner-transfer or session administration.
- [ ] Supply response/error examples to Person3: expired challenge, fresh-login required, token replay/family revoked, session missing, backend unavailable. No seed/address regeneration on auth failure.

**Finished:** account A token cannot see B data, revoked session is rejected, local wallet funds/keys remain usable after logout/expiry. WQ02/09/10 have observed results.

### P2-W02. Assets, indexed activity and reorg reconciliation, W1–W3

**Files:** `apps/api/src/{accounts,assets,activity,transactions}`, `apps/worker/src/history/{etherscan,verify,backfill,reorg}.ts`, public-activity/cursor migrations.

- [ ] Configure Etherscan V2 server-only API key for chain84532, verify account endpoints/quota with real credentials during setup. Fetch normal/token/internal transfer pages; normalize provider pagination/rate errors and never interpret error/no quota as zero history. Required key/config are explicit resources; no assumed anonymous Blockscout fallback.
- [ ] Verify canonical block/receipt/log/token movement through independent RPC. Internal traces may remain indexer assertions. Track personal backfill separately from managed contract deployment coverage, with source, block range/cursor/indexed-through/gaps/reorg checkpoints.
- [ ] GET assets/history/detail returns S8 typed DTOs and coverage; cache stale data explicitly. Native current balance is RPC authoritative; history source cannot invent spendable totals. Deduplicate registered personal tx hashes with on-chain discovery and preserve replaced hashes.
- [ ] Add incoming ETH/ERC20, funding between personal↔managed, agent transactions, owner governance and vault entries. No double-counted personal-to-managed funding cost and no manual owner outflow misclassified as agent-budget violation.
- [ ] Accept submitted personal tx hash only from authenticated matching owner context, verify actual involvement; it is a public tracking reference, not signed authority. Do not accept owner keys/raw signed personal transfers.

**Finished:** restored wallet sees earlier activity with coverage; indexer outage yields stale/unavailable state, not empty verified account. WQ04/05/06/11/13 are covered.

### P2-W03. Managed owner transfers and outage route, W2–W3

**Files:** `apps/api/src/wallets/owner-transfers`, journal/reconciliation/reservation/inhibit services.

- [ ] Implement draft/submit from S8 using domain5 OwnerTransfer and separate nonce/current epoch. Draft calculates real asset metadata, sponsor fee status and stop-agent effect; only owner JWT may request it, and only native owner signature executes it.
- [ ] Inhibit new agent work on preparation; coordinate Admin/owner-transfer nonce lanes and re-read epoch. Persist immutable typed command/signature/raw relayer transaction before broadcast; duplicate idempotency key returns original operation. If signature/tx uncertain, retain relevant risk locks until chain reconciliation.
- [ ] On canonical success, record OWNER_CONTROL, paused/new epoch and actual amount/fee payer; invalidate old permits/reservations only after full reconciliation of prior potentially included work. On revert do not falsely report paused or funds sent.
- [ ] Sponsor availability failure explains personal-account gas or independent signed-command relay; no server consent is needed for those routes. Share exact simulation/ABI/gas behavior with Person3; do not add a generic raw signing API.

**Finished:** native personal RPC send works with API stopped; managed owner transfer can be independently relayed; active task records correctly reflect owner intervention rather than fabricated delivery completion.

### P2-W04. Full app operational qualification, W4–W5

- [ ] Prepare production/session/history secrets and public-origin configuration separately from signing shares; indexer/RPC credentials are not server-owner authentication credentials. API/device/session screens show real failure states.
- [ ] Qualify original MPCium topology gate before claiming availability: upstream production guide assumes≥3nodes; proposed two-node threshold1 needs actual proof or openly revised deployment specification. No ordinary-key fallback.
- [ ] Supply WQ02/05–12 results and app-ready session/history/transfer fixtures. Retain original financial crash/UNKNOWN/reorg qualification and evidence writer responsibilities; session changes cannot weaken financial authority.
- [ ] G4/G5 report original agent tests and WQ wallet cases separately. Typecheck/bootstrap process liveness does not satisfy either qualification suite.


---

## Shared implementation contract — included in all four handoffs

This appendix is identical in the four documents. Specification6.0, dated2026-10-17: new MandateWallet EIP712 domain5, MandateLogin domain2 and unchanged agent receipt/runbook schema4. S8 adds the complete everyday-wallet behavior. No live contract is deployed by this update. Person1 owns shared interface changes; update fixtures and every consumer together. Existing bootstrap source is pre-v6 and must undergo W0 migration before signing.

### S1. Product, boundary and ownership

Build **Mandate Wallet**: an Android personal ETH/ERC20 wallet with receive/send/history/accounts and local security; a separately funded managed wallet delegates bounded tasks to an online agent; the agent buys real browser checks, operates one approved test vault and makes fixed scheduled payments. Payments and useful delivery are recorded separately. An independent verifier reconstructs permission, spending and delivery from an export and public chain data.

| Person | Sole write ownership | Outputs consumed by others |
| --- | --- | --- |
| 1 | `packages/contracts`, `packages/schema`, `deployments`, root workspace/CI configuration | ABI, schemas, fixtures, deployment manifest, chain validation |
| 2 | `apps/api`, `apps/worker`, `services/policy`, `services/mpc-adapter`, `services/mpc-authorizer`, `infra`, migrations, evidence writer | Public API, durable execution, two-node MPCium, policy authorization, exports |
| 3 | `apps/mobile`, `modules/owner-wallet`, `tools/relay-admin.ts` | Complete personal/managed owner wallet, local transactions/sessions/security, installed APK, independent recovery sender |
| 4 | `packages/runbooks`, `apps/provider`, `packages/sdk`, `apps/mcp`, `packages/verifier`, `demo`, `evaluation`, submission assembly | Runbook driver, paid browser services, integrations, standalone inspector, recorded demonstration |

Person 2 owns the worker process; Person 4 supplies its runbook library. Person 2 writes evidence; Person 4 verifies it independently. Person 1 owns ABI/schema generation; other owners never hand-maintain copies. Each owner supplies tests, deployment instructions, known risks and screenshots/logs for their own deliverable. No unassigned fifth person is required.

Use one monorepo `./`, Node 22, TypeScript, pnpm workspaces with a checked-in lockfile; Solidity 0.8.28/OZ 5.x/Foundry; PostgreSQL 16; React Native with Expo 54 native Android build; Go 1.25.8 for MPCium. Person1 creates the workspace. All filenames here are relative to it and are planned files, not claims that source already exists. Pin resolved package versions in lockfiles; container images use resolved digests in the release manifest. Keep secrets out of Git and frontend bundles.

`DeploymentManifest` includes `{schemaVersion:4,walletDomainVersion:"5",loginDomainVersion:"2",chainId:84532,sourceTag,contracts:{factory,token,vault,anchor,walletImplementation:null},providers,targets,origins,mpc,evidence,runbooks,supportedTokens,dependencyPins}`. Each non-null contract is `{address,deploymentBlock,codeHash}`; providers are `{providerId,recipient,capabilities}`; targets are `{targetId,url,expectedTitle}`; origins are `{api,provider}`; mpc is `{engine:'mpcium',commit,thresholdConfig:1,participants:2,initiatorPublicKey,authorizerPublicKey}`; evidence is `{ed25519PublicKey,publisher}`; runbooks is list of full hashed manifests. supportedTokens is a reviewed registry of {chainId,address,codeHash,decimals,symbol,transferMode:'STANDARD_ERC20'}; unknown imports remain watch-only. Strings for times/blocks, strict validated keys/addresses/hashes. Per-wallet mapping is `{walletId,owner,walletAddress,deploymentBlock,codeHash,mpcWalletId,executorAddress,executorPublicKey,keyVersion}` checked against factory and signed Permit. Keys in these structures are public only. Resolve real deployment addresses/versions at setup gates; do not fabricate them to fill the manifest.

### S2. Network, assets and financial identities

Base Sepolia, chainId **84532**. Agents use only six-decimal valueless DemoUSD and one controlled ERC4626 DemoVault. Personal wallet supports native test ETH and standard imported ERC20; managed OwnerTransfer supports owner liquid-token/native control under S8. Imported tokens do not become agent-authorized assets. No other chain or delegated vault is accepted. On-chain amounts are integers; JSON represents uint64/uint256 as decimal strings, enum/count fields as bounded integers, addresses as validated EVM addresses and bytes32/signatures as `0x` hex. API UUIDs never substitute for chain bytes32 IDs. Store explicit UUID ↔ chain ID mappings.

Identities: local owner EOA; per-wallet MPC executor EOA; wallet contract; separately funded normal/emergency/anchor relayers; two provider signer/recipient EOAs; Ed25519 evidence signer; Ed25519 MPC initiator and policy-authorizer identities. None of the service credentials is the owner key. An executor signature authorizes an Action; a relayer signature only pays gas.

Fixed ceilings: 500000 units/payment; 2000000/task gross spend; 5000000/executor/UTC day; 10000000/wallet/UTC day; minimum liquid floor 3000000; post-deposit allocation ≤2000 basis points; ≤20 financial actions/permit, browser ≤3 payments. Owner can tighten. Gross PAY/TRANSFER counters never decrease on refunds. Deposits/withdrawals have separate caps. UTC day is `block.timestamp / 86400`. Allocation limit applies when admitting a deposit, not as a perpetual ratio guarantee.

Permit lifetime ≤24h. Browser task ≤10min, 8 workflow steps, 3 paid attempts. Action and invoice lifetime ≤60s. Policy chain snapshot ≤15s old; risk signal NORMAL and ≤60s old before deposit. Scheduled transfer uses exact owner-approved period/window; missed periods skip. No arbitrary agent/dApp calls/approvals, swaps, bridges, credit, production yield, x402 interoperability, iOS, mobile MPC or open marketplace. Personal transfers and owner-controlled transfers in S8 are required. WalletConnect/external dApp connections are deferred by user choice.

### S3. Signed financial objects

Person 1 creates `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest}.ts`, Zod validators, generated ABI exports and `fixtures/*.json`. These are imported by every JS component. Solidity and native signing are checked against the same JSON golden vectors. EIP-712 field **order and types** are fixed:

```text
domain MandateWallet / version "5" / chainId 84532 / verifyingContract wallet
Permit(bytes32 taskId,address executor,uint8 kind,bytes32 runbookHash,
 bytes32 conditionsHash,bytes32 recipientsHash,bytes32 scheduleHash,
 uint64 issuedAt,uint64 startsAt,uint64 expiresAt,uint64 epoch,uint256 nonce,
 uint32 maxActions,uint32 maxPayments,uint256 maxPayment,uint256 spendCap,
 uint256 liquidFloor,uint256 depositCap,uint256 withdrawCap)
Action(bytes32 permitId,bytes32 requestId,uint8 operation,address target,
 uint256 amount,uint256 minOutput,bytes32 invoiceId,bytes32 inputHash,
 uint32 period,uint64 issuedAt,uint64 deadline)
Schedule(address recipient,uint256 amount,uint64 start,uint32 interval,
 uint32 window,uint32 periods)
Admin(uint8 command,bytes32 permitId,uint256 nonce,uint64 issuedAt,uint64 deadline)
OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,
 uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)

kind: BROWSER=0 LIQUIDITY=1 SCHEDULE=2
operation: PAY=0 TRANSFER=1 DEPOSIT=2 WITHDRAW=3 CLOSE=4
command: PAUSE=0 UNPAUSE=1 REVOKE=2 RECOVER=3 RECOVER_LIQUID=4

domain MandateInvoice / "1" / 84532 / wallet
Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address recipient,
 uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)

domain MandateDelivery / "1" / 84532 / wallet
DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,
 bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)

domain MandateLogin / "2" / 84532 / zero address
Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)
```

`permitId = hashStruct(Permit)`; signatures sign EIP-712 domain-separated digests. Shared helper `hashPermit(permit)` returns this struct hash/ID; `buildTypedData('Permit',permit,domain)` builds the signing payload; `hashAction(action,domain)` returns the domain-separated Action digest. Helpers never infer domain from untrusted payload. `recipientsHash = keccak256(abi.encode(address[]))` on sorted unique ≤4 recipients. `scheduleHash = keccak256(abi.encode(Schedule))`; non-schedule uses zero hash and zeroed Schedule. Other hashes are SHA-256 over RFC8785 canonical UTF-8 JSON, represented as bytes32. `runbookHash` hashes `{schemaVersion:4,runbookId,kind,version,entryArtifactHash,inputSchemaHash,outputSchemaHash,validatorArtifactHash,dependencyLockHash}`. Hash built artifacts/lockfile, omit own hash/timestamps. Installed runbook must match owner-signed hash. Contract does not attest worker execution.

`conditionsHash` commits exact owner-reviewed Conditions:

```ts
type Conditions = {
 schemaVersion: 4; runbookId: 'browser-check'|'liquidity-keeper'|'scheduled-pay';
 browser: null | {targetId:string; checks:('pageLoad'|'title'|'formSubmit')[];
   providerIds:('a'|'b')[]; maxPaidAttempts:number; maxSteps:number;
   taskDeadline:string; resultMaxAgeSeconds:300};
 liquidity: null | {vault:Address; command:'deposit'|'redeem'; amountUnits:string;
   maxSlippageBps:50; riskSourceId:'demo-risk-v1'; signalMaxAgeSeconds:60};
 schedule: null | Schedule;
}; // exactly one non-null branch; schema rejects unknown fields
```

Scope envelope is `{conditions,runbookManifest,providerBindings}` with `providerBindings:[{providerId,recipient}]` from trusted deployment manifest. Conditions provider IDs resolve only through that manifest; recipients must equal sorted permitted provider recipients. Goals are display metadata; executable interpretation is committed in Conditions and confirmed natively. Scope bytes must recompute both signed hashes. Deposit/redeem amount is explicit; no natural-language financial parameter reaches the signer unchecked.

Wallet ABI: `activatePermit(Permit,address[],Schedule,bytes ownerSignature)`; `execute(Action,bytes executorSignature,Invoice,bytes providerSignature)`; `applyAdmin(Admin,bytes ownerSignature)`; `applyOwnerTransfer(OwnerTransfer,bytes ownerSignature)`; `ownerTransferNonce()`; `usedOwnerTransfer(bytes32)`; `getPermit(bytes32)`; `getBudget(address executor)`; `usedRequest(bytes32)`; `permitNonce()`; `adminNonce()`; `authorityEpoch()`; `paused()`; `owner()/token()/vault()`; factory `createWallet(address owner)`/`walletForOwner(address)`. Anyone can relay fixed-configuration wallet creation; the nonzero provided address is immutable owner, never the relayer. Non-PAY uses zeroed Invoice and empty provider signature. `getPermit` returns `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; counters uint256 except counts uint32, flags bool. `getBudget` returns uint256 `{day,walletGross,executorGross,liquidAssets,vaultShares,vaultAssets}`. ABI field names/bindings are generated by Person1; consumers never guess positional tuples. Required wallet events:

```text
ActionExecuted(bytes32 indexed permitId,bytes32 indexed requestId,uint8 operation,
 address target,uint256 assets,uint256 shares,bytes32 invoiceId,
 bytes32 inputHash,bytes32 actionDigest)
PermitActivated(bytes32 indexed permitId,bytes32 indexed taskId,address executor,uint64 epoch)
PermitRevoked(bytes32 indexed permitId)
WalletPaused(bool paused,uint64 epoch)
PermitClosed(bytes32 indexed permitId)
Recovered(uint256 liquidAssets,uint256 redeemedShares,uint256 redeemedAssets,bool vaultFailed)
OwnerTransferExecuted(bytes32 indexed transferId,address indexed asset,address indexed recipient,
 uint256 amount,uint64 newEpoch,bytes32 transferDigest)
```

Financial execution checks current epoch/time, executor signature, kind, recipient, counts, gross caps/floor, request/invoice uniqueness and invoice binding. BROWSER only PAY/CLOSE; LIQUIDITY only DEPOSIT/WITHDRAW/CLOSE; SCHEDULE only TRANSFER/CLOSE. WITHDRAW amount is shares and returns assets only to wallet; positive minOutput required for vault operations. Unused fields must be zero. CLOSE is signed, zero-value and exempt from financial quotas. PAUSE and either RECOVER pause/increment epoch; UNPAUSE never revives prior permits. REVOKE works on pending IDs. Recovery only to immutable owner, works while paused, separate admin nonce/lifetime ≤30min. `RECOVER_LIQUID` makes no vault call. No owner-admin operation requires MPC or backend consent. OwnerTransfer liquid funds, epoch effects, manual nonce and native ETH receive are defined in S8; they do not grant agents personal-wallet privileges.

### S4. Public API and mobile bridge

All endpoints under `/v1`. Mutations except challenge/verify/refresh require UUID `Idempotency-Key`; same tenant+route+key+body returns original response, changed body returns409. Challenge uses no bearer; normal owner routes use15min revocable-session JWT with native-protected rotating refresh as S8.5. Agent tokens have explicit `read`, `prepare`, `run`, `evidence` scopes, wallet/task restriction, expiry/revocation; no owner/admin authority. Evidence scope is separate because artifacts can be private.

| Route | Body / response |
| --- | --- |
| POST `/auth/challenge` | `{ownerAddress,deviceId}` → `{challengeId,typedData}` |
| POST `/auth/verify` | `{challengeId,signature}` → `{accessToken,expiresAt,sessionId,refreshToken,refreshExpiresAt}` |
| POST `/wallets` | `{}` → WalletView with provisioning state |
| GET `/wallets/:walletId` | → WalletView |
| POST `/tasks` | `{walletId,runbookId,goal,input}` → TaskView; input is selected runbook schema |
| POST `/permits/draft` | `{taskId,terms}` → OwnerApproval |
| POST `/permits/activate` | `{draftId,ownerSignature}` → `{permitId,activationTxHash,authorityState}` |
| POST `/tasks/:taskId/run` | `{}` → TaskView |
| GET `/tasks/:taskId` | → TaskView |
| POST `/wallets/:walletId/admin/draft` | `{command,permitId}` → `{draftId,typedData,digest}` |
| POST `/wallets/:walletId/admin/submit` | `{draftId,ownerSignature}` → `{txHash,chainState,epoch}` |
| POST `/agent-tokens` | `{walletId,taskId:null|string,scopes,expiresAt}` → `{id,token}` once |
| DELETE `/agent-tokens/:tokenId` | → `{revoked:true}` |
| GET `/tasks/:taskId/evidence` | authenticated streamed export bundle; no permanent public URL |

`terms` is exactly `{startsAt,expiresAt,maxActions,maxPayments,maxPayment,spendCap,liquidFloor,depositCap,withdrawCap,recipients,schedule}` using Permit/Schedule types. All fields required; kind-inapplicable fields zero. Server derives issuedAt/executor/kind/task ID/hashes/nonce/epoch from verified state and checks recipients/Schedule equal Conditions and trusted provider bindings. Unknown/redundant mismatched fields fail. At most one outstanding Permit draft per wallet; refreshed terms require new native confirmation. Admin nonce/lane is separate.

```ts
type OwnerApproval = {draftId:string; typedData:TypedPermit; scope:Scope;
 recipients:Address[]; schedule:Schedule; digest:Hex32};
type WalletView = {walletId:string; owner:Address; address:Address|null;
 chainId:84532; provisioningState:'DEPLOYING'|'KEYGEN'|'READY'|'FAILED';
 executorAddress:Address|null; paused:boolean; epoch:string;
 liquidUnits:string; floorUnits:string; reservedUnits:string;
 vaultAssetsUnits:string; spendableUnits:string;
 budgets:{day:string; walletSpentUnits:string; executorSpentUnits:string;
 walletRemainingUnits:string; executorRemainingUnits:string}; asOfBlock:string};
type Finding = {name:'integrity'|'authority'|'policy'|'settlement'|'delivery'|'completion';
 state:'PASS'|'FAIL'|'PENDING'|'UNVERIFIABLE'; ruleId:string; reason:string;
 evidenceIds:string[]; basis:('chain'|'signature'|'artifact'|'recorder_assertion')[]};
type TaskView = {taskId:string; chainTaskId:Hex32; walletId:string;
 runbookId:string; outcomeState:string; authorityState:string; currentStep:string;
 grossSpendUnits:string; payments:{actionId:string;requestId:Hex32;providerId:string|null;
 amountUnits:string;txHash:Hex32|null;chainState:string}[];
 delivery:{state:'NONE'|'PENDING'|'VALID'|'INVALID'|'FAILED';result:BrowserResult|null};
 result:JsonObject|null;
 findings:Finding[]; nextPollMs:2000};
```

Native methods are the account-aware interfaces in S8.6: native profile/accounts, specific Login2/Permit5/Admin5/OwnerTransfer5 signing, semantic personal transaction builder/journal, protected NativeSession and QR receive-request validation. Recovery words/private keys never cross RN bridge. Native scope/domain/actual-field confirmation remains mandatory; no generic raw digest method exists.

Errors: `{code,message,actionId:string|null,evidenceId:string|null,retryable:boolean}`. 401 auth,403 scope/tenant,409 idempotency/state conflict,422 invalid policy/input,503 unavailable dependency. Error codes include AUTH_SCOPE, PERMIT_INACTIVE, SCOPE_MISMATCH, RUNBOOK_VERSION, RECIPIENT_DENIED, PAYMENT_CAP, DAILY_CAP, LIQUID_FLOOR, RESERVATION_CONFLICT, QUOTE_EXPIRED, DUPLICATE_REQUEST, SCHEDULE_WINDOW, STALE_SIGNAL, MPC_UNAVAILABLE, SIGNING_UNKNOWN, SIMULATION_REVERT, SETTLEMENT_UNKNOWN, DELIVERY_INVALID, EVIDENCE_UNAVAILABLE. Never automatically retry a new financial request after UNKNOWN.

### S5. Worker ↔ runbook boundary

Person 4 exports `advance(snapshot,deps):Promise<RunbookDecision>` from `@mandate/runbooks`; Person 2 invokes it under a durable task lease. No provider or agent calls the signer directly.

```ts
type RunbookDecision = (
 | {type:'PROPOSE'; decisionKey:string; intent:ActionIntent; evidence:JsonObject[]}
 | {type:'WAIT'; dueAt:string; reason:string}
 | {type:'COMPLETE'; result:JsonObject; evidence:JsonObject[]}
 | {type:'NEEDS_OWNER'|'FAILED'; reason:string; evidence:JsonObject[]}
 ) & {nextState:RunbookState};
type ActionIntent = {operation:0|1|2|3; target:Address; amount:string; minOutput:string;
 invoice:Invoice|null; providerSignature:Hex|null; inputHash:Hex32; period:number};
```

Snapshot is `{taskId,chainTaskId,walletId,walletAddress,permitId,conditions,scope,permit,now,chainBlock,wallet,actions,observations,runbookState}` using shared schema types; `now`/times are seconds strings, `actions` includes stored decisionKey, Action, state, txHash and invoice, observations include signed provider output and risk signals. `RunbookState={schemaVersion:4,step:number,attempt:number,retrievals:number,selectedProvider:null|'a'|'b',quotes:QuoteEnvelope[],delivery:DeliveryEnvelope|null,missedPeriods:number[]}`; initialize zero counters/null/empty arrays. `deps` offers `quote(providerId,input)→QuoteEnvelope`, `retrieve(providerId,invoiceId,requestId,paymentTxHash)→{state:'PENDING'}|DeliveryEnvelope`, `readVault()→{blockNumber,liquidAssets,vaultShares,vaultAssets,previewDepositShares,previewRedeemAssets,maxRedeemShares}`, `readRisk()→{sourceId:'demo-risk-v1',state:'NORMAL'|'WARNING',observedAt,sequence}` only; all uint/time values are decimal strings. Vault previews use the amount in immutable Conditions. QuoteEnvelope/DeliveryEnvelope are the exact S6 response bodies, JSON types/validators exported from shared schema. COMPLETE records useful outcome; Person2 separately closes authority. Person4 cannot set signature, epoch, requestId or raw calldata.

Unique `(taskId,decisionKey)` makes repeated advance calls return the same logical action. Person 2 creates random requestId once, chooses issuedAt/deadline, validates input against Permit, stores immutable Action/invoice, reserves atomically and initiates signing. Old expired unbroadcast signatures can be replaced only after prior usability/history is reconciled; never simply release the reservation because a timer elapsed. runbookState update, observations, action insertion and job scheduling commit transactionally. External quote/retrieval calls may repeat; payment cannot repeat.

Outcome states: DRAFT/AWAITING_OWNER/READY/RUNNING/COMPLETED/DELIVERY_FAILED/NEEDS_OWNER/CANCELLED. Authority: PENDING/ACTIVE/CLOSING/CLOSED/REVOKED/EXPIRED/INVALIDATED. Action: PROPOSED/RESERVED/SIGNING/SIGNED/SUBMITTED/INCLUDED/FINALIZED/DENIED/REVERTED/UNKNOWN. Chain INCLUDED means three canonical confirmations; FINALIZED requires RPC finalized head. Delivery may proceed at INCLUDED; never label it finalized. Reorg returns action to unresolved and blocks dependent new spending.

### S6. Provider and inspection contracts

Trusted manifest maps target IDs `checkout-healthy`/`checkout-broken` to exact HTTPS fixture URLs; browser workers reject arbitrary URLs, scripts, selectors, redirects and private-network egress. Provider request `POST /providers/:id/check` body `{taskId:Hex32,wallet:Address,targetId,checks}` returns402 `{providerId,invoice,providerSignature}`. InputHash commits canonical `{taskId,wallet,targetId,checks}` with fixed check ordering pageLoad,title,formSubmit. Two providers a/b use prices200000/350000 units, distinct signer=recipient EOAs. Provider a supports pageLoad/title; b supports pageLoad/title/formSubmit. A+B fallback demonstration requests pageLoad/title; capability-filter variant requests formSubmit and selects b. No charge at quote generation.

Authenticated `POST /providers/:id/result {invoiceId,requestId,paymentTxHash}` returns202 `{state:'PENDING'}` or200 `{result,receipt,providerSignature,artifacts}`. It verifies canonical success + three confirmations + matching ActionExecuted and exact DemoUSD Transfer before running Playwright once. Unique invoice lock/cache; repeated retrieval returns original output. An invalid payment never triggers paid work. BrowserResult is `{schemaVersion:4,targetId,inputHash,checkedAt:string,checks:{pageLoad?:boolean,title?:{actual:string,expected:string,pass:boolean},formSubmit?:boolean},screenshotHash:Hex32,logHash:Hex32}`; exactly requested checks present; title expectation comes from trusted target fixture. Hash result canonical JSON; screenshot/log hashes cover actual bytes. Artifacts return `{artifactId,mediaType,sha256,base64}` through authenticated channel with a 10MiB/result bound. Provider signs DeliveryReceipt under S3. Negative form check is valid delivered inspection. First completed output must be ≤300s old, ≤5s future and consistent with receipt; retries never re-date old output.

Evidence event: `{schemaVersion:4,eventId,taskId:UUID,chainTaskId,wallet,sequence:number,recordedAt:string,type,requestId:Hex32|null,permitId:Hex32|null,payload,prevHash,eventHash}`. SHA-256 RFC8785 of whole event except eventHash, first prevHash zero32; append under task lock. Never overwrite corrections. Checkpoint `{schemaVersion:4,chainId:84532,wallet,taskId:Hex32,sequence,headHash}` is RFC8785 bytes signed Ed25519, digest SHA-256 anchored via `EvidenceAnchor.anchor(bytes32 taskId,bytes32 checkpointDigest,uint64 sequence)` with event `Anchored(bytes32 indexed taskId,bytes32 checkpointDigest,uint64 sequence,address publisher)`. Anchor is not an event in its own committed checkpoint; append it to a later checkpoint if needed.

Export ZIP: `manifest.json`, `events.jsonl`, `checkpoint.json`, `checkpoint.sig`, `authority.json`, `transactions.json`, `artifact-index.json`, `artifacts/`. Manifest lists schema, chain/wallet/task, inspection range, public keys, retained hashes and anchor tx; verifier trusts keys/addresses from a separately supplied deployment manifest, never export alone. Store artifacts AES256GCM unique IV, AAD taskId/artifactId; storage commitment SHA256(salt32 || plaintext), with salt+plaintext disclosed only in authorized export. Retain original unsalted provider content hashes too. Retention30days; absent retained bytes means UNVERIFIABLE. Export contains no seeds, shares, service tokens or hidden model reasoning.

`mandate-verify --bundle <zip> --trusted <manifest.json> --rpc <url> --out <report.json>` reads only files/RPC and returns `{schemaVersion:4,taskId,inspectionHead,findings:Finding[],unmatchedOutflows:[],limitations:[]}`. Exit0 only when all required findings PASS; exit1 any FAIL; exit2 no FAIL but pending/unverifiable; exit3 malformed input/tool error. Scan wallet transactions/logs from deployment to inspection head for unexplained supported-asset outflows. A fixture vault's Transfer events are distinguished from wallet PAY. Audit assertions without independent support remain UNVERIFIABLE even if hash integrity passes.

### S7. Delivery gates and honest evidence

| Gate, Dhaka time | Cross-owner result |
| --- | --- |
| G0, Oct17 15:30 | Workspace, ABI/schema fixtures, route examples, credentials, hosts, phone and test ETH agreed |
| G1, Oct17 18:00 | Native owner signature + restore; MPCium two-node signature recovered correctly; mandatory authorizer rejection; contract local payment |
| G2, Oct18 02:00 | One phone-approved real Base Sepolia purchase, actual browser output, durable export, initial independent report |
| G3, Oct18 10:00 | All three runbooks, fallback, reservations/restart, pause/recovery, SDK/MCP, full inspector |
| G4, Oct18 15:00 | Adversarial/evaluation results and fixes, rebuild/install/recovery evidence |
| G5, Oct18 18:00 | Tagged APK/source, manifest, deck, ≤5min demo, submission package frozen |
| Submission, Oct20 18:00 target | Upload and verify receipt; official cutoff Oct20 21:59 Dhaka /23:59 Beijing |

These are aggressive targets from Oct17, not estimates backed by an existing implementation. Record actual pass times; a failed gate remains incomplete. Keep a single scope and fix the blocker. No hidden ordinary-key MPC fallback, fabricated test results or guarantee of winning. Tests below are instructions for implementers; this documentation task does not run implementation tests.

Every owner contributes to Q01 native recovery, Q02 MPC isolation, Q03 scope, Q04 contention, Q05 crash durability, Q06 useful purchase, Q07 paid failure/fallback, Q08 assets, Q09 schedule, Q10 confirmed stop, Q11 tampered evidence, Q12 tenant/input isolation, Q13 outage/restore/API-offline recovery, Q14 closure/finality. Required evaluation additionally includes wallet WQ01–WQ14 (S8). Agent evaluation: two target fixtures × three purchase variants × three repeats=18 runs: both providers, capability-filtered provider B, and budget-cap rejection. Report valid denials separately from useful task completion. Add two paid-failure, two contention/restart, one asset and one schedule run; record all outcomes. Direct contract/invariant checks are additional, not counted as user runs. Competition requires technical docs, source/README/deploy/test cases, security self-assessment, actual on-chain hashes, English presentation≤10min; optional demo≤5min. Scoring40% completion/30% security-compliance/30% innovation-interaction, possible0–5 on-chain bonus. Public testnet acceptance was confirmed by the user with organizer.

### S8. Complete wallet application — required v6 extension

This section is required implementation work, not an optional UI upgrade. It extends the agent wallet into a usable Android wallet on **Base Sepolia84532**. Documentation is6.0; newly deployed MandateWallet domain is**5**; MandateLogin domain is**2**; existing runbook/evidence payload schema remains4. Existing bootstrap TS/Solidity layouts/domain constants are pre-v6 scaffolds and must be migrated before financial signing. No contract is currently deployed, so no live migration is claimed. Imported accounts/assets do not grant agents new powers.

#### S8.1 Accounts, funds and screens

One encrypted local BIP39 seed supports account indexes0..19 at `m/44'/60'/0'/0/i`. Generate12words; import all Wallet-Core-supported BIP39 word lengths and optional BIP39 passphrase through native UI. Passphrase is separate from device unlock; restore needs same words, passphrase and index. Native encrypted profile stores passphrase if used, account indexes/labels and backup status; none leaves native boundary. Backup flow includes separate passphrase acknowledgement when used; words alone may restore a different valid address. New additional account is derived locally after unlock; no server-generated private keys. On restore derive/display first5 addresses, let user reveal remaining indexes, check RPC balances/nonces and known factory mappings. Do not claim exhaustive account discovery or that an imported seed has no funds because initial addresses are empty.

Each derived owner address has a separate backend owner/session context and, when activated, one factory wallet plus its own MPC executor. Backend never receives the seed/passphrase or derivation proof linking two addresses; account switching invalidates in-memory query/cache/request context and selects that account's session. Local contacts and labels are encrypted device metadata, not recovered from blockchain. Accounts can be renamed/hidden, never silently reassigned to another derivation path.

| Screen group | Required content and actions |
| --- | --- |
| Onboarding | Create/import, optional import passphrase, native backup/verification, receive address, restore consequences |
| Accounts/Home | Account switch/add/rename; separate **Personal account** and **Agent wallet** cards, full addresses, chain label and per-source spendable balances |
| Assets | Native test ETH and ERC20 balances for personal account; token import/hide/details; managed DemoUSD/vault/floor/reservations separately |
| Receive | Account/source+asset selector, copy address, chain-qualified QR/share, supported-asset/network explanation; executor address never presented as receive address |
| Send | Source/asset/recipient/amount, address book or QR, fee quote, simulation, full native confirmation, submitted/pending/detail states |
| Activity | Incoming/outgoing/manual/agent/funding/vault/admin entries, search/filter, fees/nonce/replacement lineage, explorer links, retry/status and exports |
| Agents | Task approval, budgets, useful output/failures, current permissions, pause/revoke/close and recovery |
| Security/Agent Access | Backend devices/sessions, agent-token scopes/revoke, local lock/biometrics/backup/remove wallet, separate logout and stop-agent controls |
| Network/Help | Supported chain/RPC/explorer status, testnet funding guide, offline/stale states, error recovery, app/build/spec version and support instructions |

A combined portfolio total may sum supported assets for display only; it never supplies one fungible spendable amount across accounts/contracts or assets. Show native units and token decimals; no fabricated fiat prices/APY. API/cloud login is not required to create/import, receive, read balances through RPC or send a personal transaction. Internet/chain RPC and personal ETH gas balance are still required to submit it.

#### S8.2 Personal transfers and transaction lifecycle

Personal sends use the local owner EOA, independent of MPC/backend. Native module signs and broadcasts an EIP1559 transaction only after confirmation. It accepts semantic transfer fields, never arbitrary calldata/raw digest. Supported forms: native ETH with empty data, ERC20 `transfer(recipient,amount)` with zero ETH, and explicitly reviewed speed-up/cancel for an existing local nonce. Imported ERC20s need code at address and valid metadata/balance calls; decimals0..36, strings sanitized/length-bounded. Maintain a manifest-backed send-enabled token registry with chain/address/expected code hash and reviewed standard-transfer behavior; DemoUSD is the initial entry; proxy/upgradeable tokens require a separately pinned implementation and are not enabled by default. Imported unqualified tokens are watch-only until reviewed. Known taxed/rebasing/nonstandard tokens are not enabled. Code/metadata checks and eth_call alone cannot prove arbitrary token honesty or exact future transfer behavior. Token names/logos are not authenticity evidence; full token address remains visible. No ERC20 approval/Permit2/raw contract-call capability is added to the agent.

PersonalTransferRequest is `{clientRequestId:UUID,accountId:UUID,chainId:84532,asset:Address,recipient:Address,amount:string}`; asset zero means native ETH. Native validates account/chain/address and builds calldata itself; amounts are base-unit integer strings. Recipient must be nonzero and not the selected sending address; own agent wallet is allowed as a labelled funding destination. Preview is `{localOperationId,from,to,asset,amount,nonce,gasLimit,maxFeePerGas,maxPriorityFeePerGas,estimatedL1FeeWei,estimatedTotalFeeWei,estimatedTotalDebitWei,quoteBlock,quoteExpiresAt,simulation,requestDigest}`; all uint fields strings. estimatedTotalDebitWei is only the personal ETH debit (gas plus value for native sends); token amount remains separate and must never be added to ETH units. TTL≤30s. Use a read-only OP-stack viem quote adapter including L1 data fee; native supplies the exact proposed transaction fields, validates the adapter result against configured chain/RPC and its own nonce/balance/fee checks, and never delegates signing or calldata construction to the adapter; fee buffer is admission estimate, not a guaranteed upper bound on final L1 charges. Never use floating point for balances, amounts or fees.

Native rechecks actual sender, chainId, recipient/calldata, nonce, fee quote and balance before confirming; changed fields/expired quote require new review. Sender needs ETH for token sends. Serialize nonce allocation per EOA across manual transfers and specific owner-operation relays, reconcile RPC pending nonce with durable local signed journal and external activity. Persist encrypted raw signed bytes and txHash before broadcast; same clientRequestId/same transfer returns the same local operation, changed transfer rejects. Restart/retry broadcasts identical bytes; timeout is UNKNOWN, not permission to create another payment. Backend receives only optional transaction hash/account association after submission, never owner secret or authority to rebuild a changed transaction.

UI states: DRAFT/AWAITING_SIGNATURE/SIGNED/SUBMITTED/INCLUDED/FINALIZED/REVERTED/REPLACED/UNKNOWN/CANCELLED/REORGED. Local cancellation before signing discards draft. Speed-up uses same nonce/to/value/data and freshly reviewed higher fees. Cancel after signing is a separately reviewed0-value self transaction with same nonce; original may win. Show **cancel requested** until cancellation is included; only one canonical replacement can settle. Reorg reverses provisional effects. Included=3canonical confirmations; finalized from RPC finalized head. Do not label a missing/dropped RPC transaction as failed without nonce/history reconciliation.

Funding agent wallet is a personal DemoUSD transfer to its verified factory address; native ETH is optional for owner-controlled holdings only and does not expand agent assets. Do not send funds to executor EOA. Direct RPC operates with an API outage; pending native journal survives app restart. If network is offline, show unavailable/queued draft rather than pretend a transaction was sent.

#### S8.3 Manual transfers from the managed wallet

Add a separate owner-only typed operation, outside executor authority:

```text
domain MandateWallet / "5" / 84532 / wallet
OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,
 uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)

applyOwnerTransfer(OwnerTransfer transfer,bytes ownerSignature)
ownerTransferNonce() -> uint256
usedOwnerTransfer(bytes32 transferId) -> bool
OwnerTransferExecuted(bytes32 indexed transferId,address indexed asset,
 address indexed recipient,uint256 amount,uint64 newEpoch,bytes32 transferDigest)
```

Only immutable owner signature, exact current epoch/ownerTransferNonce, unique transferId, positive amount/nonzero non-wallet recipient, correct chain/domain and lifetime≤10min are accepted. Native ETH asset=zero; other asset must be an ERC20 contract and cannot equal the approved DemoVault share token. `receive()` accepts ETH with no delegated ETH operation; fallback rejects unknown calls. Use SafeERC20/ReentrancyGuard/checks-effects-interactions; sufficient balance; for ERC20 require exact wallet debit and recipient credit matching amount, otherwise revert (tax/rebase/nonstandard tokens unsupported). Native ETH uses a value transfer with empty calldata under reentrancy protection. Zero-value calls/arbitrary calldata, token approvals and executor/agent signatures cannot invoke this path.

**Every successful owner transfer pauses the managed wallet and increments authorityEpoch**, invalidating all active/delayed permits. It intentionally bypasses delegated floor/caps: this is owner governance, not an agent payment. Native confirmation explains amount/destination and that agents will stop; unpause requires fresh permits. Works while already paused, requires neither MPC nor backend consent, and only moves current liquid asset balances. Vault shares are not arbitrarily transferrable: use approved redeem/recovery first. Failure rolls back transfer/nonce/epoch; UI cannot claim stop from a reverted transfer. Transaction ordering still permits earlier agent transactions to settle before owner stop.

Backend sets local inhibit during owner transfer preparation; financial lane and Admin coordination re-read epochs/nonces. OwnerTransfer has a separate nonce; relayer fee/retry lineage follows signed original. During API outage the app can pay gas from the funded personal EOA through the specific native relayOwnerOperation method, or export the signed command to an independent funded sender. The native method constructs only known Admin/OwnerTransfer contract calls with verified owner signatures, uses the same personal nonce journal and shows actual gas fees. This is not arbitrary dApp calldata signing. Agent contracts/counters still support DemoUSD only; manual imported-token sweep is owner privilege. Transfer of unsupported/nonstandard tokens fails explicitly, no successful debit is invented.

Inspector classifies OwnerTransferExecuted as **OWNER_CONTROL**, with owner signature, epoch and actual asset movement; it is neither unmatched theft nor an agent payment counted against task budgets. Full managed-wallet history scanning must include it. No fake task/Permit is created for a manual transfer. Personal transactions have their own activity receipts; agent evidence schema4 remains unchanged.

Recovery UI is explicit by asset: existing Admin RECOVER attempts approved vault redemption and sends core DemoUSD to owner; RECOVER_LIQUID sends core liquid DemoUSD only. Native ETH/imported standard ERC20 use separate owner-approved OwnerTransfer sweeps to owner. A multi-asset recovery is a visible sequence with per-transaction progress and remaining balances, not a claimed atomic all-assets recovery. Unavailable vault/nonstandard token remains a visible unrecovered position.

#### S8.4 Receiving, assets and history

Receive supports address copy and constrained ERC681 forms with explicit84532 chain: `ethereum:pay-<recipient>@84532?value=<wei>` and `ethereum:<token>@84532/transfer?address=<recipient>&uint256=<units>`. QR is a draft request only; scan cannot sign/pay. Parse once, show resolved recipient/token/amount, reject conflicting duplicate/unknown function parameters, unsupported chain, malformed address/amount and ambiguous precision. Raw address scan uses visible current chain with explicit review. Do not auto-switch to mainnet or resolve untrusted arbitrary URLs/scripts from QR. Camera permission is requested only for scan; recovery words never go to clipboard. Public receive addresses may be copied/shared.

Personal balances read current RPC; imported-token list max20/account, keyed by chain+token address. Confirm token code/decimals on trusted RPC, allow add/hide/remove metadata without affecting on-chain balances; display watch-only versus reviewed send-enabled status explicitly. Managed card shows supported DemoUSD, ETH if received, approved vault position, floor/reservations and no unearned APY. Hide never burns/withdraws assets. Contacts store only labels+validated addresses per chain in encrypted device storage.

Backend HistoryAdapter uses Etherscan API V2 at `https://api.etherscan.io/v2/api`, chainid84532, configured server-only API key; required actions txlist/tokentx/txlistinternal with bounded paginated queries. Check supported-chain/account quota at setup; do not assume anonymous Blockscout access (the endpoint returned403 during planning). No API key is embedded in APK. Discover hashes/transfers from indexer, verify receipts/block hashes/logs and current balances through independent RPC; mark unverified internal-trace claims as indexer assertions, not independently proved settlement. Managed wallet history additionally scans known token/wallet/vault events from factory deployment; personal account backfill may predate factory creation.

Activity has `{activityId,ownerAddress,source:'PERSONAL'|'MANAGED',category,chainId,txHash,blockHash,blockNumber,nonce,asset,from,to,amount,feeWei,state,operationId:null|string,taskId:null|string,transferId:null|Hex32,replacementOf:null|Hex32,provenance,observedAt}`. Paginate with stable server cursor and dedupe chain+txHash+logIndex/traceIndex. Expose coverage `{fromBlock,toBlock,indexedThrough,backfillState,gaps}`; indexer outage/incomplete history never renders as a verified empty account. Cache last known history/balances with stale labels. Personal native journal remains available without backend; restored full history needs indexer/RPC access. Never derive canonical spendable balance from indexer-only totals.

#### S8.5 App lock and backend sessions

Local unlock, backend API session and on-chain agent Permit are three independent states. External dApp connections are deferred by user choice. Default app lock after60s inactivity/background; signing/seed display always requires explicit native confirmation plus fresh biometric/device-credential authentication. Cancel/re-enrollment/device-lock failure gives no signature; restore through words+passphrase remains possible. Local app unlock never grants backend signing authority.

Use Login domain2 and fields `Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)`; random deviceId identifies installation, not hardware attestation. Native checks current selected account, expected origin/deviceId and≤5min one-use challenge. Backend consumes nonce transactionally, issues15min JWT carrying ownerAddress/sessionId/audience/expiry plus32byte random refresh token. Refresh token is native-encrypted at rest, never AsyncStorage/logs; native HTTPS exchange stores it and returns only access token/session metadata to JS. Server stores token hash/family/session/expiry/revoked/replaced metadata. JWT sessions checked against revocation on each authenticated request; auth DB unavailable denies private API access, not local owner keys.

Refresh rotates atomically, single-flight per native account,7day idle and30day absolute session expiry. Used token replay revokes that family. Lost refresh response requires fresh signed login rather than replaying old token indefinitely. Session expiry never regenerates seed/address. Device list shows creation/last use/public device label/revoked status; revoke other/all sessions requires JWT original auth_time≤5min from an actual owner-signed login (refresh never resets auth_time). Older sessions receive REAUTH_REQUIRED and complete a new native login before revocation. Device label is untrusted text, not proof of hardware identity. No email/password/social account is needed.

Logout revokes current backend session and clears local API tokens; **active agent permits/tokens are not automatically revoked**. Provide separate Stop Agents and Revoke Agent Tokens actions with chain confirmations where needed. Remove Wallet clears encrypted local seed/profile only after native authentication+backup acknowledgement; show that on-chain funds/active permissions remain. Offer confirmed pause before removal and never claim offline deletion stopped agents. No automatic cloud mnemonic backup or server recovery.

#### S8.6 Additional API/native interfaces

Owner JWT and same S4 idempotency rules apply; agent tokens cannot invoke owner transfer/session controls. `/auth/refresh` uses native refresh token, not JWT/idempotency replay cache. New routes:

```text
POST /v1/auth/challenge {ownerAddress,deviceId} -> {challengeId,typedData}
POST /v1/auth/verify {challengeId,signature} -> {accessToken,expiresAt,sessionId,refreshToken,refreshExpiresAt}
POST /v1/auth/refresh {sessionId,refreshToken} -> rotated response above
POST /v1/auth/logout {} -> {revoked:true}
GET /v1/auth/sessions -> {items:SessionView[]}
POST /v1/auth/sessions/revoke {sessionIds:string[]|'ALL'} -> {revokedIds:string[]} // recent signed-login auth_time required
GET /v1/accounts/:ownerAddress/assets -> {items,asOfBlock,stale}
GET /v1/accounts/:ownerAddress/activity?cursor=... -> {items,nextCursor,coverage}
GET /v1/transactions/:txHash -> {transaction,receipt,activity,coverage}
POST /v1/wallets/:walletId/owner-transfers/draft {asset,recipient,amount} -> {draftId,typedData,digest,assetMetadata,feeQuote,effects}
POST /v1/wallets/:walletId/owner-transfers/submit {draftId,ownerSignature} -> {transferId,txHash,state}
POST /v1/accounts/:ownerAddress/transactions {txHash,clientRequestId} -> {activityId,state}
```

OwnerAddress path must equal JWT subject; transaction lookup checks owned involvement before returning private annotations. Hash registration proves nothing until chain verification. No personal signing key/raw signed transaction/private refresh token accepted by transaction registration. Owner-transfer draft includes expected epoch/nonce, token metadata, gas sponsor status and visible stop-agent effect; expired/changed draft requires fresh confirmation. If sponsor unavailable, show independent relay/funded personal-account route, never silently charge owner.

Native interfaces replace single-account assumptions:

```text
createOwner()/restoreOwner() -> {walletProfileId,backupConfirmed,accounts:Account[]}
listAccounts() -> Account[]; addAccount(index,label) -> Account
getAccount(accountId)/renameAccount(accountId,label) -> Account
Account={accountId,address,index,label,backupConfirmed}
signLogin(accountId,typedJson) -> {address,signature}
signPermit(accountId,typedJson,scopeJson,recipients,schedule) -> {address,signature,digest}
signAdmin(accountId,typedJson) -> {address,signature,digest}
signOwnerTransfer(accountId,typedJson) -> {address,signature,digest}
relayOwnerOperation(accountId,'ADMIN'|'OWNER_TRANSFER',typedJson,ownerSignature) -> {txHash,state}
previewPersonalTransfer(request) -> PersonalTransferPreview
confirmAndSendPersonalTransfer(localOperationId) -> {localOperationId,txHash,state}
getLocalTransactions(accountId)/rebroadcastPersonalTransaction(localOperationId)
replacePersonalTransaction(localOperationId,'SPEED_UP'|'CANCEL') -> reviewed replacement result
showRecoveryWords(walletProfileId) -> {completed}; removeLocalWallet(walletProfileId) -> {removed:true}
NativeSession.exchangeLogin(accountId,challengeId,ownerSignature)/refresh(accountId) -> {accessToken,expiresAt,sessionId}
NativeSession.logout(accountId) -> {revoked:boolean,localCredentialsCleared:true}
```

Native accepts semantic transfer and specific permitted typed requests only, no raw digest/private-key export. NativeSession uses pinned API origin/TLS and stores refresh credentials itself. Node/indexer calls need no owner key. Sensitive profile/local-journal/session storage excluded from OS cloud backup; support account switching without cross-owner token/cache leakage.

#### S8.7 External dApp connections — explicitly deferred

User chose to keep WalletConnect/dApp connections for a later release. They are not required work, resource dependencies, navigation controls, demo claims or release blockers. Do not install WalletKit or require a Reown projectId as part of this release. Current app supports direct manual transfers and agent SDK/MCP access; it is not advertised as a general dApp wallet.

A future wallet-side integration must keep owner signing native, select personal EOA/chain/methods explicitly and require per-request native confirmation; it cannot expose managed/executor authority or use AppKit to offload owner approval to another wallet. Future scope needs a separately approved request-method/security specification. Existing native internal Login/Permit/Admin/OwnerTransfer and semantic transfer builders do not become generic dApp signing APIs.

#### S8.8 Owners, milestones and required wallet acceptance

| Wallet gate | Person1 | Person2 | Person3 | Person4 |
| --- | --- | --- | --- | --- |
| W0 — interface freeze | Domain5/OwnerTransfer/Login2 DTOs, vectors | Sessions/history/transfer API samples | Account/native/session interfaces | QR/receive and receipt activity fixtures |
| W1 — personal wallet | Fee/serialization vectors | History adapter/indexer key gate | Create/import/account switch/receive/manual ETH+ERC20 sends | Actual receive/send/QR reference scenarios |
| W2 — managed funds | OwnerTransfer/receive/event/epoch contract | Owner relay/inhibit and history attribution | Managed send/funding/native approval/independent relay | Verifier OWNER_CONTROL attribution |
| W3 — continuity | Nonce/replay/epoch outcomes | Refresh rotation/revocation/pagination/reorg | Lock/restore/retry/cancel/activity/security screens | Reconnect/outage/same-seed restoration cases |
| W4 — whole-app qualification | Transfer/admin/replay vectors | Outage/history/session error states | Navigation, lock, camera permission and secure confirmation | Receive-request fixtures and end-to-end app cases |
| W5 — release | Chain/ABI/type manifest | Deploy/session/indexer actual status | Signed installed APK with all flows | Complete app demo/evaluation assembled |

W0 precedes new signing; W1/W2 run alongside existing G1–G3; W3/W4 before release G4/G5. Original Oct18 internal target/Oct20 official deadline remain, but scope expansion does not establish capacity or guaranteed completion. Record actual gate times/failures and use submission buffer; no passing result or complete-app claim from a scaffold.

Required wallet cases: WQ01 create/import same words+passphrase/index; WQ02 cross-account cache/session isolation; WQ03 native/token QR and wrong-chain/precision rejection; WQ04 ETH/ERC20 transfer exact debit/fee/balance; WQ05 sponsor versus personal gas clarity; WQ06 pending/restart/rebroadcast/UNKNOWN and replacement winner; WQ07 manual managed send pauses/epoch and works without MPC; WQ08 rejected owner/agent/token signatures/domain/nonce; WQ09 refresh replay/revoked device/session expiry leaves owner account unchanged; WQ10 logout versus on-chain stop/local removal; WQ11 history backfill/indexer outage/reorg/no false empty data; WQ12 API-offline personal send/owner independent recovery; WQ13 imported token metadata/taxed/invalid token behavior; WQ14 complete navigation/accessibility, camera permission denial, scan/clipboard precision and double-tap/cancel confirmation. Every case has actual operation/hash or explicit failure evidence. These are planned acceptance cases, not tests run by this update.
