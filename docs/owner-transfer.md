# Owner transfer (managed wallet)

`applyOwnerTransfer(OwnerTransfer, ownerSignature)` lets the immutable owner move liquid funds out of the managed wallet without MPC, policy or backend consent (architecture S8.3). Any funded sender can relay it; the sender gains nothing.

## Rules the contract enforces

- Signature by the immutable owner over `OwnerTransfer` in domain `MandateWallet` / `"5"` / 84532 / wallet. Executor, provider and relayer signatures are rejected.
- `epoch == authorityEpoch()`, `nonce == ownerTransferNonce()` (its own lane, separate from `permitNonce` and `adminNonce`), unused `transferId`, `issuedAt ≤ now ≤ deadline`, lifetime ≤ 10 minutes.
- Positive amount; recipient is nonzero and not the wallet. `asset = 0x0` sends native ETH; otherwise the asset must be a contract and not the vault share token.
- ERC20 transfers must debit the wallet and credit the recipient by exactly `amount`; fee-on-transfer or rebasing behaviour reverts.
- Delegated caps and the liquid floor do not apply: this is owner control, not an agent payment.

## Effects

On success, in one transaction: `ownerTransferNonce += 1`, `transferId` marked used, `authorityEpoch += 1`, `paused = true`, then the asset moves. Events: `WalletPaused(true, newEpoch)` and `OwnerTransferExecuted(transferId, asset, recipient, amount, newEpoch, transferDigest)`.

Every earlier Permit stops working (the wallet is paused and its epoch is old). Agent Actions already mined earlier still stand. Owner transfers keep working while paused. Any failure (bad signature, insufficient balance, reverting recipient, inexact token) reverts everything, including nonce, epoch and pause.

## Relaying without the backend

Read `authorityEpoch()` and `ownerTransferNonce()` from any RPC, sign natively, and submit through the backend sponsor, the native personal-gas relay or any independent funded sender. Native ETH arrives through `receive()`; calls with unknown data revert. Tests: `packages/contracts/test/{OwnerTransfer,NativeReceive}.t.sol`.
