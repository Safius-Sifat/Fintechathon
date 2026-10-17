# Mandate repository instructions

Read README.md, FINAL PLAN.md and your assigned file in docs/plans before editing. Current documentation5; EIP712 domain4; Base Sepolia84532; evidence schema4. Repository root is the monorepo root; do not create implementation/mandate inside it.

Ownership: Person1 contracts/schema/root workspace/deployments; Person2 API/worker/platform/policy/MPCium/infra; Person3 mobile/native-owner/recovery sender; Person4 runbooks/providers/SDK/MCP/verifier/demo/release assembly. Coordinate shared interface changes through Person1 and update all consumers.

Never introduce Circle, ordinary executor key fallback, separate ECDSA guard signer, arbitrary raw signing, fake settlement/results or hardcoded wallet keys. Missing financial capabilities must fail explicitly; /healthz is process health and /readyz remains503 until real gates pass. Root acceptance commands must not report success for absent implementations.

Preserve private .env, seeds, shares and backups; do not log or commit secrets. Do not deploy contracts, generate custody keys or publish without task authorization. Copy plans from approved v5 set; docs/archive is historical only. No tests were added by bootstrap; implement/run acceptance tests when explicitly authorized. Typecheck is available separately and is not security qualification.
