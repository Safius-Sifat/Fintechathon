# Delivery implementation record

Use [LIVE-SETUP](LIVE-SETUP.md) for the operating procedure.

## Implemented and checked

- One pinned workflow with PR/main tests and automatic main deployment through OIDC.
- Source published after the user's explicit164-file approval and a Gitleaks8.30.1 scan with no findings.
- 42 cases: 16 operations unit cases,16 migration/configuration cases,10 real PostgreSQL16 cases including teardown. Docker build and production-user/read-only smoke checks run in CI.
- Ordered, checksummed, locked, transactional migrations with production TLS and non-admin role checks.
- App VM, native TLS database, separate service roles, protected migration ledger, app Key Vault and managed-identity configuration retrieval.
- Valid HTTPS certificate on the Azure-provided hostname.
- Encrypted off-VM backup upload and actual disposable restore; hourly timer and pre-migration backup.
- App-VM-scoped OIDC identity, main-only environment, PR/CI policy and secret push protection.

## Boundaries

- Current code is a foundation backend. Financial readiness/manifest endpoints deliberately503; no wallet/MPC/deployer key or chain transaction is created here.
- Wallet-mode deployment requires actual implementations and acceptance; it cannot bypass those gates.
- Worker/provider/native/MPC deployment is separate. The current compose release supplies the API only.
- No teammate invitations or invented independent reviewers. No high-availability or full production financial qualification is claimed.
- Main delivery status must be verified in GitHub Actions and against the exact revision from HTTPS health. Failed releases retain reconciliation state when required; do not label configured wiring as successful deployment.

## Repeatable local checks

```bash
./scripts/pnpm.sh install --frozen-lockfile
./scripts/pnpm.sh typecheck
./scripts/pnpm.sh test:ops
./scripts/pnpm.sh test:migrations
./scripts/pnpm.sh test:db
./scripts/pnpm.sh check:repository
```

The DB target uses a disposable loopback PostgreSQL16.10 fixture and never the developer .env database. The live server uses the security-updated PostgreSQL16 package. Tests do not certify custody or payments.
