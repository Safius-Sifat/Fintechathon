// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "./MandateLimits.sol";

/// @notice Owner-side asset movement (OwnerTransfer and RECOVER), split out of MandateWallet
/// for the EIP-170 size limit. Runs by DELEGATECALL in the wallet's context.
library AssetsLib {
  using SafeERC20 for IERC20;

  event Recovered(uint256 liquidAssets, uint256 redeemedShares, uint256 redeemedAssets, bool vaultFailed);

  error NativeTransferFailed();
  error InexactTokenTransfer();

  /// Native ETH by empty-data call, or an ERC20 whose wallet debit and recipient credit equal amount exactly.
  function moveExact(address asset, address recipient, uint256 amount) external {
    if (asset == address(0)) {
      (bool ok,) = recipient.call{value: amount}("");
      if (!ok) revert NativeTransferFailed();
    } else {
      IERC20 erc20 = IERC20(asset);
      uint256 walletBefore = erc20.balanceOf(address(this));
      uint256 recipientBefore = erc20.balanceOf(recipient);
      erc20.safeTransfer(recipient, amount);
      if (walletBefore - erc20.balanceOf(address(this)) != amount || erc20.balanceOf(recipient) - recipientBefore != amount) {
        revert InexactTokenTransfer();
      }
    }
  }

  /// Sends core DemoUSD to the immutable owner. RECOVER first tries to redeem vault shares
  /// to the owner with bounded gas; any vault failure is reported, never blocks liquid recovery.
  function recover(address token, address vault, address owner, bool withVault) external {
    uint256 redeemedShares;
    uint256 redeemedAssets;
    bool vaultFailed;
    IERC20 asset = IERC20(token);
    if (withVault && vault != address(0)) {
      (bool okMax, bytes memory maxData) =
        vault.staticcall{gas: RECOVER_VIEW_GAS}(abi.encodeCall(IERC4626.maxRedeem, (address(this))));
      (bool okBal, bytes memory balData) =
        vault.staticcall{gas: RECOVER_VIEW_GAS}(abi.encodeCall(IERC20.balanceOf, (address(this))));
      uint256 shares = okMax && maxData.length >= 32 ? abi.decode(maxData, (uint256)) : 0;
      uint256 held = okBal && balData.length >= 32 ? abi.decode(balData, (uint256)) : 0;
      if (shares > held) shares = held;
      if (shares > 0) {
        uint256 ownerBefore = asset.balanceOf(owner);
        (bool okRedeem,) =
          vault.call{gas: RECOVER_REDEEM_GAS}(abi.encodeCall(IERC4626.redeem, (shares, owner, address(this))));
        if (okRedeem) {
          redeemedShares = shares;
          redeemedAssets = asset.balanceOf(owner) - ownerBefore;
        } else {
          vaultFailed = true;
        }
      } else if (!okMax || !okBal || held > 0) {
        vaultFailed = true; // position exists (or is unreadable) but cannot be redeemed now
      }
    }
    uint256 liquid = asset.balanceOf(address(this));
    if (liquid > 0) asset.safeTransfer(owner, liquid);
    emit Recovered(liquid, redeemedShares, redeemedAssets, vaultFailed);
  }
}
