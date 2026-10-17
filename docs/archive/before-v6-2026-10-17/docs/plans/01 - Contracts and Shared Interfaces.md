---
type: implementation-handoff
title: Person 1 — Contracts and Shared Interfaces
version: "5.0"
updated: 2026-10-17
status: specified-not-built
owner: Person1
---

# Person 1 — Contracts and Shared Interfaces

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: execute the numbered tasks in order, check off completed steps and attach actual acceptance evidence. Read the shared implementation contract in this document before coding. Work in your owned paths; propose interface changes through `packages/schema` before consumers change. Implementation agents may execute tasks directly; delegation is not required.

**Goal:** deliver the on-chain wallet, test assets and authoritative interfaces that the other three implementations can integrate without guessing.

**Architecture:** owner EIP-712 permissions authorize a per-wallet MPC executor. The executor signs bounded Actions; a sponsored relayer submits them. Contracts enforce financial rules independently of the API, MPC policy and AI model. Owner recovery remains independent of those services.

**Stack:** Solidity0.8.28, pinned compatible OZ5.x, Foundry, Node22/TypeScript/viem/Zod, pnpm workspace, Base Sepolia84532.

## 1. Your complete delivery

| Deliverable | Required files | Consumer / acceptance |
| --- | --- | --- |
| Workspace | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `Makefile`, `.github/workflows/ci.yml`, `.gitignore` | All owners can install/build; CI runs owned checks |
| Shared types | `packages/schema/src/{authority,hashing,api,runbook,evidence,manifest,index}.ts` | Owners2/3/4 import exported schemas; unknown fields rejected |
| Compatibility vectors | `packages/schema/fixtures/{permit,admin,invoice,delivery,login,hashes,api,runbook,evidence}-v4.json` | Native, Go, TS and Solidity agree on hashes/signatures/encoding |
| Contracts | `packages/contracts/src/{MandateWallet,WalletFactory,DemoUSD,DemoVault,EvidenceAnchor}.sol` | All contract rules pass direct-call checks |
| Generated bindings | `packages/schema/src/generated/abi.ts`, `packages/contracts/abi/*.json` | API/providers/verifier use these exact ABIs |
| Deployment | `packages/contracts/script/Deploy.s.sol`, `deployments/base-sepolia.json`, deployment README | Code verified against deployed bytecode/hashes; public addresses/block |
| Evidence | `docs/contracts-security.md`, `evidence/person1/` | Actual cases, limitations, transaction references, license record |

You do not implement MPCium, mobile or runbook business logic. You must review their signed data against your vectors and review the complete financial vertical flow at G2.

## 2. First handoff — do this before full contracts

### P1-01. Freeze the executable interface, G0

**Create:** shared type files/fixtures above; `packages/schema/package.json`, `tsconfig.json`; workspace configuration.

**Consumes:** signed field orders, domain versions and API contract in appendix S3–S6. **Produces:** `@mandate/schema` exports `PermitSchema`, `ActionSchema`, `AdminSchema`, `InvoiceSchema`, `ConditionsSchema`, `OwnerApprovalSchema`, `RunbookSnapshotSchema`, `RunbookDecisionSchema`, `TaskViewSchema`, `WalletViewSchema`, `EvidenceBundleSchema`, `DeploymentManifestSchema`, `hashPermit`, `hashAction`, `hashConditions`, `hashRunbook`, `hashRecipients`, `hashSchedule`, `buildTypedData`.

- [ ] Create repo/workspace and exact Node/pnpm pins; define root `make check-schema`, `make check-contracts`, `make check-platform`, `make check-mobile`, `make check-agents`, `make check-integration`, `make release-check`. Each delegates to owned package scripts; until implemented, a missing check fails rather than reporting success.
- [ ] Translate S3 to strict Zod schemas and EIP-712 type arrays. Big integer strings match `^(0|[1-9][0-9]*)$` and are bounded to actual Solidity width; reject floats, negative values, invalid hex and unknown fields. Reject null where a zero field is required.
- [ ] Implement RFC8785 SHA256, ABI recipients/schedule hash and EIP-712 digest helpers with established libraries. Freeze `Conditions` branch invariants, target IDs, provider bindings and browser check ordering.
- [ ] Supply fixed **public test keys only** with one example of every signed object, canonical bytes, struct hash, domain hash, digest, expected signer and canonical65-byte signature. Add counterexamples wrong chain, wrong domain version, reordered fields, 1-unit amount change and null/empty derivation payload distinction for Go adapter fixtures.
- [ ] Supply valid/invalid API response examples and full stub RunbookSnapshot/Decision files to Owners2/3/4. Provide schema package at an identifiable commit and announce it. No mock counts as a completed financial gate.

**Acceptance:** `make check-schema` passes and consumers recover the same owner/executor/provider addresses from fixture signatures. Example test:

```ts
expect(hashAction(vector.action, vector.domain)).toBe(vector.digest);
expect(await recoverTypedDataAddress(vector.typedSignatureInput)).toBe(vector.signer);
expect(ActionSchema.safeParse({...vector.action, amount: '0.5'}).success).toBe(false);
```

### P1-02. Implement wallet authorization and payment, G1

**Create:** `MandateTypes.sol`, `MandateWallet.sol`, `WalletFactory.sol`, `test/{Authority,Payment,Replay}.t.sol`.

**Consumes:** shared golden types. **Produces:** factory/wallet ABI and local activation/payment/revocation path for Owner2.

- [ ] Implement immutable owner/token/vault/limits, domain version4, independent permit/admin nonces, epoch, paused flag, unique task/permit/request/invoice mappings, and gross task/day counters. Use OZ ECDSA/EIP712/SafeERC20/ReentrancyGuard; disallow malformed/high-S signatures.
- [ ] Factory exposes `createWallet(address owner)` for permissionless sponsored deployment, no caller-selected limits/token/vault. Immutable owner is the provided nonzero address; caller gains no privilege. Return existing mapping on repeat. It is safe for someone to pre-create another owner's fixed-config wallet. `walletForOwner(address)` is canonical.
- [ ] Implement activation with full S3 checks, canonical zero fields and kind restrictions. Sender need not equal owner because signature authorizes relay. `permitId` is struct hash; duplicate task cannot receive a second permit. Store committed recipients/Schedule. A zero executor and malformed recipient array fail.
- [ ] Implement PAY, provider invoice domain/binding/time checks, gross cap/floor updates and exact transfer. Use checks-effects-interactions so external calls cannot reenter before IDs/counters are consumed. On revert all effects roll back.
- [ ] Implement zero-value CLOSE even when financial quota fully used. Check active epoch/time and executor signature before closing. Keep request uniqueness. Generate ABI/bindings automatically, commit them with source.
- [ ] Directly call contracts with valid executor signatures bypassing API: wrong recipient, expired quote, excessive amount/cap, changed inputHash, wrong task/wallet, replay and incorrect domain must fail.

**Acceptance:** activated fixture Permit + correct executor Action transfers exactly200000 units and emits the exact S3 ActionExecuted event; replay cannot transfer again. Sender relayer has no ability to change destination. Hand Owners2/4 local contract addresses, ABI and public transaction fixture.

## 3. Complete the asset and owner controls

### P1-03. Vault and schedule mechanics, G2–G3

**Create:** `DemoUSD.sol`, `DemoVault.sol`, `test/{Vault,Schedule,Limits}.t.sol`.

- [ ] DemoUSD has6 decimals and public faucet10 tokens per recipient/UTC day. Track by recipient, so changing caller cannot bypass the faucet. Label unlimited supply potential/test-only status. Faucet cannot seize funds.
- [ ] DemoVault uses OZ ERC4626 accounting with same DemoUSD; deposit/redeem operate real balances/shares. Add administrator-controlled withdrawal-disabled test switch that affects maxRedeem/redeem consistently. It cannot transfer users' shares or underlying to administrator; no production yield claim.
- [ ] DEPOSIT allows only immutable vault, caps cumulative assets, preserves effective floor and checks post-deposit allocation using actual balances and `convertToAssets`. Use exact allowance, clear afterward; verify actual assets spent and shares received≥positive minOutput. Reject fee-on-transfer behavior in this fixed-asset release.
- [ ] WITHDRAW uses shares as Action.amount; actual redeemed assets count toward cumulative withdrawCap, send only to wallet; enforce positive minimum assets and owned shares. Gross spend counters are unchanged. Protect external calls and verify actual deltas.
- [ ] TRANSFER requires exact stored recipient/amount/due window/unused period. Use uint256 intermediate arithmetic to prevent uint32 overflow; final period/window fits Permit. Schedule maxPayments equals permitted periods and≤maxActions. Unused invoice/input/minOutput fields are zero. Emit real token transfers.
- [ ] Test floor3 at exact boundary and one unit below;20% allocation boundary and one unit above; withdrawal unavailable; wrong minOutput; deposit cap; UTC day rollover; exact early/open/close schedule boundaries and duplicate/missed periods. No catch-up when multiple windows pass.

**Acceptance:** deposit1 from liquid10 creates a real share position; redeem returns funds to wallet; subsequent payment remains independently permitted. Three0.1 transfers have distinct due periods and cannot repeat.

### P1-04. Governance and independent recovery, G2–G3

**Create:** `test/{Admin,Recovery,Epoch}.t.sol`, canonical admin vectors.

- [ ] Admin issuedAt≤now≤deadline,≤30min validity, independent nonce. PAUSE/RECOVER/RECOVER_LIQUID increment epoch, pause and invalidate prior active and delayed signed grants. UNPAUSE changes paused status only. REVOKE marks target ID permanently, including an unactivated permit ID; other Admin commands require permitId zero.
- [ ] Recovery destination is immutable owner. RECOVER attempts vault maxRedeem/redeem within bounded low-level call gas, catches failure and still sends liquid supported token; record actual received amounts. RECOVER_LIQUID never calls vault. Document chosen gas bounds and account for relayer gas before releasing APK.
- [ ] Recovery works while paused, bypasses delegated floor intentionally and cannot be denied by executor/policy. A successful pause cannot reverse transactions ordered earlier in chain.
- [ ] Add separate tests for vault revert/oversized gas use, recovered liquid only, repeated Admin nonce, stale draft activation after pause/unpause, old close/payment after epoch bump and signer cancellation fixture.
- [ ] Review Owner3's `tools/relay-admin.ts` and native confirmation against final ABI. Run recovery through an independent relayer/RPC with API stopped at integration gate.

**Acceptance:** recovered DemoUSD arrives only at owner EOA; old grants remain unusable after unpause; no secret or API session is needed by the independent sender.

## 4. Inspection support, deployment and release

### P1-05. Views, anchors and financial invariants, G3–G4

**Create:** `EvidenceAnchor.sol`, `test/{Anchor,Invariants}.t.sol`, `packages/schema/src/generated/abi.ts`.

- [ ] `getPermit(id)` returns generated tuple `{permit,activated,closed,revoked,grossSpend,paymentCount,actionCount,depositedAssets,withdrawnAssets}`; all numeric counters uint256 except counts uint32, flags bool. UI authorityState derives epoch/expiry/paused separately. `getBudget(executor)` returns `{day,walletGross,executorGross,liquidAssets,vaultShares,vaultAssets}`, uint256 fields. Expose immutable `owner()/token()/vault()` plus nonces/epoch/paused. Publish ABI field names to consumers at G0 even if implementation follows.
- [ ] Anchor permits only immutable publisher, records the S6 digest/sequence and emits exact event. Reject zero task/digest, non-increasing sequence per task and duplicate sequence. The publisher is trusted only for checkpoint publication, cannot control wallet. No upgrade key.
- [ ] Add stateful invariants: no unauthorized recipient outflow, supported liquid floor on delegated spending, gross counters monotonic within day/task, request/invoice/period at most once, aggregate deposit cap, no owner privilege from relayer/factory caller. Model Admin recovery exceptions explicitly.
- [ ] Produce public chain receipt/event examples for PAY/DEPOSIT/WITHDRAW/TRANSFER/CLOSE/PAUSE/REVOKE/RECOVER/anchor. Review Owner4 verifier's historical rule reconstruction, including withdrawals/refunds that must not replenish gross allowance.

**Acceptance:** `forge test` plus invariant suite pass at pinned source; save seeds/run counts and failures/fixes in `evidence/person1/contract-results.json`. Do not report unexecuted assertions as tested properties.

### P1-06. Deploy and qualify final manifest, G2 then refresh G5

- [ ] Coordinate addresses before deployment: provider recipient keys from Owner4, anchor publisher from Owner2; configure vault and factory release constants. Deploy to Base Sepolia with funded deployment account, persist chain ID/deployment block/addresses/transaction hashes/runtime bytecode hashes/compiler settings and constructor values.
- [ ] `deployments/base-sepolia.json` must satisfy DeploymentManifestSchema: schemaVersion4; chainId84532; `contracts:{factory,walletImplementation:null,token,vault,anchor}`; per-contract deploymentBlock/codeHash; provider bindings/target origins; API/provider origins; MPC engine/source commit/key public metadata; evidence Ed25519 key/anchor publisher; approved runbook manifest hashes; exact package/native pins; source tag and inspection start blocks. Per-wallet addresses/executors are separate runtime records. No secret keys/chain passwords/PATs.
- [ ] Owner3 bundles a trusted manifest in APK; Owner4 supplies it separately to verifier. Compare network/address/code hashes; mismatches block approval/export verification. API cannot silently switch chain or contract after owner confirmation.
- [ ] Rebuild from clean checkout/tag, regenerate ABI without diff and verify deployment code against pinned settings. Provide README algorithm/security explanation, known risks and dependency licenses.
- [ ] At G4 cross-review Owner2 policy+MPC request binding, Owner3 actual displayed fields and Owner4 settlement verification. Fix contract or schema inconsistencies through a new versioned fixture commit; do not change a deployed contract's assumed behavior silently.

## 5. Check commands and handoff packet

Define and run during implementation:

```bash
pnpm --filter @mandate/schema check
forge test --root packages/contracts -vv
make check-contracts
make check-integration
```

At each gate send a commit hash, generated ABI/schema fixture version, passing case report, known failing cases and public deploy manifest. Commit logical units: schema/vectors → authority/payment → asset/schedule → admin → anchor/invariants → deployment/docs. Never mix secrets or unrelated owners' changes into commits.

**Done means:** Owner2 can activate/execute/stop through your ABI, Owner3 signs your actual domain/types, Owner4 verifies your exact events, and direct calls still obey rules when all off-chain services are bypassed. A source file existing alone is not acceptance.

## 6. Risks you must expose

Controlled vault valuation/risk signal and DemoUSD are fixtures. Public testnet settlement is not commercial asset safety. Non-upgradeable bugs require new deployment and fresh owner permissions. Contract cannot attest off-chain model/runtime, provider honesty or backend reservation correctness. Separate executor caps are per wallet's contract, not a cross-wallet global risk engine. Independent specialist review remains necessary before real funds.


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
