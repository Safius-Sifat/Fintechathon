# Delivery readiness — 2026-10-17

Current design: [Automatic testnet delivery](AZURE-DELIVERY-DESIGN.md). Earlier three-controller design has been replaced by one workflow and one release script.

| Area | Current state | Remaining requirement |
| --- | --- | --- |
| Repository | Local bootstrap and operations work remain uncommitted; existing PRD/architecture/pitch edits preserved | Review/publish the repository work before GitHub can run it |
| CI | Pinned actions, unit/DB tests, typecheck, image build/smoke configured | First actual GitHub run; local Docker build is unverified |
| Tests | 39 operations/migration/real-DB cases passed; typecheck and workflow lint passed | Cloud deployment, real backup restore, rollback and secret rotation rehearsal |
| Deployment | App VM mandate-app-demo provisioned in Malaysia West with 2 vCPU/4 GiB/32 GiB SSD; managed identity has no added access | Runtime/private DB/Key Vault/HTTPS/OIDC setup and release rehearsal; activation remains unset |
| Contracts | Only shared Solidity structs currently exist | Real contracts, tests, deployment script/config, shared manifest schema and Foundry pin |
| Addresses | Receipt/code/finality verifier prepared; versioned registry and backend manifest endpoint wired | Real deployment data and app/SDK/verifier consumer implementation |
| Database | Transactional/checksummed/bounded migration runner tested with PostgreSQL16.10 | Persistent deployment DB with verified TLS, separate roles and backup destination |
| Runtime | API process health works; financial readiness deliberately503 | Required product implementation and owner acceptance tests |
| Worker/provider/MPC | Not included in this API compose release | Owners add real services; MPC release remains separate and protected |
| Keys | Key Vault/file helper unit-tested; no wallet/deployer/MPC keys generated or retrieved | Provision app-only managed identity, versioned secrets and dedicated testnet deployer keystore |
| Team | Only Safius-Sifat known; CODEOWNERS is interim | Add actual usernames when available; no independent review guarantee yet |
| Budget | Azure credit/region/quota/cost unconfirmed; earlier retail snapshot retained | Approve actual short-lived resource footprint before provisioning |

The repository automation batch created no cloud resources. A subsequent user-approved provisioning step created the single app VM, its disk/network/IP and managed identity; see infra/azure/deployed-app.json. No chain transaction, GitHub setting, commit or push was created. It is a prepared pipeline, not a claim of a production-qualified wallet.
