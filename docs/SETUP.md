# Setup and first integration

## Current state

Workspace/dependency pins, shared authority layouts/structural schemas/hash helpers, health-only API/provider, migration runner/metadata table, local infrastructure configuration and Expo Android entry point exist. Financial API, native owner signing, MPC nodes/Go adapter, policy, business contracts, runbooks, MCP and verifier remain assigned implementation work. Not-ready commands fail explicitly. No wallet keys or chain deployment are created by setup.

## Install locally

1. Install Node version in `.nvmrc` (22.23.3), pnpm10.20.0 and Docker with Compose. Use your version manager, e.g. `nvm install` then `nvm use` if nvm is installed. Node25 is not the selected toolchain. Foundry required by Person1; Go1.25.8 by Person2; JDK17/Android SDK/physical Android12+ by Person3.
2. From repository root run `make setup`. Its scripts/pnpm.sh wrapper uses pinned Node/pnpm through npm exec if your installed versions differ, without changing global installations; first use needs network. With the pinned tools already active, the equivalent is `pnpm install --frozen-lockfile` then `pnpm setup:env`. The latter creates fresh local database/NATS passwords in ignored `.env`; it does not generate signing keys. Existing .env is preserved.
3. Start Docker Desktop/daemon, then `make infra-up`. This starts only local Postgres, NATS/JetStream and Consul. MPC node setup is a separate Person2 gate. Infrastructure ports bind localhost.
4. Run `make db-migrate`. Only metadata migration is currently supplied; Person2 owns business tables.
5. Separate terminals: `make dev-platform` (API3000), `make dev-provider` (provider3001). `/healthz` shows process status; `/readyz` returns503 and financial routes501 until implemented. These services cannot pay or produce browser results yet.
6. Person3: `make dev-mobile` starts Metro for native development build. After implementing native module/build settings, `pnpm --filter @mandate/mobile android` builds/installs on physical device. Expo Go is not used. Keep generated Android source/build configuration under team control; do not run destructive prebuild clean over hand-written native code.
7. `pnpm typecheck` checks TS workspace. `make check-*`/`release-check` deliberately fail for absent acceptance suites; no green security claim comes from typechecking.

## MPCium setup

Run `make mpc-fetch` to clone pinned source into ignored `vendor/mpcium`. Fetch script never starts nodes/generates keys. Person2 follows `docs/plans/02 - Platform Policy and MPCium.md`: separate identities/storage, common chain_code, threshold config1/two required, mandatory nonempty authorizer list on both nodes, exact Go message binding,20verified public vectors and either-node-alone failure. Add nodes only when those secret boundaries are implemented. Full release uses separate Linux hosts A/B; two local containers are development only.

## Shared resources supplied by team

Two reachable Linux hosts with private authenticated connectivity; Base Sepolia RPC and independent RPC; test ETH for deployment/normal/emergency/anchor senders; HTTPS API/provider origins; Wallet Core package-read build credential; model API access; physical secure-screen-lock phone. Store private credentials in ignored local/host secret files, never public manifests. Owner words only on phone.

## First connected gate

Person1 emits shared fixtures/ABI→Person2 and3 establish independent executor/owner signatures→deploy test assets/factory/anchor→phone owner login/wallet provisioning→approve Permit→MPC payment→actual Person4 provider output→export→independent verifier→signed CLOSE. Then assets/schedule/fallback/restart/stop/recovery. Keep same ABI/schema at every merge. Public manifest must contain real addresses/hashes; no fabricated deployment file is included.

## Infrastructure lifecycle

`make infra-down` preserves local named volumes. Recreate .env passwords only with deliberate database/NATS credential rotation; changing file alone does not rotate an existing DB. Consul dev-mode is ephemeral and not production-secure. Local infrastructure is not automatically started or stopped by dependency installation.


## Complete-app v6 setup additions — implementation still required

Read [Complete App Plan](COMPLETE-APP.md) and [migration](PLAN-MIGRATION-v6.md) before financial work. Bootstrap source remains domain4/Login1; Person1 publishes domain5/OwnerTransfer/Login2 fixtures, then all consumers migrate together. Add server-only Etherscan V2 API key/84532 quota check, trusted native direct RPC/OP-stack fee estimation, native protected refresh/session/profile/journal storage and personal ETH funding for independent gas. No private API/signing key belongs in APK. WalletConnect/dApp connections are deferred; do not require WalletKit or a Reown projectId for this release.

Qualify SDK compatibility on Expo54/Hermes and original MPC topology (upstream guide≥3nodes versus proposed2) before deployment claims. Personal send/history/app lock/restore/session/QR WQ cases are required in addition to original agent acceptance. Existing startup commands still launch only the documented bootstrap; they do not make the complete wallet functional.
