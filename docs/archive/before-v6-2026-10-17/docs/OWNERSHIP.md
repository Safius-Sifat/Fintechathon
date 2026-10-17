# Four-person working agreement

| Person | Owned paths | First joint handoff |
| --- | --- | --- |
| 1 | packages/contracts, packages/schema, deployments, root workspace/CI | schema/signature fixtures and generated ABI |
| 2 | apps/api, apps/worker, packages/platform, services, infra | real two-party authorized signature, durable API flow |
| 3 | apps/mobile, modules/owner-wallet, tools/relay-admin.ts | native owner signature/restore and actual-field approval |
| 4 | packages/runbooks, apps/provider, packages/sdk, apps/mcp, packages/verifier, demo/evaluation/submission | real paid browser output and independent receipt findings |

All contribute their own acceptance/security/deploy evidence. Person4 assembles submission, not everyone's implementation. Shared schema changes coordinate through Person1; Person2 integrates worker with Person4's library. Do not wait until the last day to connect components. Main repository branch is not automatically protected by these files; configure GitHub review rules with your actual four member accounts.

No fifth owner is needed. Bootstrap health routes/scaffolds are explicitly incomplete financial implementations. Each owner follows their assigned complete plan in docs/plans.
