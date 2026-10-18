# deployments

Public artifacts only; secrets, seeds and MPC share backups are excluded.

## Base Sepolia (84532)

Deployed from commit `069090a`. The readback verified the code and wiring; the full record, with code hashes, libraries and transactions, is `evidence/person1/deployment.json`.

| Contract | Address | Block |
| --- | --- | --- |
| DemoUSD (token) | `0xE030717a657E9194bC086A546fb59aDBc631ad7a` | 48293963 |
| DemoVault | `0xd82b54fbaD1B03D4D593479c154b2d6C413d9800` | 48293964 |
| EvidenceAnchor | `0x11384648A1FbB81da2E664E5Ae5EF547720BCC49` | 48293965 |
| WalletFactory | `0x094875D5656726980016E8712a8A02C96aD382ce` | 48293966 |

| Setting | Value |
| --- | --- |
| USDC (Circle test token) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Anchor publisher (Person2 worker) | `0x5cCEfD0Ac77088d72d38047856f4045E5ae56a95` |
| Deployer | `0x77e9B6A71A985e49372f07A26F696B4C519025b3` |

Consumers must compare the address and code hash, and fail closed on a mismatch.

## Files

- `base-sepolia.config.json`: the approved deployment configuration.
- `base-sepolia.json`: the release manifest. Not created yet: it needs provider, origin, MPC, runbook and agent values from Persons 2–4.

See `docs/contracts-deploy.md`.
