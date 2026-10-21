# Mandate repository instructions

Read README.md, FINAL PLAN.md and your assigned file in docs/plans before editing. Current documentation 7; wallet EIP712 domain 5, Login 2, Invoice 2; Base Sepolia 84532; evidence schema 4 with v7 additive events. v7 adds the agentic layer and policy controls in architecture S9 (OpenAI Agents SDK agent, WalletPolicy, co-signature, freeze, allowance, call templates, USDC, x402, risk sentinel). Repository root is the monorepo root; do not create implementation/mandate inside it.

Ownership: Person1 contracts/schema/root workspace/deployments; Person2 API/sessions/history/owner relay/worker/platform/policy/MPCium/infra; Person3 complete personal/managed mobile wallet/native signing/sessions/security/recovery; Person4 runbooks/providers/payment-request fixtures/SDK/MCP/verifier/demo/release assembly. Coordinate shared interface changes through Person1 and update all consumers.

Never introduce Circle custody, wallet or signing services (Circle-issued test USDC used as an ordinary token is allowed), ordinary executor key fallback, separate ECDSA guard signer, arbitrary raw signing, fake settlement/results or hardcoded wallet keys. Missing financial capabilities must fail explicitly; /healthz is process health and /readyz remains503 until real gates pass. Root acceptance commands must not report success for absent implementations.

Preserve private .env, seeds, shares and backups; do not log or commit secrets. Do not deploy contracts, generate custody keys or publish without task authorization. Use current v7 plans/Complete App Plan and PLAN-MIGRATION-v6; The shared schema (`packages/schema`) is migrated to wallet 5/Login 2/Invoice 2 with golden vectors; wallet contracts, API, mobile, Go and verifier consumers are not yet implemented and must each confirm the fixture digests before financial signing. Bounded personal transactions and specific owner-operation relays are required; no generic raw digest/backend owner signing. The mobile wallet follows the JavaScript fast path in plan 03 v7.2 (Base Sepolia only; secrets only in the wallet module and expo-secure-store). Local logout/API sessions are distinct from on-chain agent stop. All advertised required app features need actual acceptance. docs/archive is historical only. No tests were added by bootstrap; implement/run acceptance tests when explicitly authorized. Typecheck is available separately and is not security qualification.

Remove AI code slop
Check the diff against main and remove AI-generated slop introduced in the branch.

Focus Areas
Extra comments that are unnecessary or inconsistent with local style
Defensive checks or try/catch blocks that are abnormal for trusted code paths
Casts to any used only to bypass type issues
Deeply nested code that should be simplified with early returns
Other patterns inconsistent with the file and surrounding codebase
Guardrails
Keep behavior unchanged unless fixing a clear bug.
Prefer minimal, focused edits over broad rewrites.
Keep the final summary concise (1-3 sentences).
