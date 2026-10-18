# Contract deployment (P1-06)

`packages/contracts/script/Deploy.s.sol` deploys the fixed Base Sepolia set: DemoUSD, DemoVault, EvidenceAnchor and WalletFactory. Forge also deploys the seven wallet libraries through the deterministic CREATE2 deployer (`0x4e59b44847b379578588920cA78FbF26c0B4956C`). Then `packages/contracts/scripts/record-deployment.mjs` reads everything back over RPC and writes the deployment record.

## Approved configuration

`deployments/base-sepolia.config.json` holds the values the deployment must use: chain 84532, Base Sepolia USDC, and the EvidenceAnchor publisher. The publisher is the Person2 worker address (`0x5cCEfD0Ac77088d72d38047856f4045E5ae56a95`); a zero publisher makes the script refuse to deploy. Change this file only through a reviewed commit.

## Guarantees

- **Before signing**, the script aborts in these cases:
  - the RPC chain is not 84532 (`WrongChain`); there is no fallback chain
  - the config chain is not 84532
  - USDC is not the canonical address or has no code
  - the publisher is zero
- **After deployment**, the script reads back the vault asset, the anchor publisher and the factory's token, USDC and vault. Any difference aborts.
- **`record-deployment.mjs` checks independently of forge**, and writes nothing if any check fails:
  - it uses its own RPC client
  - every receipt succeeded
  - every runtime equals the compiled artifact, with libraries linked and immutables masked
  - the wallet creation code stored by the factory equals the linked `MandateWallet` creation code
  - the wiring equals the config
- The record contains:
  - addresses, deployment blocks, code hashes and transaction hashes
  - compiler settings
  - the source commit, and whether the tree was clean
  - It never contains the RPC URL.
- **Idempotence:** every run deploys a fresh set. Only the run recorded in `deployments/base-sepolia.json` is the release.
- **Keys:** the script never reads a private key. The signer comes from an encrypted Foundry keystore (`--account`).

## Deploy (owner-authorized only)

Run from `packages/contracts`, on a clean checkout of the release commit.

1. Import the funded deployer key into an encrypted keystore. You are prompted for the key and a password; the key is never written in plain text.

   ```bash
   cast wallet import mandate-deployer --interactive
   ```

2. Simulate against Base Sepolia. Nothing is sent.

   ```bash
   forge script script/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --account mandate-deployer
   ```

3. Broadcast.

   ```bash
   forge script script/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --account mandate-deployer --broadcast --slow
   ```

4. Verify and record.

   ```bash
   RPC_URL="$BASE_SEPOLIA_RPC_URL" node scripts/record-deployment.mjs broadcast/Deploy.s.sol/84532/run-latest.json ../../deployments/base-sepolia.config.json ../../evidence/person1/deployment.json
   ```

The full `deployments/base-sepolia.json` (DeploymentManifestSchema) also needs the provider bindings, origins, MPC and evidence keys, runbook hashes and agent pins from Persons 2–4. It is assembled from this record and their values; nothing in it is invented.

## Local dry run (no public broadcast)

The dry run below uses `0xf39F…2266` and `0x7099…79C8`. These are anvil's public test accounts: a sender that the fork has unlocked, and a stand-in publisher. Never use these accounts on a public chain.

1. Start a local fork of Base Sepolia.

   ```bash
   anvil --fork-url "$BASE_SEPOLIA_RPC_URL" --port 8546
   ```

2. Write a git-ignored dry-run config. Its publisher is anvil's public test account.

   ```bash
   echo '{"chainId":84532,"usdc":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","anchorPublisher":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}' > ../../deployments/dryrun.local.json
   ```

3. Deploy to the fork.

   ```bash
   DEPLOY_CONFIG=../../deployments/dryrun.local.json forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8546 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   ```

4. Read it back. The record goes to `/tmp`, so it is never committed.

   ```bash
   RPC_URL=http://127.0.0.1:8546 node scripts/record-deployment.mjs broadcast/Deploy.s.sol/84532/run-latest.json ../../deployments/dryrun.local.json /tmp/dryrun.record.json
   ```
