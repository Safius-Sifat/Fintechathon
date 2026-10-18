// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";

/// EIP-170: deployed runtime code must not exceed 24,576 bytes, or deployment fails on chain.
/// The local test EVM does not enforce this, so it is asserted explicitly.
contract SizeTest is MandateFixture {
  uint256 internal constant EIP170_LIMIT = 24_576;

  function test_contractSizesWithinEip170() public view {
    assertLe(address(wallet).code.length, EIP170_LIMIT, "MandateWallet");
    assertLe(address(factory).code.length, EIP170_LIMIT, "WalletFactory");
    assertLe(address(vault).code.length, EIP170_LIMIT, "DemoVault");
    assertLe(address(token).code.length, EIP170_LIMIT, "DemoUSD");
  }
}
