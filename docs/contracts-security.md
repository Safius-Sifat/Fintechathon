# Contract security notes (Person1)

Scope: `packages/contracts/src/{MandateWallet,WalletFactory,DemoUSD,DemoVault}.sol` as of the P1-A03 milestone. These are local test results only; there is no audit and no mainnet use.

## Authority model

| Who | Can | Cannot |
| --- | --- | --- |
| Owner (immutable) | Sign Permits, Admin commands, OwnerTransfers, co-sign Actions above the review threshold | Be replaced; nothing changes the owner |
| Executor (per Permit) | Sign Actions inside one active Permit | Exceed caps, floor, recipients, schedule, vault or time; sign owner commands |
| Provider | Sign the Invoice it is paid on | Change the amount, task, wallet or asset the executor signed |
| Any sender / relayer | Submit signed messages and pay gas | Redirect funds or add authority |
| DemoVault operator | Toggle the "withdrawals disabled" fixture switch | Move anyone's shares or assets |

## Limits enforced on chain

Owner WalletPolicy (S9.4) can only tighten these: per-asset per-transaction/day/week caps, allowlist (empty means off), blocklist, call templates and a wallet-wide review threshold; the most restrictive of Permit and policy applies at activation and again at every execution. Ceilings: per payment 500,000; per task 2,000,000; per executor per UTC day 5,000,000; per wallet per UTC day 10,000,000 and per week 25,000,000 (per agent asset); liquid floor ≥ 3,000,000; ≤ 20 actions per Permit, ≤ 3 browser payments; Permit lifetime ≤ 24 h; Action and Invoice ≤ 60 s (≤ 15 min when owner co-signed); Admin ≤ 30 min; OwnerTransfer ≤ 10 min. Deposits keep vault assets ≤ 20% of liquid + vault (checked after the deposit from real balances) and have their own `depositCap`; withdrawals have `withdrawCap`. Gross spend is never decreased by refunds or withdrawals.

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
- `FREEZE` stops agent execution without touching Permits, counters or epoch; `UNFREEZE` resumes. Owner transfers, admin commands and policy updates still work while frozen.
- ALLOWANCE Permits last up to 30 days with a per-day or per-week period cap; DemoUSD and USDC have separate counters, and USDC is unusable until the owner adds a USDC AssetCap.
- CALL (S9.8): only through a call template that is in both the Permit and the current WalletPolicy, matched by (target, selector), with `extcodehash(target)` pinned. Calldata is a selector plus at most eight 32-byte words; the amount argument is bounded by the template and the Action; the recipient rule is enforced; with PULLS_ASSET the wallet approves the exact amount and resets it to zero. Every agent-asset balance is measured: only the Permit asset may decrease, by at most the Action amount, and that outflow is charged to the Permit (`spendCap` is the CALL budget of a LIQUIDITY Permit with templates), period and policy caps, then the floor is checked.
- X402 (S9.10): the wallet builds the EIP-3009 TransferWithAuthorization from the signed Action itself, charges all counters at registration and records at most 8 outstanding authorizations, which count against the liquid floor until they expire or settle. `isValidSignature` returns the ERC-1271 magic value only for a recorded, unexpired digest with signature `requestId || permitId || 0x01`, while not frozen or paused, in the same epoch, with the Permit active and the current policy still allowing the recipient, the USDC cap and the review threshold (or an owner co-signature recorded at registration). Daily, weekly and period counters are not re-checked, because they were charged at registration. Verified against real Base Sepolia USDC on a fork (`test/fork/X402Fork.t.sol`); the facilitator path (gate X402-G) is not yet verified, so the manifest stays `MANDATE_NATIVE`.
- RECOVER's vault calls are gas-bounded; returned data is bounded by the forwarded gas, and a hostile vault returning maximal data still leaves recovery near 205k gas (`test/Recovery.t.sol`).

## Code size and structure

EIP-170 limits deployed runtime code to 24,576 bytes; the local test EVM does not enforce it, so `test/Size.t.sol` asserts it. `MandateWallet` keeps its own state and entry points; large self-contained logic runs in external libraries by DELEGATECALL in the wallet's context: `PermitTermsLib` (pure Permit checks), `WalletPolicyLib` (policy storage at the fixed slot `keccak256("mandate.wallet.policy.v1")` and `applyWalletPolicy`), `ActivationLib` (Permit activation against the wallet's Registry), `VaultLib` (DEPOSIT/WITHDRAW), `CallTemplateLib` (CALL), `X402Lib` (x402 records at `keccak256("mandate.wallet.x402.v1")` and ERC-1271 validation) and `AssetsLib` (OwnerTransfer and RECOVER asset movement). Libraries hold no state of their own and have no privileged entry points; deployment must link them. `WalletFactory` stores the wallet creation code in two code-only data contracts (runtime `0x00 || data`, never executable) and reassembles it for `CREATE2`, keeping its runtime at about 1.4 KB.

Sizes at this commit: MandateWallet 24,309 bytes runtime (267 bytes under the limit; extract `applyAdmin` next if more room is needed); WalletFactory 1,355 bytes runtime (27,387 bytes initcode, under the 49,152-byte EIP-3860 cap).

Tests: `packages/contracts/test/*.t.sol` (run `make check-contracts`).
