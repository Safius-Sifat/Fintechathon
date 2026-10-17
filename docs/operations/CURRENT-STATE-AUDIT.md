# Delivery configuration — 2026-10-17

Current runbook: [Azure delivery](LIVE-SETUP.md). Live release results are authoritative in [GitHub Actions](https://github.com/Safius-Sifat/Fintechathon/actions) and the API health endpoint.

| Area | Configured state |
| --- | --- |
| Source/CI | Reviewed bootstrap published through PR1; typecheck,44 operation/migration/DB tests, Docker build and production-user smoke checks |
| VM | App-only 4 GiB server, Malaysia West,32GiB SSD, Secure Boot/vTPM; no MPC share |
| HTTPS | Azure hostname and automatic certificate; loopback-only API behind Caddy |
| Database | PostgreSQL16, verified TLS, separate runtime/migration/backup roles; runtime DDL/ledger-write denial verified |
| Key Vault | Version-pinned app secrets retrieved with VM managed identity; temporary write role removed |
| Backups | Private encrypted Blob storage; hourly timer, pre-migration backup, versioning/soft-delete; actual off-VM restore passed |
| Deployment | OIDC client scoped to this VM; one repository activation variable; foundation mode initially |
| Main policy | PR plus GitHub Actions Repository tests;0 required approvals until identities supplied; owner bypass retained |
| Product | Wallet/contract/MPC/native/agent financial features remain unimplemented; readiness stays503 |

The app release must pass actual workflow and external health checks. Infrastructure configuration alone is not a successful release or financial qualification. Current repair PRs must pass CI before merge.
