// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";

/// Fee-on-transfer token: burns 1% of every transfer, so deltas are never exact.
contract TaxToken is ERC20 {
  constructor() ERC20("Tax", "TAX") {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && to != address(0)) {
      uint256 fee = value / 100;
      super._update(from, address(0), fee);
      value -= fee;
    }
    super._update(from, to, value);
  }
}

contract RevertingRecipient {
  receive() external payable {
    revert("no ETH");
  }
}

/// On receiving ETH, tries to run a second, separately signed owner transfer.
contract ReentrantRecipient {
  MandateWallet internal wallet;
  T.OwnerTransfer internal next;
  bytes internal nextSig;
  bool public reentryFailed;
  uint256 public received;

  function arm(MandateWallet wallet_, T.OwnerTransfer memory next_, bytes memory sig) external {
    wallet = wallet_;
    next = next_;
    nextSig = sig;
  }

  receive() external payable {
    received += msg.value;
    try wallet.applyOwnerTransfer(next, nextSig) {}
    catch {
      reentryFailed = true;
    }
  }
}

/// Vault double whose redemption path misbehaves, for recovery tests.
contract UnavailableVault is ERC20 {
  enum Mode { Revert, BurnGas }
  Mode public mode;
  address public immutable asset;
  uint256 public redeemCalls;

  constructor(address asset_, Mode mode_) ERC20("Bad Vault", "BAD") {
    asset = asset_;
    mode = mode_;
  }

  function mintShares(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function convertToAssets(uint256 shares) external pure returns (uint256) {
    return shares;
  }

  function maxRedeem(address owner) external view returns (uint256) {
    return balanceOf(owner);
  }

  function redeem(uint256, address, address) external returns (uint256) {
    redeemCalls++;
    if (mode == Mode.Revert) revert("redeem unavailable");
    while (true) {}
    return 0;
  }
}
