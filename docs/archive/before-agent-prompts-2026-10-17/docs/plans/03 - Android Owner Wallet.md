---
type: implementation-handoff
title: Person 3 — Android Owner Wallet
version: "6.0"
updated: 2026-10-17
status: specified-not-built
owner: Person3
---

# Person 3 — Android Owner Wallet

> Repository bootstrap added 2026-10-17. Read [README](../../README.md) and [setup](../SETUP.md) for existing foundation files. Continue from that code; financial features and acceptance gates remain unimplemented.

> Implementation handoff: execute the tasks in order, record acceptance on a physical phone and use the shared contract below for every integration. Your deliverable owns the user's signing experience. Implementation agents may work directly without delegation.

**Goal:** deliver a complete installed Android wallet: local accounts/backup/restore, personal send/receive, assets/history, transaction lifecycle, sessions/security, bounded agent approval and independent managed-fund control.

**Architecture:** React Native renders personal and managed balances, transfers, activity, sessions, tasks and inspection. Kotlin owns recovery words, accounts, encrypted storage, semantic transaction building/journaling, native confirmation and owner signing; a read-only quote adapter supplies OP-stack estimates. The online two-node MPC executor is operated by Person2; it is a separate key. After permission activates, the owner can close the app and the server continues within that permission.

**Stack:** Expo54 with its matching React Native version, native development/release Android build, Android12+, Kotlin, Trust Wallet Core JNI, authenticated Android Keystore wrapping key. No Expo Go, external wallet popup, embedded-wallet account or mobile threshold cryptography.

## Start here — current release scope and task order

**Required:** the complete personal-wallet and managed-agent flows in S8. **Deferred:** WalletConnect/external dApp connections; no WalletKit dependency, Reown projectId, dApp screen or pairing acceptance gate. External agent SDK/MCP access remains required.

Sections 2–6 and the wallet tasks in section 7 are one delivery. Follow the sequence below; wallet tasks are not work postponed until after the agent-only path. Existing bootstrap source needs W0 migration before new financial signatures. Documentation6, wallet domain5, Login2 and agent receipt/runbook schema4 remain unchanged by this handoff revision.

| Work order | Task IDs | Deliverable / dependency |
| --- | --- | --- |
| Native wallet first | `P3-01 + P3-W01` | Build/install native module; implement profile/accounts, optional import passphrase, backup, lock and exact restore before funding. |
| Manual transfers and owner approval | `P3-02 + P3-W02` | Use W0 domain5/Login2 vectors and S8.6 interfaces; ship receive/QR, real personal ETH/reviewed ERC20 send, nonce journal and managed OwnerTransfer. |
| Connected account and agent flows | `P3-03 + P3-W03` | Use native-protected refresh/session handling, factory wallet discovery, scoped task approval and verified activity. |
| Inspect and independently recover | `P3-04 + P3-05` | Show actual work/payment/authority separately; independent Admin/OwnerTransfer relay works without API/MPC. |
| Whole-app release | `P3-W04 + P3-06 + P3-W05` | Qualify every required screen and WQ case on a physical device, then produce the signed APK and reproducible build instructions. |

**Completion record:** for each task record source commit, shared-schema commit, command/device or chain reference, observed result and known gaps. Unrun or failed cases stay incomplete. Both original G/Q and wallet W/WQ gates apply; no acceptance or implementation tests were executed by updating this document.

## 1. Complete deliverables

| Output | Owned files | Acceptance |
| --- | --- | --- |
| App shell/data | `apps/mobile/src/{api,config,state,navigation,components}` | Trusted chain/manifest, authenticated API, no seed in JS |
| Owner module | `modules/owner-wallet/android/src/main/java/.../{OwnerWalletModule,WalletProfile,AccountStore,SeedStore,TypedSigner,ScopeValidator,PersonalTransferBuilder,FeeEstimator,NativeTransactionJournal,NonceCoordinator,OwnerOperationRelay,NativeSession,AppLock,NativeApprovalActivity,RecoveryActivity}.kt` | Accounts/backup/import, semantic sends/replacement/cancel, protected sessions and native confirmation |
| Screens | `apps/mobile/src/screens/{Onboarding,Accounts,Home,Receive,Scan,Send,TransferReview,TransactionDetail,TokenDetails,Contacts,Activity,Security,TaskCreate,Approval,Task,Assets,Schedule,Inspector,Control,Recovery,Network,Help}.tsx` | Complete flow with real API and actual chain states |
| Independent sender | `tools/relay-admin.ts` and README | Submit exported Admin/OwnerTransfer through another RPC with backend offline; native personal-gas relay is also required |
| Release | `apps/mobile/android`, `docs/mobile-build.md`, `evidence/person3` | Installable APK, exact native dependency pins, restore/control evidence |

Person1 supplies schema/ABI/trusted manifest. Person2 supplies public API. Person4 supplies typed task inputs/results and inspection findings. You do not reimplement policy/backend or embed the server's MPC shares in the app.

## 2. Protect and prove owner authority first

### P3-01. Native build and owner lifecycle, G1

**Create:** module/package wiring, Kotlin files, native recovery UI, Android instrumentation fixtures.

**Consumes:** Login2/Permit5/Admin5/OwnerTransfer5/account/transfer fixture JSON from Person1. **Produces:** the S8.6 native interfaces and stable local derived owner accounts.

- [ ] Set up Expo native development build and physical Android12+ phone with secure screen lock. Pin Wallet Core Android artifact/version and build credentials. GitHub package-download PAT with minimum package-read scope is a build secret, never app runtime configuration. Check dependency license and load JNI library successfully before building screens.
- [ ] Native Wallet Core generates128bit BIP39 entropy/12-word mnemonic, derives Ethereum `m/44'/60'/0'/0/0`. Use Wallet Core import/checksum validation, no custom mnemonic/HD math. Create/restore run in native UI; JS receives public Account/profile metadata only; optional import passphrase and additional indexes follow P3-W01/S8.1.
- [ ] SeedStore encrypts native seed representation AES256GCM with unique IV and Android Keystore non-exportable AES key requiring biometric/device credential authentication. Bind operation with BiometricPrompt/CryptoObject as supported by configured API; cancellation returns explicit cancellation error with no signature. Authentication timeout must not permit silent later JS signing requests.
- [ ] Native RecoveryActivity shows words, disables screenshots/clipboard/autofill, prompts selected word positions and marks backupConfirmed only after correct answers. No seed words in logs, analytics, crash reports, JS errors, AsyncStorage or bridge objects. Restore input is native; clear temporary buffers/free Wallet Core handles after use where possible.
- [ ] Exclude encrypted seed/metadata from Android cloud backup/device transfer; test uninstall/restore semantics. Explain loss of device+words means no server recovery. Preserve consistent address formatting/checksum. Gate wallet creation/funding/task approval on backupConfirmed.
- [ ] Restore the same words in separate test installation/device and compare exact address. Cancellation/wrong words/device-lock/invalidation must fail closed, never create another silent owner.

**Acceptance:** native create→word confirmation→listAccounts/getAccount works; import restores same address; network traffic/API payloads contain no words/private keys. Record physical device model/Android version, native package pin and observed restore result.

### P3-02. Typed scope validation and native confirmation, G1–G2

**Create:** TypedSigner/ScopeValidator/NativeApprovalActivity, golden-vector instrumentation tests.

- [ ] Expose only S8.6 methods. No arbitrary digest, caller-built raw transaction or private-key export. Native semantic transfer and specific owner-operation relay build their own transactions. signLogin binds exact Login2 domain/type/origin/deviceId and≤5min challenge. signPermit/Admin/OwnerTransfer accept exact S3/S8 schema/domain, selected owner and trusted wallet; reject unknown type fields/chain/address/version.
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
- [ ] Sign one-use Login from `/v1/auth/challenge`, exchange at verify, keep15min JWT in memory and refresh through native-protected rotation; fresh signed login when session expires/revokes/replay is detected. Store revocable agent tokens only when explicitly created; no background login signing without native confirmation.
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

## 7. Complete Android wallet — required v6 tasks

These tasks make the app usable for personal funds, managed funds and agent work. They replace the earlier narrow single-account, typed-approval-only mobile scope. Read S8 before changing native signing interfaces; no backend or SDK receives the owner private key.

### P3-W01. Account lifecycle, lock and backup, W0–W1

**Files:** `modules/owner-wallet/android/.../{WalletProfile,AccountStore,OwnerWalletModule,SeedStore,RecoveryActivity,AppLock}.kt`, `apps/mobile/src/screens/{Onboarding,Accounts,Security}.tsx`.

- [ ] Native generate12words; import validated supported BIP39 lengths+optional passphrase. Store profile/optional passphrase/indexes/labels encrypted; derive account0..19 at fixed Ethereum paths. Additional account index needs native unlock, cannot silently select another path. Restore lists first5 and lets owner reveal more; no false claim all accounts empty.
- [ ] Implement S8 Account bridge instead of getOwner single-address model; scope every signature/cache/session/pending nonce to selected accountId/address. Account switch clears prior visible data and rebinds account/API context. Labels/contacts are local encrypted metadata and need explicit restoration limits.
- [ ] Default60s inactivity/background lock; signing/backup always native confirmation+fresh auth. Device credential fallback, cancellation/enrollment failure and no secure-screen-lock cases fail safely. Keep seed and BIP39 passphrase off JS/network/screenshots/clipboard; public receive address copy remains allowed.
- [ ] Security settings include backup status/show native words, auto-lock, current build/chain, session/agent-token controls, logout and deliberate local wallet removal. Removal warns that funds/agents remain and offers confirmed pause first; session logout never deletes seed.

**Finished:** same words+passphrase+index restores same personal owner, factory wallet discovery and independent control; cross-account screen/cache/session leakage is absent.

### P3-W02. Real receive/assets/send/review flow, W1–W2

**Files:** native `PersonalTransferBuilder`, `FeeEstimator`, `NativeTransactionJournal`, `NonceCoordinator`, `OwnerOperationRelay`; RN `Home/Receive/Scan/Send/TransferReview/TransactionDetail/TokenDetails/Contacts`.

- [ ] Home clearly separates personal EOA from managed wallet, source-specific assets/spendable/gas and approved vault position. Never show executor address as receive destination. Receive copy/share/chain-qualified QR; scanner parses constrained ERC681 and plain addresses with visible84532 chain. Reject unsupported chain/function/precision/duplicate params; scan only prefills draft.
- [ ] Import/hide up to20ERC20 tokens per account using RPC code/metadata/decimals; reject invalid metadata/code, sanitize names and show full token address; unqualified imports are watch-only, and sending requires the manifest-backed reviewed standard-token registry. Never claim metadata/eth_call proves arbitrary token safety. Contacts are labels, not trusted recipient identity. Format decimal input to integer units without float arithmetic; max amount accounts for ETH gas.
- [ ] Implement native PersonalTransferRequest/Preview and EIP1559 signing for ETH or exact ERC20 transfer. Native—not JS—constructs calldata, owns sender/nonce/fee/balance/simulation checks, displays actual terms, expires quotes≤30s and recomputes before signing. Fee estimator includes Base L1 data cost. Token send requires personal ETH; agent relayer-sponsored fees are labelled separately.
- [ ] Persist encrypted signed raw tx/hash/nonce before direct RPC broadcast; source account mutex includes manual transfer/owner-operation relay. Retry same operationId/clientRequestId uses same bytes; restart does not double-send. UNKNOWN preserves uncertainty; speed-up/cancel have fresh native fee confirmation and same nonce. Cancel is only successful when the cancel replacement wins canonical inclusion.
- [ ] Managed Send uses OwnerTransfer5, shows that all agents will pause/need fresh grants, then backend relay. With API unavailable, relayOwnerOperation constructs only exact known Admin/OwnerTransfer call using personal gas, or exports signed command for independent sender. It never signs arbitrary server calldata.

**Finished:** real personal ETH/ERC20 send/receive, agent-wallet funding and owner-controlled managed transfer all work; cancellation/insufficient gas/rejected confirmation never produce a false success. WQ03–08/12/13 have actual observations.

### P3-W03. Sessions, history and error states, W2–W3

- [ ] NativeSession performs trusted-origin HTTPS login exchange/refresh; refresh credential encrypted natively, only15min access token crosses to JS. Login2 binds selected account/deviceId; native signed-login auth_time remains distinct from refresh. Implement single-flight rotation and fresh-login recovery after lost response/revoked token.
- [ ] Activity merges native pending journal with backend normalized verified history; source/type/fees/status/replacement lineage clearly shown. Cache stale data visibly; pagination/coverage/indexer unavailability and restored-old-history gaps cannot become verified empty balance/history. Balance uses RPC even if indexer fails.
- [ ] Device session list/revoke, agent-token revoke are separate from on-chain permission revoke. Logout explains agents may continue; Stop Agent shows confirmed epoch, not only local inhibit. App lock does not stop online approved work.
- [ ] Add first-run/provisioning/loading/empty/offline/RPC failure/401/quote expiry/fee change/reorg/UNKNOWN/delivery-failure/accessibility/permission-denial views and recovery buttons. A retry cannot create a new financial request automatically. Never render remote metadata as executable HTML.

**Finished:** WQ02/06/09–12 pass without account regeneration or loss of owner authority; user can understand who holds funds and whether work/payment/permission is finished.

### P3-W04. Whole-app usability, error and permission qualification, W4

- [ ] Connect every required screen to real native/API/RPC behavior: account/source selector, asset list/details/import/hide, receive/copy/share/scan, contacts, send/review/details, activity pagination, agent task/control, sessions/tokens/security/funding/help. No disabled advertised core action or disconnected prototype route.
- [ ] Support denied camera/biometric permission, unsupported URI, cancelled approval, double tap, back navigation, app background/lock, font scaling and screen-reader financial labels. Only explicit native confirmation can sign; tapping twice or returning from background cannot submit twice.
- [ ] Present loading/empty/stale/unavailable distinctly. Native journal details remain visible with API outage; account switch cannot reveal another account's private activity/refresh context. Never show obsolete fee quote or UNKNOWN as successful payment.
- [ ] Network page identifies Base Sepolia only; help explains faucet/test tokens, source address/fee payer, session logout versus stop and wallet removal. WalletConnect/dApp screens/dependencies are deferred per user; no unusable Connect button is advertised.

**Finished:** WQ14 has actual physical-device accessibility/navigation/permission/cancel observations and the complete everyday-wallet journey is usable without developer intervention.

### P3-W05. Complete installed release, W5

- [ ] Implement all S8 screen groups, reachable navigation, account/source distinctions and testnet network/faucet/help/settings. Build/install signed APK against actual domain5 deployment manifest; no mock figures/disabled advertised core controls.
- [ ] Record WQ01–14 mobile results plus original native/agent/outage cases. Rebuild from tag, document secret-free install/restore/fee/session instructions and give Person4 full-app capture segments. Unfinished flow remains explicitly incomplete, never a completed wallet claim.

**Reviewers:** Person1 actual signed fields/native ABI; Person2 auth/history/idempotency; Person4 payment-request/result interpretation and usable complete journey.


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
