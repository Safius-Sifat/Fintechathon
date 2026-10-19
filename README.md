# Mandate Wallet — fintechathon

Owner-controlled agent wallet for PBCSF Topic F. Four-person implementation workspace, specification 7.0, Base Sepolia 84532. v7 adds a real LLM agent (Claude Agent SDK) and Cobo/Circle-class policy controls; see architecture A8/A9/S9 and FINAL PLAN section 9.

## Start here

1. [Setup](docs/SETUP.md) and [current bootstrap status](docs/BOOTSTRAP-STATUS.md)
2. [Master plan](FINAL%20PLAN.md)
3. [Complete app](docs/COMPLETE-APP.md) and [v6 migration](docs/PLAN-MIGRATION-v6.md)
4. [PRD](PRD.md), [architecture](architecture.md), [pitch](pitch.md), [review](review.md)
5. [Team coordination and merge rules](docs/COORDINATION-AND-MERGE-POLICY.md)
6. [Security self-assessment](docs/security-self-assessment.md) and [contract security notes](docs/contracts-security.md)

| Person | Handoff | Owned result |
| --- | --- | --- |
| 1 | [Contracts/shared interfaces](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md) | Financial/owner-transfer contracts, schemas/ABI and deployment |
| 2 | [Platform/policy/MPCium](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md) | Runtime, sessions/history/owner relay, signing and infrastructure |
| 3 | [Mobile wallet (Android, iOS)](docs/plans/03%20-%20Android%20Owner%20Wallet.md) | Complete local wallet/send/receive/accounts/sessions/security/recovery |
| 4 | [Agents/services/inspection/demo](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md) | Real tasks/providers/payment-request fixtures/integrations/independent evidence/complete-app demo |

## Local startup

Use Node22.23.3 and pnpm10.20.0 (see .nvmrc/packageManager). Make targets use scripts/pnpm.sh to bootstrap those versions through npm when your installed versions differ; global tools stay unchanged. First use requires network access.

```bash
make setup
make infra-up
make db-migrate
make dev-platform
```

Other terminals: `make dev-provider`, `make dev-mobile`. Docker daemon required for infrastructure; Android or iOS native tooling and a device required for the installed app. Full details/environment and ownership in [SETUP](docs/SETUP.md).

## What currently works

Workspace dependency linking/typecheck, shared authority structural schemas/hash functions, local infrastructure configuration, metadata migration runner, process-health API/provider entry points and minimal Android app entry. The API now supplies [wallet-signed owner sessions](docs/api/OWNER-SESSIONS.md), rotating refresh, revocation and account isolation when auth/database settings are configured. `/healthz` is liveness only, `/readyz` deliberately503. Financial routes/worker/policy/runbooks/verifier/MCP explicitly fail until their owners implement them. SDK only has read-request foundation. Solidity shared structs supplied; five business contracts are not implemented/deployed. Native owner module and MPC signing integration are not yet supplied.

No wallet seed/share/key, testnet transaction, deployment result or completed security acceptance is created by this bootstrap. [Historical documents](docs/archive/pre-bootstrap-2026-10-17/) are preserved; current plans supersede old Circle/guard/five-person assumptions. The repo root itself is the monorepo root.


## Required complete-app scope, not yet implemented

Plans6 now require personal ETH/ERC20 and managed-owner sends, QR/contacts/token import/history, multiple accounts/backup/restore, pending/replacement/cancel, device/API sessions and local security. Personal transactions sign locally; managed OwnerTransfer5 stops old agents; agent spending remains under its own Permit5/MPC controls. The shared schema is migrated to wallet domain 5/Login 2/Invoice 2 with TS and Solidity golden vectors; contracts, API, mobile and other consumers still need implementation and consumer acceptance before signing; this planning update did not implement those features. WalletConnect/external dApp connections are deferred; no WalletKit dependency or Reown projectId is required. No all-network/DeFi MetaMask parity is claimed.

## Automatic testnet delivery

See the [single deployment workflow and one-time Azure setup](docs/operations/AZURE-DELIVERY-DESIGN.md), plus the [executed checks and remaining activation work](docs/operations/REPOSITORY-AUTOMATION-IMPLEMENTATION.md). After activation: tests → contracts/verified addresses → DB backup/migrations → backend → smoke checks. Pipeline wiring is prepared; cloud delivery and financial features remain unqualified.
