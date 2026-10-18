// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract FreezeTest is MandateFixture {
  function test_P1_A02_T04_freezeKeepsPermitsAndEpoch() public {
    bytes32 permitId = _activateNew("frozen-task");
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    vm.expectEmit(false, false, false, true, address(wallet));
    emit MandateWallet.WalletFrozen(true);
    _applyAdmin(T.CMD_FREEZE, bytes32(0));
    assertTrue(wallet.frozen());
    vm.expectRevert(MandateWallet.WalletIsFrozen.selector);
    _execute(x);

    _applyAdmin(T.CMD_UNFREEZE, bytes32(0));
    assertFalse(wallet.frozen());
    assertEq(wallet.authorityEpoch(), 0);
    assertFalse(wallet.paused());
    _execute(x); // the same signed Action still works: terms were kept
    assertEq(token.balanceOf(providerA), 100_000);
  }

  function test_P1_A02_T04_ownerControlsWorkWhileFrozen() public {
    _applyAdmin(T.CMD_FREEZE, bytes32(0));
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("frozen-sweep", address(token), ownerAddr, 1_000);
    wallet.applyOwnerTransfer(t, sig);
    _applyAdmin(T.CMD_RECOVER_LIQUID, bytes32(0));
    assertEq(token.balanceOf(ownerAddr), 10_000_000);
  }

  function test_P1_A02_freezeRequiresZeroPermitId() public {
    (T.Admin memory a, bytes memory sig) = _admin(T.CMD_FREEZE, keccak256("x"));
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.FieldNotZero.selector, bytes32("permitId")));
    wallet.applyAdmin(a, sig);
  }
}
