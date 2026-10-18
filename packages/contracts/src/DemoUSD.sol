// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Valueless six-decimal TEST asset for Base Sepolia demos. Not money.
/// Supply is unlimited in principle: the deployer can mint, and anyone can claim the
/// public faucet (10 DUSD per recipient per UTC day). Nothing can move holders' funds.
contract DemoUSD is ERC20 {
  uint256 public constant FAUCET_AMOUNT = 10_000_000;
  address public immutable minter;
  mapping(address => uint256) public lastFaucetDay;

  error NotMinter();
  error FaucetAlreadyClaimed();

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

  /// Tracked by recipient, so a different caller cannot claim twice for the same address.
  function faucet(address to) external {
    uint256 day = block.timestamp / 1 days + 1; // +1 so day 0 is distinguishable from "never"
    if (lastFaucetDay[to] == day) revert FaucetAlreadyClaimed();
    lastFaucetDay[to] = day;
    _mint(to, FAUCET_AMOUNT);
  }
}
