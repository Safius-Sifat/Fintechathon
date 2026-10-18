// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless six-decimal test asset for Base Sepolia demos. Not money.
/// Only the deployer can mint; there is no other privileged function.
contract DemoUSD is ERC20 {
  address public immutable minter;

  error NotMinter();

  constructor() ERC20("Mandate Demo USD (valueless test asset)", "DUSD") {
    minter = msg.sender;
  }

  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function mint(address to, uint256 amount) external {
    if (msg.sender != minter) revert NotMinter();
    _mint(to, amount);
  }
}
