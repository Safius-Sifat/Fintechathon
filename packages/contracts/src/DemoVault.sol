// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @notice Controlled TEST vault (OpenZeppelin ERC-4626) over DemoUSD. No yield, no
/// production claim. The operator can only toggle a "withdrawals disabled" fixture
/// switch, which makes maxRedeem/maxWithdraw return 0 so redeem/withdraw revert
/// consistently. The operator cannot move anyone's shares or assets.
contract DemoVault is ERC4626 {
  address public immutable operator;
  bool public withdrawalsEnabled = true;

  event WithdrawalsEnabled(bool enabled);

  error NotOperator();

  constructor(IERC20 asset_) ERC20("Mandate Demo Vault Share (test)", "dvDUSD") ERC4626(asset_) {
    operator = msg.sender;
  }

  function setWithdrawalsEnabled(bool enabled) external {
    if (msg.sender != operator) revert NotOperator();
    withdrawalsEnabled = enabled;
    emit WithdrawalsEnabled(enabled);
  }

  function maxRedeem(address owner) public view override returns (uint256) {
    return withdrawalsEnabled ? super.maxRedeem(owner) : 0;
  }

  function maxWithdraw(address owner) public view override returns (uint256) {
    return withdrawalsEnabled ? super.maxWithdraw(owner) : 0;
  }

  /// Virtual shares/assets offset against first-depositor inflation attacks (OZ guidance).
  function _decimalsOffset() internal pure override returns (uint8) {
    return 6;
  }
}
