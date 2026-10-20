# mpc-adapter — Person2

Implement the Go boundary from your handoff using the exact pinned MPCium source in `infra/mpcium.lock.json`. No signing executable or private keys are created by bootstrap. Go1.25.8 required; local older Go may download that toolchain when invoked. For the competition PoC, keep the authorizer private key in the private policy service container and the initiator key in the adapter container. Both containers share the single Azure VM trust boundary; node shares use three separate encrypted persistent volumes. This layout demonstrates protocol quorum, not host-compromise resilience.

## Local MPC boundary (2026-10-20)

`internal.New` requires a durable committed Action store, a policy authorizer and
an upstream MPC client; `SignAction(ctx, actionId)` accepts no digest from its caller.
The store must independently rebuild the shared typed Action digest, atomically
assign attempt IDs and enforce executor exclusion across processes. The adapter
persists its request fingerprint before publish; timeout stays `SIGNING_UNKNOWN`.
A result is accepted only for its wallet, attempt and network and only if the
canonical signature recovers the registered executor on the stored raw32 digest.

The actual financial store/worker and independent RPC policy are still missing.
There is no production executable or signing HTTP route. Constructor guards refuse
missing dependencies. The fixed-vector CLI is explicitly local qualification;
its in-memory trusted record source is never a production policy service.

Run `infra/scripts/build-mpc.sh`, then the setup and qualification commands in
`docs/platform-operations.md`. Private identities, passwords, shares and raw
upstream logs belong outside the checkout. Only sanitized public vectors are
retained under `evidence/person2/artifacts/mpc-local-20261020`.
