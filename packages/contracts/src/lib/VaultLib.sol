// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {MandateTypes as T} from "../MandateTypes.sol";
import {MandateWallet} from "../MandateWallet.sol";
import "./MandateLimits.sol";

/// @notice LIQUIDITY operations on the immutable DemoVault (S3, P1-03), split out of
/// MandateWallet for the EIP-170 size limit. Runs by DELEGATECALL in the wallet's context;
/// the wallet has already verified the Action and consumed its request ID.
library VaultLib {
  using SafeERC20 for IERC20;

  event ActionExecuted(
    bytes32 indexed permitId,
    bytes32 indexed requestId,
    uint8 operation,
    address asset,
    address target,
    uint256 assets,
    uint256 shares,
    bytes32 invoiceId,
    bytes32 inputHash,
    bytes32 actionDigest,
    bool ownerApproved
  );

  error LimitExceeded(bytes32 limit);
  error InexactTokenTransfer();

  /// DEPOSIT: Action.amount is assets, minOutput is minimum shares (S3).
  function deposit(MandateWallet.PermitState storage st, T.Action calldata a, bytes32 actionDigest, address vault) external {
    T.Permit storage p = st.permit;
    if (st.depositedAssets + a.amount > p.depositCap) revert LimitExceeded("depositCap");
    st.depositedAssets += a.amount;
    IERC20 asset = IERC20(p.asset);
    IERC4626 v = IERC4626(vault);
    uint256 liquidBefore = asset.balanceOf(address(this));
    if (liquidBefore < a.amount || liquidBefore - a.amount < p.liquidFloor) revert LimitExceeded("liquidFloor");
    uint256 sharesBefore = IERC20(vault).balanceOf(address(this));

    asset.forceApprove(vault, a.amount);
    v.deposit(a.amount, address(this));
    asset.forceApprove(vault, 0);

    uint256 liquidAfter = asset.balanceOf(address(this));
    uint256 sharesReceived = IERC20(vault).balanceOf(address(this)) - sharesBefore;
    if (liquidBefore - liquidAfter != a.amount) revert InexactTokenTransfer();
    if (sharesReceived < a.minOutput) revert LimitExceeded("minOutput");
    uint256 vaultAssets = v.convertToAssets(IERC20(vault).balanceOf(address(this)));
    if (vaultAssets * 10_000 > MAX_ALLOCATION_BPS * (liquidAfter + vaultAssets)) revert LimitExceeded("allocation");
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, vault, a.amount, sharesReceived, bytes32(0), a.inputHash, actionDigest, false);
  }

  /// WITHDRAW: Action.amount is shares, minOutput is minimum assets; assets return only to the wallet.
  function withdraw(MandateWallet.PermitState storage st, T.Action calldata a, bytes32 actionDigest, address vault) external {
    T.Permit storage p = st.permit;
    IERC20 asset = IERC20(p.asset);
    if (a.amount > IERC20(vault).balanceOf(address(this))) revert LimitExceeded("shares");
    uint256 liquidBefore = asset.balanceOf(address(this));

    uint256 reported = IERC4626(vault).redeem(a.amount, address(this), address(this));

    uint256 received = asset.balanceOf(address(this)) - liquidBefore;
    if (received != reported) revert InexactTokenTransfer();
    if (received < a.minOutput) revert LimitExceeded("minOutput");
    if (st.withdrawnAssets + received > p.withdrawCap) revert LimitExceeded("withdrawCap");
    st.withdrawnAssets += received; // incoming assets never replenish gross spend
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, vault, received, a.amount, bytes32(0), a.inputHash, actionDigest, false);
  }
}
