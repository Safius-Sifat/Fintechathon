# mpc-authorizer — Person2

Implement the Go boundary from your handoff using the exact pinned MPCium source in `infra/mpcium.lock.json`. No signing executable or private keys are created by bootstrap. Go1.25.8 required; local older Go may download that toolchain when invoked. For the competition PoC, keep the authorizer private key in the private policy service container and the initiator key in the adapter container. Both containers share the single Azure VM trust boundary; node shares use three separate encrypted persistent volumes. This layout demonstrates protocol quorum, not host-compromise resilience.

## Exact-request boundary

`internal.New` requires independent records and policy, the registered initiator
public key and a local authorizer signer. Only `Authorize(actionId, attemptId,
SignTxMessage)` exists; there are no reshare/keygen routes. The boundary reloads
trusted records, compares every field including a strictly nil derivation path,
verifies the initiator and calls independent policy before signing upstream
`ComposeAuthorizerRaw`. Canonical UUIDs prohibit wallet/attempt path input.

The financial immutable-record DB role and independent RPC policy are separate
unimplemented dependencies. The local fixture policy consumes fixed records for
qualification only. Existing policy/worker production entrypoints remain unavailable.
