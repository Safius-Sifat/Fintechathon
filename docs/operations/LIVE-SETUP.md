# Azure delivery runbook

## Environment

| Component | Configuration |
| --- | --- |
| API | https://mandate-demo-04323111.malaysiawest.cloudapp.azure.com |
| App VM | `mandate-app-demo`, Malaysia West;2vCPU/4GiB/32GiB Standard SSD |
| Database | Native PostgreSQL16; loopback only; verified TLS; schema `mandate` |
| Secret store | `mandate-app-kv-04323111`; version-pinned secret references |
| Backups | `mandatebackup04323111/dbbackups`; hourly and before every migration |
| Source | https://github.com/Safius-Sifat/Fintechathon |
| Workflow | `.github/workflows/foundation.yml` |

## Normal development

1. Create a branch and open a PR. `Repository tests` must pass for the exact head before merge.
2. CI runs typecheck, operations/configuration tests, real PostgreSQL tests, a Docker build and a production-user container smoke test.
3. Main is tested again. GitHub OIDC authenticates an identity scoped to Run Command on this app VM.
4. The host fetches the exact tested main commit, refreshes version-pinned app configuration, builds an immutable local API image, uploads a database backup, applies pending migrations and recreates the backend container.
5. A release succeeds only when the backend reports the exact commit and the required process/database/manifest checks pass. An API start/health failure attempts to restore the previous compatible code; the release stays failed.

`AZURE_DEPLOY_ENABLED` is a **repository variable** because the job condition is evaluated before environment variables load. Its initial setup sets it true only after the source PR tests pass. The `demo` environment supplies Azure tenant/subscription/client/VM IDs and permits the main branch only. No Azure client secret, GitHub PAT or wallet key is stored in the workflow.

Main requires the GitHub Actions `Repository tests` check and a PR. Approvals are0 until teammate identities are supplied; this is not independent review. The owner retains emergency administrative bypass. Secret scanning and push protection are enabled by GitHub.

## Product stage

`/opt/mandate/config/release-mode` is operator-owned. Initial mode is `foundation`:

- `/healthz`:200 with `stage:bootstrap` and the deployed Git commit.
- `/health/db`:200 only after an actual verified-TLS query as the runtime role.
- `/readyz`:503. Financial acceptance is incomplete.
- `/deployment.json`:503. No fake contract addresses are supplied.
- Wallet/payment/agent routes remain unimplemented. This operations setup does not build those features.

After the implementation owners supply actual contracts, acceptance tests, the strict shared manifest schema, Foundry pin, deployment script/public configuration and a dedicated valueless testnet deployer keystore, switch the operator-owned mode to `wallet`. That mode runs the real schema/contract/platform/agent gates, deploys changed contract inputs or verifies the existing registry, checks finalized receipts and bytecode, generates the shared manifest, and then follows the same backup/migrate/backend flow. It additionally requires real financial readiness. Missing requirements stop release.

Existing wallets are never automatically migrated to new contract addresses. Android/SDK/verifier owners must consume the generated manifest and enforce the trusted-chain/code checks from their handoffs. Worker/provider/MPC hosts are not deployed by the API compose file.

## Credentials and database

The VM managed identity has `Key Vault Secrets User` on the app vault and backup access on the one Blob container. The temporary initialization write role was removed. The host deployment user reads configuration directly from IMDS and Key Vault; Azure CLI is not needed on the VM. The API runs as UID10001, without capabilities or new privileges. A persistent host firewall rule blocks that UID from Azure IMDS, and Caddy’s administration API is disabled, so the API cannot obtain the deployment identity or its migration/backup credentials. Configuration is injected into the container with runtime-only DB credentials. Secret files remain mode0600 under `/opt/mandate/private`; no values are committed or sent through chat.

- `mandate_runtime`: app DML; no schema DDL and no migration-ledger writes.
- `mandate_migrator`: non-admin owner of the application schema; used only by the migration container.
- `mandate_backup`: database read access for complete current-schema dumps.

Migrations are immutable numbered files plus `apps/api/migrations/manifest.json`. Add a new migration rather than editing an applied file. Automatic migrations are conservative transactional expansions; their lint does not prove compatibility. The runner uses checksums and a bounded advisory lock. The public DB CA certificate is validated as certificate-only PEM and exposed read-only as0644; passwords and private keys are never included in that exception. The reserved ledger is pre-created with migration-owner privileges before app default grants. Database credentials, TLS keys and wallet/MPC identities have separate roles; this setup creates no wallet or MPC key.

## Backup and recovery

`mandate-backup.timer` schedules hourly dumps. Each deployment also requires a backup before migration. The archive is checked with pg_restore and uploaded over TLS to a private Azure Blob container using managed identity. Storage encryption, versioning and7-day soft-delete are enabled; lifecycle rules expire base blobs/versions after7days. Local dumps are retained7days. Backups contain no wallet seed or MPC share.

An actual off-VM archive was downloaded and restored to a disposable PostgreSQL database during setup; the verification database was dropped afterwards. Repeat restores after schema/privilege changes, especially if adding row-level security.

An interrupted broadcast, failed migration or failed rollout leaves `/opt/mandate/state/needs-reconciliation`. Inspect the private release log, real transaction receipts if applicable, migration ledger and current container before clearing it. Earlier committed migration files may remain applied. Do not run automatic SQL down migrations or remove the marker blindly.

```bash
# Safe control-plane inspection; no credentials printed.
az vm get-instance-view -g mandate-demo-rg -n mandate-app-demo -o table
# Inside VM through an authorized admin session:
systemctl status mandate-backup.timer
sudo -u mandate-deploy cat /opt/mandate/state/current
```

Root-owned `/opt/mandate/bin/deploy` is installed from the reviewed deployment script. Updates to that controller require an explicit operator installation; ordinary releases fetch application source from main. Logs are private under `/opt/mandate/logs`. Each deployment keeps only the running and previous release worktrees and API images, clears the Docker build cache, and stops before building when the app disk has less than 4 GB free.

## Limits

A single VM and local PostgreSQL are a competition setup with brief Compose restart downtime, not high availability. MPC signing infrastructure, provider/worker rollout, app authentication features and full wallet acceptance are separate implementation work. Direct SSH is restricted to the owner's configured IP; Azure Run Command is the verified deployment/admin channel. The current network may block direct SSH22. Future DNS/NSG changes should be reflected in `infra/azure/app-vm.json`.
