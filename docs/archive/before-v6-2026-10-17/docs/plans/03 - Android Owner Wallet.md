---
type: implementation-handoff
title: Person 3 — Android Owner Wallet
version: "5.0"
updated: 2026-10-17
status: specified-not-built
owner: Person3
---

# Person 3 — Android Owner Wallet

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: execute the tasks in order, record acceptance on a physical phone and use the shared contract below for every integration. Your deliverable owns the user's signing experience. Implementation agents may work directly without delegation.

**Goal:** deliver an installed Android wallet that creates/restores the owner key locally, approves bounded agent tasks and lets the owner inspect, stop and recover independently.

**Architecture:** React Native renders wallet/tasks/inspection. A small Kotlin module owns recovery words, encrypted seed, native confirmation and typed signing. The online two-node MPC executor is operated by Person2; it is a separate key. After permission activates, the owner can close the app and the server continues within that permission.

**Stack:** Expo54 with its matching React Native version, native development/release Android build, Android12+, Kotlin, Trust Wallet Core JNI, authenticated Android Keystore wrapping key. No Expo Go, external wallet popup, embedded-wallet account or mobile threshold cryptography.

## 1. Complete deliverables

| Output | Owned files | Acceptance |
| --- | --- | --- |
| App shell/data | `apps/mobile/src/{api,config,state,navigation,components}` | Trusted chain/manifest, authenticated API, no seed in JS |
| Owner module | `modules/owner-wallet/android/src/main/java/.../{OwnerWalletModule,SeedStore,TypedSigner,ScopeValidator,NativeApprovalActivity,RecoveryActivity}.kt` | Native create/backup/import/typed confirmation |
| Screens | `apps/mobile/src/screens/{Setup,Wallet,TaskCreate,Approval,Task,Assets,Schedule,Inspector,Control,Recovery}.tsx` | Complete flow with real API and actual chain states |
| Independent sender | `tools/relay-admin.ts` and README | Submit exported Admin through another RPC with backend offline |
| Release | `apps/mobile/android`, `docs/mobile-build.md`, `evidence/person3` | Installable APK, exact native dependency pins, restore/control evidence |

Person1 supplies schema/ABI/trusted manifest. Person2 supplies public API. Person4 supplies typed task inputs/results and inspection findings. You do not reimplement policy/backend or embed the server's MPC shares in the app.

## 2. Protect and prove owner authority first

### P3-01. Native build and owner lifecycle, G1

**Create:** module/package wiring, Kotlin files, native recovery UI, Android instrumentation fixtures.

**Consumes:** Login/Permit/Admin fixture JSON from Person1. **Produces:** exact bridge methods S4 and a stable local owner address.

- [ ] Set up Expo native development build and physical Android12+ phone with secure screen lock. Pin Wallet Core Android artifact/version and build credentials. GitHub package-download PAT with minimum package-read scope is a build secret, never app runtime configuration. Check dependency license and load JNI library successfully before building screens.
- [ ] Native Wallet Core generates128bit BIP39 entropy/12-word mnemonic, derives Ethereum `m/44'/60'/0'/0/0`. Use Wallet Core import/checksum validation, no custom mnemonic/HD math. Create/restore run in native UI; JS receives address/backup status only.
- [ ] SeedStore encrypts native seed representation AES256GCM with unique IV and Android Keystore non-exportable AES key requiring biometric/device credential authentication. Bind operation with BiometricPrompt/CryptoObject as supported by configured API; cancellation returns explicit cancellation error with no signature. Authentication timeout must not permit silent later JS signing requests.
- [ ] Native RecoveryActivity shows words, disables screenshots/clipboard/autofill, prompts selected word positions and marks backupConfirmed only after correct answers. No seed words in logs, analytics, crash reports, JS errors, AsyncStorage or bridge objects. Restore input is native; clear temporary buffers/free Wallet Core handles after use where possible.
- [ ] Exclude encrypted seed/metadata from Android cloud backup/device transfer; test uninstall/restore semantics. Explain loss of device+words means no server recovery. Preserve consistent address formatting/checksum. Gate wallet creation/funding/task approval on backupConfirmed.
- [ ] Restore the same words in separate test installation/device and compare exact address. Cancellation/wrong words/device-lock/invalidation must fail closed, never create another silent owner.

**Acceptance:** native create→word confirmation→getOwner works; import restores same address; network traffic/API payloads contain no words/private keys. Record physical device model/Android version, native package pin and observed restore result.

### P3-02. Typed scope validation and native confirmation, G1–G2

**Create:** TypedSigner/ScopeValidator/NativeApprovalActivity, golden-vector instrumentation tests.

- [ ] Expose only S4 methods. No method accepts arbitrary digest/raw transaction/private-key export. signLogin accepts exact domain/type/origin and≤5min challenge. signPermit/Admin accept exact S3 schema/domain, expected owner and trusted wallet; reject unknown type fields/chain/address/version.
- [ ] Implement native JSON canonicalization/hashing with an established RFC8785 implementation, native/Java SHA256 and tested ABI encoding/Keccak helpers. Recompute runbook manifest hash, Conditions hash, recipients hash and Schedule hash inside native boundary; compare with signed Permit. Canonical integer strings and empty/zero fields must match Person1 vectors byte-for-byte. JavaScript-provided summary/digest cannot be trusted without recomputation.
- [ ] Native display derives from actual signed data and checked scope: chain84532, wallet/executor, runbook name/version/hash, task target/checks/provider recipients, amount and cumulative caps, floor, start/expiry, max actions/attempts, vault command/cap, schedule recipient/amount/windows/count. Show6-decimal amounts plus raw units in expandable details. Human text is supplemental, cannot contradict actual terms.
- [ ] Native confirmation requires explicit approve then authentication for each Permit/Admin. Display PAUSE/REVOKE/RECOVER effects separately; RECOVER always goes to local owner. signAdmin permits offline recovery through trusted factory/wallet discovery without JWT; fixed domain still applies.
- [ ] Wallet Core signs EIP712; verify owner address locally with trusted helper/native library and ensure canonical65-byte signature expected by Solidity. Do not double-hash typed digest. Return only `{address,signature,digest}` (login no digest required).
- [ ] Golden tests reject one-field mutation, mismatched recipients/scope/schedule, unsupported chain, wrong domain, injected title/script in metadata, cancelled confirmation and untrusted wallet. Native UI text sanitizes control characters and never renders remote HTML.

**Acceptance:** native signature recovered by Person1's vector test and actual contract. On-screen signed amounts match final payload; modified scope/chain cannot produce an accepted signature. Native key enters signing memory after decryption; do not describe this as hardware secp256k1 signing.

## 3. Connect the complete owner journey

### P3-03. Login, wallet and task approval, G2

**Create:** typed API client, setup/wallet/task-create/approval screens and error mapping.

- [ ] Bundle validated trusted manifest with API origin/chain/factory/token/vault/code hashes/provider identities/approved runbook hashes. Read wallet through factory mapping and verify expected owner/config. Do not accept a remote response's arbitrary chain or verifyingContract as trusted. Unknown deployment version requires explicit verified app/config release.
- [ ] Sign one-use Login from `/v1/auth/challenge`, exchange at verify, keep15min JWT in memory and refresh by new native signed login when needed. Store revocable agent tokens only when explicitly created; no background login signing without native confirmation.
- [ ] POST wallets with stable Idempotency-Key, show DEPLOYING/KEYGEN/READY. Poll readiness, never display address null as a funded wallet. Wallet shows liquid/floor/reserved/vault/spendable and daily remaining with asOfBlock and testnet label. Deposit faucet via documented test funding flow; prevent task UI proceeding until balance/address known.
- [ ] Task creation uses real `POST /tasks` and Person4's typed runbook input; show interpreted check set before approval. GET task by returned UUID; do not invent frontend-only financial task IDs. Goal edits after draft require fresh interpretation/approval.
- [ ] Request Permit draft, validate OwnerApproval locally, invoke native signPermit and POST activate. Persist only draft/task ID and nonsecret response; if response lost, retry original idempotency key or poll existing task, never create another permission automatically.
- [ ] Start task via run route when authority ACTIVE; use backend-owned state, no browser payment SDK. Poll2s foreground task/10s wallet, suspend polling in background. Close app after activation and reopen to show continued agent execution.

**Acceptance:** physical phone creates a task, approves once, closes; backend pays while phone offline; reopen shows actual public tx and returned checks. No external wallet app or per-payment human signature is used for already authorized work.

### P3-04. Results, assets, schedule and inspection, G3

- [ ] Task screen separates outcome, authority, settlement and delivery. Show each provider charge/hash/chainState, result checks, fallback reason and gross cost. Delivery failure remains visible even after alternate succeeds. FormSubmit=false is a valid negative inspection, not missing delivery.
- [ ] `COMPLETED + CLOSING` is allowed: useful output received while CLOSE pending. Show INCLUDED versus FINALIZED precisely. UNKNOWN gives retained-reservation explanation and retry/status controls without offering another Pay button. Link explorer only to correct Base Sepolia hash.
- [ ] Assets screen creates separate Liquidity Keeper task/Permit for deposit/redeem; show vault fixture, amount units/shares distinction, floor, caps, ratio and last signal timestamp. No fake APY/earnings or allocation guarantee after later spending. Warn on disabled redemption; no promise of instant recovery of vault funds.
- [ ] Schedule screen captures fixed recipient/amount/start/interval/window/count and presents total gross cap before native approval. Due/missed/paid periods reflect chain state; mark accelerated demo schedule explicitly. No automatic catch-up.
- [ ] Inspector screen shows all six Finding categories with PASS/FAIL/PENDING/UNVERIFIABLE, reason, evidence references and basis. Backend findings are service views; distinguish independently generated inspector report in demonstration. Explicit export action downloads authorized bundle through API; do not publish artifact URLs or logs automatically.
- [ ] Expose token issue/revoke UI with wallet/task/scope/expiry review and token once; evidence access opt-in. SDK/MCP agent cannot become owner through this UI. Clear auth/state on owner switch/logout; prevent old wallet cache leakage.

**Acceptance:** screen values match backend receipt/balances for healthy, broken-page, paid-failure/fallback, asset and schedule cases. No static mock is part of release recording.

## 4. Stop and recovery work during outages

### P3-05. Controls and standalone recovery sender, G3–G4

**Create:** Control/Recovery screens, offline trusted chain reads, `tools/relay-admin.ts`.

- [ ] Pause, revoke, unpause and recover actions request Admin draft, display actual command/nonce/expiry in native view, submit owner signature. Show local inhibit immediately and confirmed effect only at inclusion; disclose earlier ordered payments may already settle.
- [ ] Confirmed pause/RECOVER epoch change invalidates active and delayed signed drafts; unpause explicitly requires new task permissions. UI must not restart old task from cached ACTIVE state.
- [ ] API-offline screen obtains wallet via trusted factory mapping, checks owner/token/vault/chain against bundled manifest, reads `adminNonce/authorityEpoch/paused` directly from chosen trusted RPC. Construct Admin with current time/≤30min deadline and native sign; no cached nonce guessing.
- [ ] Export only `{schemaVersion:4,chainId,wallet,admin,ownerSignature,digest}` after deliberate user action. It is a spend-authorizing signed command, so no automatic third-party upload/analytics; owner chooses transfer to independent sender. Warn if near expiry; changed nonce requires fresh native signature.
- [ ] CLI validates schema/domain/wallet/owner signature and current nonce, uses Person1 ABI to simulate `applyAdmin`, then sends via independently funded relayer and separate RPC. CLI accepts relayer secret from secure environment/input only, never owner mnemonic/key; prints tx hash, receipt and actual recovery amount. Define `pnpm relay-admin --payload <json> --rpc <url>` command and document relayer funding.
- [ ] Test while API, worker and MPC are stopped: local owner RECOVER_LIQUID still submits and funds arrive at owner. With vault withdrawal disabled, RECOVER reports failure but preserves liquid escape; include Person1 review of gas/settings.

**Acceptance:** Q10/Q13 actual public transactions; owner word restoration on another installation retains independent control. No claim that RPC/network access or gas funding can be eliminated.

### P3-06. APK, documentation and integration proof, G4–G5

- [ ] App tests cover schema rejection, native vector parity, cancellation, secure backup/import, tenant/cache isolation, response-lost idempotency, expired login, unknown/reorg/closure state and accessibility/readable financial formatting.
- [ ] Build signed release APK from final source/lockfile/manifest, install on physical phone and perform entire G2 flow again. Record certificate SHA256, APK SHA256, device/OS, native package/build configuration and source tag. Signing certificate/private keystore stays secret; APK/README provide public fingerprints only.
- [ ] Supply screenshots/recording segments to Person4: setup/approval, close/reopen, failed+alternate delivery, six findings, assets/schedule, confirmed pause and independent recovery. Remove recovery words, secrets and native debug logs from capture.
- [ ] Write build/install/backup/restore/API-outage guide and known risks. Keep UI clear/testnet-visible; no app store submission or iOS work needed. Verify no frontend bundle contains API/provider/MPC/PAT/private signing credentials.
- [ ] Cross-review final approval with Person1, API/error states with Person2, and delivered-check interpretation/demo with Person4. Merge only owned changes with matching shared schema commit.

## 5. Verification and handoff

Implement `make check-mobile` to run TS checks/native vector and instrumentation checks, with physical-device checks explicitly recorded separately. Recommended public artifacts:

```text
evidence/person3/native-vectors.json
evidence/person3/device-checks.json
evidence/person3/offline-recovery.json
evidence/person3/apk.sha256
docs/mobile-build.md
docs/mobile-recovery.md
```

Each check records case, device, commit, expected/observed result and reference hash; do not include words/private keys. Gate G1 is owner signing+restore, G2 one complete purchase, G3 all screens/controls, G4 outage/edge cases, G5 installed release APK.

**Done means:** another owner can install APK, generate/back up owner, approve a task and see real result without external wallet prompts; that owner can pause/recover even if all our servers stop. React Native screens alone do not satisfy owner security.

## 6. Limits to state accurately

Keystore protects AES wrapping key; Ethereum signing takes place in native memory. Rooted/compromised app processes can still threaten unlocked secrets/transaction display. Recovery words and device loss have normal self-custody consequences. The owner uses conventional local signing, not MPC; online executor uses MPCium. Public-testnet funds/vault/risk fixtures do not demonstrate audited real-money custody.

Primary integration references: [Wallet Core Android](https://developer.trustwallet.com/developer/wallet-core/integration-guide/android-guide), [typed-message API](https://github.com/trustwallet/wallet-core/blob/master/include/TrustWalletCore/TWEthereumMessageSigner.h), [Android Keystore](https://developer.android.com/privacy-and-security/keystore), [EIP712](https://eips.ethereum.org/EIPS/eip-712). Pin actual working native artifacts during G1; these references do not substitute for phone qualification.


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
