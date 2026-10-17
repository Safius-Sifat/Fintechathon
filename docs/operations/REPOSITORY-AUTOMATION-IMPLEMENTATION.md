# Repository automation implementation record

Updated 2026-10-17. Follow [Automatic testnet delivery](AZURE-DELIVERY-DESIGN.md) for the current simplified design.

## Completed locally

- [x] One pinned GitHub Actions workflow: PR/main tests, backend image build/smoke; automatic Azure app delivery after successful main tests when enabled.
- [x] One host release script: contract acceptance, changed-contract deployment/existing-contract verification, generated address manifest, DB backup, migration, backend rollout and revision/manifest smoke checks.
- [x] One authoritative activation variable: GitHub `demo` environment `AZURE_DEPLOY_ENABLED`. Unset by default. No second repository switch or custom deployment controller.
- [x] Actual-receipt/code/finality manifest checks; retained versioned contract registry; interrupted-deployment reconciliation marker.
- [x] Dedicated migration configuration, verified production TLS, least-privilege role checks, ordered checksums, bounded locks, transactional files and error cleanup.
- [x] Key Vault managed-identity retrieval helper and private file materialization; no live secret retrieval performed.
- [x] Minimal team mapping/CODEOWNERS/PR template; no fictitious teammate identities or remote enforcement.
- [x] 13 operations unit tests, 16 migration/configuration unit tests, and 10 disposable real PostgreSQL16 tests passed (39 total). DB tests include a teardown case.
- [x] Workspace typecheck and frozen-lockfile dependency installation passed.
- [x] Actionlint1.7.12 workflow validation, repository policy checks and bash syntax checks passed.

## Not activated or proven yet

- [ ] Docker build and container smoke test: configured in CI, not run locally because Docker daemon is unavailable.
- [ ] Host release script, Azure OIDC/Run Command, Key Vault access, live backup/restore and backend rollback: require a provisioned Azure test environment and actual end-to-end rehearsal. Unit tests do not qualify them.
- [ ] Contract business implementation, shared DeploymentManifestSchema, Deploy.s.sol, pinned Foundry version/configuration and real acceptance commands: owned by the implementation team, still absent. Deployment deliberately stops without them.
- [ ] Provider/worker release services and their drain/readiness checks: API image/compose only is supplied here. Add implemented services before claiming full system deployment.
- [ ] Native app/SDK/verifier financial consumers: owners must consume the generated manifest and pass their existing handoff tests. This batch does not implement their wallet features.
- [x] Subsequent user-approved step: one 4 GiB app VM in Malaysia West, disk/network/static IP and an unprivileged managed identity provisioned; see infra/azure/deployed-app.json.
- [ ] Database/TLS/proxy, managed-identity permissions/vault configuration and GitHub environment variables: not provisioned.
- [ ] Commit, push, first GitHub CI run, branch protection, teammate invitations and deployment activation: not performed.

## Commands

```bash
./scripts/pnpm.sh install --frozen-lockfile
./scripts/pnpm.sh typecheck
./scripts/pnpm.sh test:ops
./scripts/pnpm.sh test:migrations
./scripts/pnpm.sh test:db
./scripts/pnpm.sh check:repository
bash -n scripts/ops/deploy-host.sh scripts/ops/backup-db.sh scripts/ops/container-smoke.sh
```

The DB test target creates its own loopback-only disposable PostgreSQL16.10 database and test-only certificate. It never uses `.env` or a user database. It needs local shared-memory/process permissions. Financial acceptance remains deliberately incomplete; successful operations tests do not qualify custody or payments.
