# Plan migration — v5 bootstrap to v6 complete app

**This is an implementation instruction, not a completed source migration.** User authorized plan updates; application source, keys, deployments and implementation tests are unchanged by this revision. Current source is a v5 bootstrap with unimplemented financial functionality.

## 1. Versions and first commits

| Surface | Bootstrap | Required v6 implementation |
| --- | --- | --- |
| Documentation |5.0 |6.0 |
| Wallet EIP712 domain |MandateWallet/4 |MandateWallet/5 |
| Login domain/type |MandateLogin/1, no deviceId |MandateLogin/2, deviceId field |
| Owner command |Admin only |Admin + OwnerTransfer with independent nonce/epoch |
| Native owner interface |Single-account typed-signing plan |Account/profile methods, semantic transaction builder/journal, session storage and secure receive/confirmation flows |
| Receipt/runbook schema |4 |4, unchanged agent format; manual WalletActivity is separate |
| Invoice/Delivery domains |1 |Invoice 2 (adds asset, v7) / Delivery 1 |

Person1 first updates `packages/schema/src/{authority,hashing,runtime}.ts`, Solidity MandateTypes and fixtures/ABI. Person2/3/4 consume that same schema commit. No source component may sign new-domain payloads by silently substituting a domain number at its boundary. New deployed contract implements declared OwnerTransfer semantics. No live contract has been deployed by this task; no user migration exists yet.

## 2. Existing files to evolve

| Owner | Existing source/config | Required extension |
| --- | --- | --- |
|1 |Schema authority/hash/runtime exports; contract struct library |Domain5/Login2/new typed operation; account/assets/activity/session/native strict DTOs; real contracts/ABI |
|2 |Health-only API/platform/migration runner; worker/policy/Go placeholder directories |Signed auth/session lifecycle, business migrations/history indexer, owner transfer relay and existing durable agent runtime/MPC qualification |
|3 |Expo App status screen and native README |Native profile/accounts/backup/signing/personal transfer journal, sessions, QR/assets/activity/security controls |
|4 |Runbook/verifier/MCP fail-closed entries and read SDK |Real services/runbooks/verifier; OwnerTransfer attribution; payment-request fixtures and complete-app evaluation |

*(Historical, before 2026-10-18.)* The bootstrap used `DOMAIN_VERSION='4'`, Login 1 and the original Solidity layouts; section 5 records their replacement. `/readyz` must remain503; no financial route should be advertised as compatible until W0 migration and actual acceptance pass. No stubs become successful mock signing/payment routes.

## 3. Resource and deployment additions

- Server-only `ETHERSCAN_API_KEY`, API V2 chain84532 route/quota qualification, private history/backfill worker and RPC receipt verification. Chain support was confirmed through public Etherscan chain list; authenticated endpoint/account access is not yet qualified.
- WalletConnect/external dApp connections are deferred by user choice: no WalletKit dependency, Reown projectId or dApp-method implementation is required. Native QR/deep-link receive input still needs strict validation and real transfer confirmation.
- Native direct trusted Base Sepolia RPC configuration, OP-stack-aware fee estimator and personal ETH funding for independent send/owner-operation gas. Do not embed server indexer/signing secrets in APK.
- Refresh-token hash/family/session/revocation metadata, original login auth_time, rotation handling and native refresh credential storage. No email/vendor authentication dependency or owner secret on server.
- MandateWallet/Factory new deployment/domain5, payable ETH receive and OwnerTransfer event/nonce; new public manifest version fields. MCP proposal remains unqualified against upstream≥3node deployment guidance until its own gate passes.

## 4. Merge and acceptance order

W0 exact fixtures/types before new signing; W1 personal wallet/source separation; W2 owner transfer/managed funds; W3 history/session/restart/outage; W4 full-app navigation/permission/confirmation qualification; W5 installed full release. Preserve original agent G/Q cases and add WQ01–WQ14. Cases specified in plans are not results from this update.

The internal Oct18/official Oct20 deadline remains; expanded mandatory scope does not certify delivery capacity. Record actual gate times and feature completeness. Every advertised core screen needs actual behavior; no wallet/executor/custody key is generated or published by this plan migration.

## 5. W0 schema migration record (v7)

**Status:** the shared-schema part of W0 is complete (TypeScript and Solidity agree on all vectors). The W0 gate as a whole is **not** complete: Go, Kotlin/Wallet Core, API and verifier consumers must still reproduce the fixture digests, and wallet contract enforcement, API, mobile and agent work remain unimplemented.

The shared schema now implements wallet domain 5, Login 2, Invoice 2, Delivery 1 and evidence schema 4 with the v7 types. Bootstrap `DOMAIN_VERSION = "4"` and the Login1 layout are removed; old domains are rejected, not rewritten.

| Area | Files |
| --- | --- |
| Types and domains | `packages/schema/src/{runtime,primitives,domains,authority,policy}.ts` |
| Hashing | `packages/schema/src/hashing.ts` (EIP-712 typed data, struct hashes, digests, signer recovery, RFC 8785, list hashes) |
| DTOs | `packages/schema/src/{conditions,provider,agent,evidence,api,runbook,accounts,assets,activity,sessions,manifest}.ts` |
| Vectors | `packages/schema/fixtures/*-v7.json`, built by `packages/schema/scripts/vectors.ts` with public Anvil test keys only |
| Solidity | `packages/contracts/src/{MandateTypes,MandateHashes}.sol`, `packages/contracts/test/MandateHashes.t.sol` |
| Checks | `make check-schema` → `scripts/check-suite.mjs` (fails on zero tests or a missing toolchain); CI runs the schema suite |

Clarifications fixed at W0:
- Fixture files are named `<object>-v7.json` (specification 7.0), replacing the `-v5.json` names in the Person1 deliverables table.
- `Conditions.liquidity.amountUnits` is the owner-approved maximum; the agent's `SET_AMOUNT` answer must not exceed it.
- `Permit.templatesHash` is the zero hash when no templates are used; WalletPolicy list hashes always hash the array encoding, including an empty list.
- Recipients, template IDs, asset caps and call templates must arrive sorted and unique; noncanonical input is rejected, never re-sorted.

Consumers regenerate nothing: import `@mandate/schema` and test against the committed fixtures. Change vectors only through `pnpm --filter @mandate/schema vectors`, and review the diff.

### 2026-10-18 review fixes

- CallTemplate gains `targetCodeHash`; `templateId` is the content hash of the definition (`callTemplateId`), checked in schema and Solidity.
- x402: `X402AcceptsSchema` follows x402 v2 (`network: "eip155:84532"`, `amount`, `extra` with the signed Mandate invoice). The EIP-3009 authorization is derived from the X402 Action (`x402Authorization`, `x402AuthorizationDigest`, `x402Signature`); the old free-form `ActionIntent.x402` field is removed. PAY and X402 intents require the invoice.
- Provider check requests carry `asset`; new `PushRegisterRequestSchema` and `InhibitClearRequestSchema`.
- New fixture `x402-v7.json`, pinned to the on-chain Base Sepolia USDC domain separator.
