# Live Azure setup checklist

Authorized continuation of the approved delivery design, 2026-10-17.

- [ ] Install supported Docker/Compose, pinned Node/pnpm, PostgreSQL16 and HTTPS proxy on the app VM.
- [ ] Configure loopback-only TLS database with separate migration/runtime/backup roles; generate service credentials only on the VM.
- [ ] Store version-pinned service configuration in app-only Azure Key Vault; grant the VM read access.
- [ ] Configure app VM-only GitHub OIDC identity and one demo environment.
- [ ] Publish the scanned bootstrap/automation changes through a PR, run real CI, merge the tested change and activate automatic foundation delivery.
- [ ] Prove HTTPS health, deliberate503 financial readiness, verified TLS migrations, backup/restore and compatible code rollback.

The initial operator-owned release mode is foundation. It cannot mint/sign/pay, deploy contracts or advertise a verified address manifest. Wallet mode requires actual contracts, shared schema, acceptance commands and a separate valueless deployment account. This preserves the existing financial gates while allowing ordinary backend/database changes to deploy now.

Do not provision MPC hosts or generate wallet seeds, MPC shares or financial deployer keys in this setup. Service passwords and TLS keys are infrastructure credentials, generated privately on the VM. GitHub uses OIDC, not a stored Azure password.
