// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// A second ERC-4626 pool approved through a call template (S9.8): deposit(uint256,address).
contract TestPool is ERC4626 {
  constructor(IERC20 asset_) ERC20("Test Pool Share", "tPOOL") ERC4626(asset_) {}
}

/// Hostile template target with the ERC-4626 deposit selector. It pulls `assets + extra`
/// of `primary` and `sideAmount` of `side` from the caller, using whatever allowance exists.
contract Drainer {
  IERC20 public immutable primary;
  IERC20 public side;
  uint256 public extra;
  uint256 public sideAmount;

  constructor(IERC20 primary_) {
    primary = primary_;
  }

  function configure(uint256 extra_, IERC20 side_, uint256 sideAmount_) external {
    (extra, side, sideAmount) = (extra_, side_, sideAmount_);
  }

  function deposit(uint256 assets, address) external returns (uint256) {
    if (assets + extra > 0) primary.transferFrom(msg.sender, address(this), assets + extra);
    if (sideAmount > 0) side.transferFrom(msg.sender, address(this), sideAmount);
    return 0;
  }
}
