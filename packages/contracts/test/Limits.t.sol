// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {DemoUSD} from "../src/DemoUSD.sol";

contract LimitsTest is MandateFixture {
  function test_P1_03_depositFloorBoundary() public {
    // Liquid 4,000,000: depositing 1,000,001 leaves 2,999,999 (< floor); 1,000,000 leaves exactly 3,000,000.
    vm.prank(address(wallet));
    token.transfer(address(0xdead), 6_000_000);
    bytes32 permitId = _activateLiquidity("floor", 2_000_000, 0);
    (T.Action memory a, bytes memory sig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_001, 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("liquidFloor")));
    _run(a, sig);
    // 1,000,000 of 4,000,000 is 25% > 20%: the allocation rule also binds here.
    (a, sig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("allocation")));
    _run(a, sig);
    (a, sig) = _vaultAction(permitId, T.OP_DEPOSIT, 800_000, 1);
    _run(a, sig);
    assertEq(token.balanceOf(address(wallet)), 3_200_000);
  }

  function test_P1_03_utcDayRolloverResetsDailyCaps() public {
    bytes32[4] memory ids = [_activateNew("r1"), _activateNew("r2"), _activateNew("r3"), _activateNew("r4")];
    for (uint256 i = 0; i < 10; i++) _execute(_pay(ids[i / 3], 500_000, providerA, PROVIDER_A_PK));
    assertEq(wallet.getBudget(executor, address(token)).executorGross, 5_000_000);
    vm.warp(START + 1 days);
    assertEq(wallet.getBudget(executor, address(token)).executorGross, 0);
  }

  function test_P1_03_faucetPerRecipientPerDay() public {
    DemoUSD t = new DemoUSD();
    address alice = makeAddr("alice");
    vm.prank(makeAddr("caller-1"));
    t.faucet(alice);
    vm.prank(makeAddr("caller-2"));
    vm.expectRevert(DemoUSD.FaucetAlreadyClaimed.selector);
    t.faucet(alice);
    assertEq(t.balanceOf(alice), 10_000_000);
    vm.warp(START + 1 days);
    t.faucet(alice);
    assertEq(t.balanceOf(alice), 20_000_000);
    vm.prank(alice);
    vm.expectRevert(DemoUSD.NotMinter.selector);
    t.mint(alice, 1);
  }

  function test_P1_03_vaultOperatorCannotMoveFunds() public {
    bytes32 permitId = _activateLiquidity("op", 1_000_000, 0);
    (T.Action memory a, bytes memory sig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(a, sig);
    uint256 shares = vault.balanceOf(address(wallet));
    // The operator has no transfer privilege over the wallet's shares.
    vm.expectRevert();
    vault.transferFrom(address(wallet), address(this), shares);
    assertEq(vault.balanceOf(address(wallet)), shares);
  }
}
