// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract EpochTest is MandateFixture {
  function test_P1_04_T01_pauseUnpauseNeverRevivesOldAuthority() public {
    bytes32 active = _activateNew("active");
    Pay memory oldPay = _pay(active, 100_000, providerA, PROVIDER_A_PK);
    (T.Action memory oldClose, bytes memory oldCloseSig) = _close(active);
    T.Permit memory staleDraft = _permit("stale"); // signed for epoch 0, nonce 1
    bytes memory staleSig = _signPermit(staleDraft, OWNER_PK);

    _applyAdmin(T.CMD_PAUSE, bytes32(0));
    assertTrue(wallet.paused());
    assertEq(wallet.authorityEpoch(), 1);
    _applyAdmin(T.CMD_UNPAUSE, bytes32(0));
    assertFalse(wallet.paused());
    assertEq(wallet.authorityEpoch(), 1); // UNPAUSE never moves the epoch back
    assertEq(wallet.adminNonce(), 2);

    vm.expectRevert(MandateWallet.WrongEpoch.selector);
    _execute(oldPay);
    vm.expectRevert(MandateWallet.WrongEpoch.selector);
    _run(oldClose, oldCloseSig);
    vm.expectRevert(MandateWallet.WrongEpoch.selector);
    wallet.activatePermit(staleDraft, _recipients(), _zeroSchedule(), new bytes32[](0), staleSig);

    // A fresh Permit for the new epoch works.
    bytes32 fresh = _activateNew("fresh");
    _execute(_pay(fresh, 100_000, providerA, PROVIDER_A_PK));
  }

  function test_P1_04_earlierPaymentStandsAfterPause() public {
    bytes32 active = _activateNew("ordering");
    _execute(_pay(active, 100_000, providerA, PROVIDER_A_PK));
    _applyAdmin(T.CMD_PAUSE, bytes32(0));
    assertEq(token.balanceOf(providerA), 100_000);
  }
}
