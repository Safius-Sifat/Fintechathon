# Mandate Wallet — fintechathon

Owner-controlled agent wallet for PBCSF Topic F. Four-person implementation workspace, specificationv5, Base Sepolia84532.

## Start here

1. [Setup](docs/SETUP.md) and [current bootstrap status](docs/BOOTSTRAP-STATUS.md)
2. [Master plan](FINAL%20PLAN.md)
3. [PRD](PRD.md), [architecture](architecture.md), [pitch](pitch.md), [review](review.md)

| Person | Handoff | Owned result |
| --- | --- | --- |
| 1 | [Contracts/shared interfaces](docs/plans/01%20-%20Contracts%20and%20Shared%20Interfaces.md) | Financial contracts, schemas/ABI and deployment |
| 2 | [Platform/policy/MPCium](docs/plans/02%20-%20Platform%20Policy%20and%20MPCium.md) | Runtime, durable funds, signing and infrastructure |
| 3 | [Android wallet](docs/plans/03%20-%20Android%20Owner%20Wallet.md) | Local owner key/native signing/app/recovery |
| 4 | [Agents/services/inspection/demo](docs/plans/04%20-%20Agents%20Services%20Inspection%20and%20Demo.md) | Real tasks/providers/integrations/independent evidence/demo |

## Local startup

Use Node22.23.3 and pnpm10.20.0 (see .nvmrc/packageManager). Make targets use scripts/pnpm.sh to bootstrap those versions through npm when your installed versions differ; global tools stay unchanged. First use requires network access.

```bash
make setup
make infra-up
make db-migrate
make dev-platform
```

Other terminals: `make dev-provider`, `make dev-mobile`. Docker daemon required for infrastructure; Android native tooling/device required for installed app. Full details/environment and ownership in [SETUP](docs/SETUP.md).

## What currently works

Workspace dependency linking/typecheck, shared authority structural schemas/hash functions, local infrastructure configuration, metadata migration runner, process-health API/provider entry points and minimal Android app entry. `/healthz` is liveness only, `/readyz` deliberately503. Financial routes/worker/policy/runbooks/verifier/MCP explicitly fail until their owners implement them. SDK only has read-request foundation. Solidity shared structs supplied; five business contracts are not implemented/deployed. Native owner module and MPC signing integration are not yet supplied.

No wallet seed/share/key, testnet transaction, deployment result or completed security acceptance is created by this bootstrap. [Historical documents](docs/archive/pre-bootstrap-2026-10-17/) are preserved; current plans supersede old Circle/guard/five-person assumptions. The repo root itself is the monorepo root.
