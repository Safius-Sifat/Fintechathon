# Contract security notes (Person1)

Scope: `packages/contracts/src/{MandateWallet,WalletFactory,DemoUSD,DemoVault}.sol` as of the P1-03/P1-04 milestone. These are local test results only; there is no audit and no mainnet use.

## Authority model

| Who | Can | Cannot |
| --- | --- | --- |
| Owner (immutable) | Sign Permits, Admin commands, OwnerTransfers, co-sign Actions above the review threshold | Be replaced; nothing changes the owner |
| Executor (per Permit) | Sign Actions inside one active Permit | Exceed caps, floor, recipients, schedule, vault or time; sign owner commands |
| Provider | Sign the Invoice it is paid on | Change the amount, task, wallet or asset the executor signed |
| Any sender / relayer | Submit signed messages and pay gas | Redirect funds or add authority |
| DemoVault operator | Toggle the "withdrawals disabled" fixture switch | Move anyone's shares or assets |

## Limits enforced on chain

Per payment 500,000; per task 2,000,000; per executor per UTC day 5,000,000; per wallet per UTC day 10,000,000 and per week 25,000,000 (per agent asset); liquid floor ≥ 3,000,000; ≤ 20 actions per Permit, ≤ 3 browser payments; Permit lifetime ≤ 24 h; Action and Invoice ≤ 60 s (≤ 15 min when owner co-signed); Admin ≤ 30 min; OwnerTransfer ≤ 10 min. Deposits keep vault assets ≤ 20% of liquid + vault (checked after the deposit from real balances) and have their own `depositCap`; withdrawals have `withdrawCap`. Gross spend is never decreased by refunds or withdrawals.

## Stop and recovery

- `PAUSE`, `RECOVER`, `RECOVER_LIQUID` and every successful `OwnerTransfer` pause the wallet and increment `authorityEpoch`. `UNPAUSE` only clears the pause; old Permits stay invalid because their epoch is stale.
- `REVOKE` permanently marks a permit ID, including one that was signed but never activated.
- Actions mined before a stop stand; the stop cannot reverse chain order.
- Recovery always pays the immutable owner. `RECOVER` first calls the vault: `maxRedeem`/`balanceOf` with `RECOVER_VIEW_GAS = 50,000` each and `redeem` with `RECOVER_REDEEM_GAS = 300,000`. If the vault reverts, burns its gas, or has redemptions disabled, `vaultFailed = true` is emitted, the shares stay visible, and liquid DemoUSD is still sent. `RECOVER_LIQUID` never calls the vault.
- Relayer gas: give `applyAdmin(RECOVER)` at least 600,000 gas. With less, the bounded vault call can fail; the liquid part still completes and `vaultFailed` is reported, so the owner can retry. Native ETH and other tokens are recovered with separate OwnerTransfers; there is no atomic all-asset recovery.

## Other properties

- Signatures: OpenZeppelin `ECDSA.tryRecover` (rejects malformed and high-S); every failure maps to `InvalidSignature`.
- The wallet refuses to deploy unless `block.chainid == 84532`, so domain-84532 signatures cannot be replayed on another chain.
- Reentrancy: `execute`, `applyAdmin` and `applyOwnerTransfer` are `nonReentrant`; IDs and counters are written before token transfers.
- Token approvals to the vault are exact and reset to zero in the same transaction; actual balance deltas must match the requested amounts, so fee-on-transfer tokens are rejected.
- Not yet implemented (reverts explicitly): ALLOWANCE Permits, CALL, X402, FREEZE/UNFREEZE, WalletPolicy and non-DemoUSD agent assets.

Tests: `packages/contracts/test/*.t.sol` (run `make check-contracts`).
