# Mandate demo — check it yourself (Base Sepolia test network)

Everything below is test funds only. Every link opens on BaseScan (Base Sepolia).

## Demo wallet (test only)
Recovery phrase (shown in the video, test funds only — never use for real money):
skill wait mind whip interest chat just stove put dog guitar reform

| What | Address |
|------|---------|
| Personal wallet (owner) | [0xC6231dB66DECE674aE83633C07e9015C26C2D64B](https://sepolia.basescan.org/address/0xC6231dB66DECE674aE83633C07e9015C26C2D64B) |
| Agent wallet (contract the agent pays from) | [0x20a3597894fAC8DF7F608104A873c14c2d02C151](https://sepolia.basescan.org/address/0x20a3597894fAC8DF7F608104A873c14c2d02C151) |
| Agent wallet USDC transfers | [token transfers](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e?a=0x20a3597894fAC8DF7F608104A873c14c2d02C151) |
| Mandate Test Shop (payee) | [0x96EEaf3A973ff962f950089c30fc6b5ff380A068](https://sepolia.basescan.org/address/0x96EEaf3A973ff962f950089c30fc6b5ff380A068) |
| Test USDC token | [0x036CbD53842c5426634e7929541eC2318f3dCF7e](https://sepolia.basescan.org/token/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

## Payments made by the agent
| Order | Amount | Transaction |
|-------|--------|-------------|
| Tempo Glide, size 42 | 0.38 USDC | [0x7f081fa7…10643031](https://sepolia.basescan.org/tx/0x7f081fa7793f8437f741b840703d2cdab3218dafc9ba959f238cbe1e10643031) (block 48464471) |
| Cloudstep Lite, size 43 (recorded in the video) | 0.29 USDC | [0x16ca45fe…6bc018b8](https://sepolia.basescan.org/tx/0x16ca45fe68967c5ecdff283ef2823d38989196aa223be49609bcd0f46bc018b8) (block 48486080) |

Each transaction is a USDC transfer from the agent wallet to the shop for exactly the order price.

## Owner actions
| Action | Transaction |
|--------|-------------|
| Signed wallet limits (USDC 0.5 / 2 / 5, shop allowed) | [0x22b0db74…75192002](https://sepolia.basescan.org/tx/0x22b0db7434a8d0e1d5325323f9496da4a84cc423875a19498454718c75192002) (block 48463406) |
