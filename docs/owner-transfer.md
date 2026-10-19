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

## History attribution (P1-W03)

- **Funding from the owner's personal account is not agent spend.** It moves two balances (personal down, managed up) and is one funding activity. The managed wallet's gross counters, nonces and epoch do not change.
- **An owner transfer is OWNER_CONTROL.** The `OwnerTransferExecuted` and `WalletPaused` events, and the advanced epoch, identify it. It never adds to a task's or the executor's gross spend, and it never resets that spend. After the transfer, the agent's old Permits fail.
- **Amounts are exact base units for any token.** The wallet never reads token metadata. Taxed, non-compliant and code-less tokens are rejected without side effects.

`test/OwnerActivity.t.sol` covers these rules and the contract side of WQ03/04/07/08/13. The inspector-side cases (T03 missing data, T04 unmatched outflow) belong to Person4.
