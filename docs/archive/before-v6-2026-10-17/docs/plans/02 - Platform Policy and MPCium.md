---
type: implementation-handoff
title: Person 2 — Platform Policy and MPCium
version: "5.0"
updated: 2026-10-17
status: specified-not-built
owner: Person2
---

# Person 2 — Platform, Policy and MPCium

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: execute the numbered tasks in order and save real acceptance results. The identical appendix defines interfaces with the other three owners. You own the runtime and signer integration; do not delegate an unspecified missing service to another person. Implementation agents may execute directly without subagents.

**Goal:** deliver authenticated durable execution, enforce task policies before MPC signing, operate the two self-hosted signers and export inspectable records.

**Architecture:** API/worker/Postgres on host A; MPC node0 and Go adapter on A; separately administered host B runs MPC node1, deterministic policy service and Go authorizer. Both nodes require the policy authorizer. NATS/Consul are private infrastructure. One combined executor signature reaches the wallet; the owner's key never reaches either host.

**Stack:** Node22/Fastify/Zod/viem/PostgreSQL16; Go1.25.8; MPCium commit `90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2`; upstream's pinned Fystack tss-lib fork. No custom cryptography/C++ transport/embedded-wallet provider.

## 1. Complete outputs and trust boundaries

| Output | Owned location | Required behavior |
| --- | --- | --- |
| Public service | `apps/api/src/{auth,wallets,tasks,permits,admin,tokens,evidence}` | Appendix routes, tenant isolation, idempotency, signed login |
| Durable runtime | `apps/worker/src/{jobs,advance,reservations,execution,relayer,reconcile}` | Shared runbook driver; one logical action across retries/crashes |
| Storage | `apps/api/migrations`, `apps/api/src/db` | Constraints/locks/leases/outbox and encrypted artifacts |
| Policy service | `services/policy/src/{load,validate,rules,authorize}` | Independently reload owner scope, immutable Action and current chain state |
| MPC Go adapter | `services/mpc-adapter/{cmd,internal}` | Build exact signed requests, route results, normalize/recover EVM signature |
| MPC Go authorizer | `services/mpc-authorizer/{cmd,internal}` | Verify initiator+policy-approved exact bytes, authorizer key only on B |
| Operations | `infra/{compose.dev.yaml,host-a,host-b,mpcium.lock.json}`, `docs/platform-operations.md` | Private authenticated services, independent shares/backups, restore and deploy |
| Evidence | `apps/worker/src/evidence`, `evidence/person2` | Ledger/artifacts/checkpoint/anchor/export with no secret leakage |

Person1 supplies ABI/schema; Person3 signs owner Login/Permit/Admin; Person4 supplies runbooks/providers and independent inspector. You provide the stable backend those components use. Person4 cannot call a generic signer or bypass your worker.

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
- [ ] Signed login as S4, nonce once transactionally,≤5min challenge,15min JWT, origin pinned; rate-limit. Hash-store32-byte random scoped tokens, reveal once; default no evidence scope. Every route checks owner and wallet/task restrictions. No tenant identifiers trusted from token caller alone.
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


---

## Shared implementation contract — included in all four handoffs

This appendix is identical in the four documents. It is specification version 5, dated 2026-10-17. On-chain EIP-712 domains remain version **4**, and receipt schema remains **4**: the MPC engine and team allocation changed, not the signed Solidity fields. Never change an interface in only one component. Person 1 owns `packages/schema`; consumers propose a change and update its fixtures before merging.

### S1. Product, boundary and ownership

Build **Mandate Wallet**: an Android owner wallet delegates bounded tasks to an online agent; the agent buys real browser checks, operates one approved test vault and makes fixed scheduled payments. Payments and useful delivery are recorded separately. An independent verifier reconstructs permission, spending and delivery from an export and public chain data.

| Person | Sole write ownership | Outputs consumed by others |
| --- | --- | --- |
| 1 | `packages/contracts`, `packages/schema`, `deployments`, root workspace/CI configuration | ABI, schemas, fixtures, deployment manifest, chain validation |
| 2 | `apps/api`, `apps/worker`, `services/policy`, `services/mpc-adapter`, `services/mpc-authorizer`, `infra`, migrations, evidence writer | Public API, durable execution, two-node MPCium, policy authorization, exports |
| 3 | `apps/mobile`, `modules/owner-wallet`, `tools/relay-admin.ts` | Native owner wallet and signed authority, installed APK, independent recovery sender |
| 4 | `packages/runbooks`, `apps/provider`, `packages/sdk`, `apps/mcp`, `packages/verifier`, `demo`, `evaluation`, submission assembly | Runbook driver, paid browser services, integrations, standalone inspector, recorded demonstration |

Person 2 owns the worker process; Person 4 supplies its runbook library. Person 2 writes evidence; Person 4 verifies it independently. Person 1 owns ABI/schema generation; other owners never hand-maintain copies. Each owner supplies tests, deployment instructions, known risks and screenshots/logs for their own deliverable. No unassigned fifth person is required.

Use one monorepo `./`, Node 22, TypeScript, pnpm workspaces with a checked-in lockfile; Solidity 0.8.28/OZ 5.x/Foundry; PostgreSQL 16; React Native with Expo 54 native Android build; Go 1.25.8 for MPCium. Person1 creates the workspace. All filenames here are relative to it and are planned files, not claims that source already exists. Pin resolved package versions in lockfiles; container images use resolved digests in the release manifest. Keep secrets out of Git and frontend bundles.

`DeploymentManifest` includes `{schemaVersion:4,chainId:84532,sourceTag,contracts:{factory,token,vault,anchor,walletImplementation:null},providers,targets,origins,mpc,evidence,runbooks,dependencyPins}`. Each non-null contract is `{address,deploymentBlock,codeHash}`; providers are `{providerId,recipient,capabilities}`; targets are `{targetId,url,expectedTitle}`; origins are `{api,provider}`; mpc is `{engine:'mpcium',commit,thresholdConfig:1,participants:2,initiatorPublicKey,authorizerPublicKey}`; evidence is `{ed25519PublicKey,publisher}`; runbooks is list of full hashed manifests. Strings for times/blocks, strict validated keys/addresses/hashes. Per-wallet mapping is `{walletId,owner,walletAddress,deploymentBlock,codeHash,mpcWalletId,executorAddress,executorPublicKey,keyVersion}` checked against factory and signed Permit. Keys in these structures are public only. Resolve real deployment addresses/versions at setup gates; do not fabricate them to fill the manifest.

### S2. Network, assets and financial identities

Base Sepolia, chainId **84532**. Six-decimal `DemoUSD`, no monetary value; one controlled ERC-4626 `DemoVault`. No other token/chain/vault is accepted. On-chain amounts are integers; JSON represents uint64/uint256 as decimal strings, enum/count fields as bounded integers, addresses as validated EVM addresses and bytes32/signatures as `0x` hex. API UUIDs never substitute for chain bytes32 IDs. Store explicit UUID ↔ chain ID mappings.

Identities: local owner EOA; per-wallet MPC executor EOA; wallet contract; separately funded normal/emergency/anchor relayers; two provider signer/recipient EOAs; Ed25519 evidence signer; Ed25519 MPC initiator and policy-authorizer identities. None of the service credentials is the owner key. An executor signature authorizes an Action; a relayer signature only pays gas.

Fixed ceilings: 500000 units/payment; 2000000/task gross spend; 5000000/executor/UTC day; 10000000/wallet/UTC day; minimum liquid floor 3000000; post-deposit allocation ≤2000 basis points; ≤20 financial actions/permit, browser ≤3 payments. Owner can tighten. Gross PAY/TRANSFER counters never decrease on refunds. Deposits/withdrawals have separate caps. UTC day is `block.timestamp / 86400`. Allocation limit applies when admitting a deposit, not as a perpetual ratio guarantee.

Permit lifetime ≤24h. Browser task ≤10min, 8 workflow steps, 3 paid attempts. Action and invoice lifetime ≤60s. Policy chain snapshot ≤15s old; risk signal NORMAL and ≤60s old before deposit. Scheduled transfer uses exact owner-approved period/window; missed periods skip. No arbitrary calls/approvals, swaps, bridges, credit, production yield, x402 interoperability, iOS, mobile MPC or open marketplace in this release.

### S3. Signed financial objects

Person 1 creates `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest}.ts`, Zod validators, generated ABI exports and `fixtures/*.json`. These are imported by every JS component. Solidity and native signing are checked against the same JSON golden vectors. EIP-712 field **order and types** are fixed:

```text
domain MandateWallet / version "4" / chainId 84532 / verifyingContract wallet
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

kind: BROWSER=0 LIQUIDITY=1 SCHEDULE=2
operation: PAY=0 TRANSFER=1 DEPOSIT=2 WITHDRAW=3 CLOSE=4
command: PAUSE=0 UNPAUSE=1 REVOKE=2 RECOVER=3 RECOVER_LIQUID=4

domain MandateInvoice / "1" / 84532 / wallet
Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address recipient,
 uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)

domain MandateDelivery / "1" / 84532 / wallet
DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,
 bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)

domain MandateLogin / "1" / 84532 / zero address
Login(string origin,bytes32 nonce,uint64 issuedAt,uint64 expiresAt)
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

Wallet ABI: `activatePermit(Permit,address[],Schedule,bytes ownerSignature)`; `execute(Action,bytes executorSignature,Invoice,bytes providerSignature)`; `applyAdmin(Admin,bytes ownerSignature)`; `getPermit(bytes32)`; `getBudget(address executor)`; `usedRequest(bytes32)`; `permitNonce()`; `adminNonce()`; `authorityEpoch()`; `paused()`; `owner()/token()/vault()`; factory `createWallet(address owner)`/`walletForOwner(address)`. Anyone can relay fixed-configuration wallet creation; the nonzero provided address is immutable owner, never the relayer. Non-PAY uses zeroed Invoice and empty provider signature. `getPermit` returns `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; counters uint256 except counts uint32, flags bool. `getBudget` returns uint256 `{day,walletGross,executorGross,liquidAssets,vaultShares,vaultAssets}`. ABI field names/bindings are generated by Person1; consumers never guess positional tuples. Required wallet events:

```text
ActionExecuted(bytes32 indexed permitId,bytes32 indexed requestId,uint8 operation,
 address target,uint256 assets,uint256 shares,bytes32 invoiceId,
 bytes32 inputHash,bytes32 actionDigest)
PermitActivated(bytes32 indexed permitId,bytes32 indexed taskId,address executor,uint64 epoch)
PermitRevoked(bytes32 indexed permitId)
WalletPaused(bool paused,uint64 epoch)
PermitClosed(bytes32 indexed permitId)
Recovered(uint256 liquidAssets,uint256 redeemedShares,uint256 redeemedAssets,bool vaultFailed)
```

Financial execution checks current epoch/time, executor signature, kind, recipient, counts, gross caps/floor, request/invoice uniqueness and invoice binding. BROWSER only PAY/CLOSE; LIQUIDITY only DEPOSIT/WITHDRAW/CLOSE; SCHEDULE only TRANSFER/CLOSE. WITHDRAW amount is shares and returns assets only to wallet; positive minOutput required for vault operations. Unused fields must be zero. CLOSE is signed, zero-value and exempt from financial quotas. PAUSE and either RECOVER pause/increment epoch; UNPAUSE never revives prior permits. REVOKE works on pending IDs. Recovery only to immutable owner, works while paused, separate admin nonce/lifetime ≤30min. `RECOVER_LIQUID` makes no vault call. No owner-admin operation requires MPC or backend consent.

### S4. Public API and mobile bridge

All endpoints under `/v1`. Mutations except challenge/verify require UUID `Idempotency-Key`; same tenant+route+key+body returns original response, changed body returns409. Challenge uses no bearer; normal owner routes use 15min JWT. Agent tokens have explicit `read`, `prepare`, `run`, `evidence` scopes, wallet/task restriction, expiry/revocation; no owner/admin authority. Evidence scope is separate because artifacts can be private.

| Route | Body / response |
| --- | --- |
| POST `/auth/challenge` | `{ownerAddress}` → `{challengeId,typedData}` |
| POST `/auth/verify` | `{challengeId,signature}` → `{accessToken,expiresAt,ownerAddress}` |
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

Native methods: `createOwner()/restoreOwner()/getOwner() → {address,backupConfirmed}`; `signLogin(typedJson) → {address,signature}`; `signPermit(typedJson,scopeJson,recipients,schedule) → {address,signature,digest}`; `signAdmin(typedJson) → {address,signature,digest}`; `showRecoveryWords() → {completed}`. Seed words never cross the RN bridge. Native module recomputes scope hashes, validates permitted schemas/domains/trusted deployment and shows actual signed terms before biometric/device-credential unlock. No raw-sign method.

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

Every owner contributes to Q01 native recovery, Q02 MPC isolation, Q03 scope, Q04 contention, Q05 crash durability, Q06 useful purchase, Q07 paid failure/fallback, Q08 assets, Q09 schedule, Q10 confirmed stop, Q11 tampered evidence, Q12 tenant/input isolation, Q13 outage/restore/API-offline recovery, Q14 closure/finality. Required evaluation: two target fixtures × three purchase variants × three repeats=18 runs: both providers, capability-filtered provider B, and budget-cap rejection. Report valid denials separately from useful task completion. Add two paid-failure, two contention/restart, one asset and one schedule run; record all outcomes. Direct contract/invariant checks are additional, not counted as user runs. Competition requires technical docs, source/README/deploy/test cases, security self-assessment, actual on-chain hashes, English presentation≤10min; optional demo≤5min. Scoring40% completion/30% security-compliance/30% innovation-interaction, possible0–5 on-chain bonus. Public testnet acceptance was confirmed by the user with organizer.
