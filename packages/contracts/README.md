# Contracts — Person1

Solidity0.8.28/OpenZeppelin5.4.0/Foundry. Shared struct layouts are included in `src/MandateTypes.sol`. Implement MandateWallet, WalletFactory, DemoUSD, DemoVault, EvidenceAnchor and generated ABI/fixtures per your handoff. No financial contract implementation or deployment is included yet. No global guard-signature or Circle dependency is permitted by the current design.

After `pnpm install`, run `forge build --root packages/contracts` with Foundry installed. Publish generated ABI in shared schema once business contracts exist. Deploy only after explicit chain/funding/configuration review; never deploy empty/scaffold contracts as a completed wallet.
