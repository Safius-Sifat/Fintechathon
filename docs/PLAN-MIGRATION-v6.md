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

Runtime `DOMAIN_VERSION='4'`, Login schema/type list and original Solidity layouts currently remain bootstrap values. `/readyz` must remain503; no financial route should be advertised as compatible until W0 migration and actual acceptance pass. No stubs become successful mock signing/payment routes.

## 3. Resource and deployment additions

- Server-only `ETHERSCAN_API_KEY`, API V2 chain84532 route/quota qualification, private history/backfill worker and RPC receipt verification. Chain support was confirmed through public Etherscan chain list; authenticated endpoint/account access is not yet qualified.
- WalletConnect/external dApp connections are deferred by user choice: no WalletKit dependency, Reown projectId or dApp-method implementation is required. Native QR/deep-link receive input still needs strict validation and real transfer confirmation.
- Native direct trusted Base Sepolia RPC configuration, OP-stack-aware fee estimator and personal ETH funding for independent send/owner-operation gas. Do not embed server indexer/signing secrets in APK.
- Refresh-token hash/family/session/revocation metadata, original login auth_time, rotation handling and native refresh credential storage. No email/vendor authentication dependency or owner secret on server.
- MandateWallet/Factory new deployment/domain5, payable ETH receive and OwnerTransfer event/nonce; new public manifest version fields. MCP proposal remains unqualified against upstream≥3node deployment guidance until its own gate passes.

## 4. Merge and acceptance order

W0 exact fixtures/types before new signing; W1 personal wallet/source separation; W2 owner transfer/managed funds; W3 history/session/restart/outage; W4 full-app navigation/permission/confirmation qualification; W5 installed full release. Preserve original agent G/Q cases and add WQ01–WQ14. Cases specified in plans are not results from this update.

The internal Oct18/official Oct20 deadline remains; expanded mandatory scope does not certify delivery capacity. Record actual gate times and feature completeness. Every advertised core screen needs actual behavior; no wallet/executor/custody key is generated or published by this plan migration.
