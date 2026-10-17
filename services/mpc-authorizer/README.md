# mpc-authorizer — Person2

Implement the Go boundary from your handoff using the exact pinned MPCium source in `infra/mpcium.lock.json`. No signing executable or private keys are created by bootstrap. Go1.25.8 required; local older Go may download that toolchain when invoked. Keep authorizer private key only on host B; adapter initiator on A.
