// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract ScheduleTest is MandateFixture {
  address internal payee = makeAddr("payee");
  uint64 internal constant INTERVAL = 600;
  uint64 internal constant WINDOW = 120;
  bytes32 internal permitId;
  T.Schedule internal s;

  function setUp() public override {
    super.setUp();
    s = _schedule(payee, 100_000, uint64(START + 60), uint32(INTERVAL), uint32(WINDOW), 3);
    permitId = _activateSchedule("schedule", s);
  }

  function _at(uint64 t) internal {
    vm.warp(t);
  }

  function test_P1_03_T05_periodsPayOnceNoCatchUp() public {
    // Before the first window opens.
    _at(uint64(START + 59));
    (T.Action memory a, bytes memory sig) = _transferAction(permitId, payee, 100_000, 0);
    vm.expectRevert(MandateWallet.ScheduleWindow.selector);
    _run(a, sig);

    // Period 0 at its exact opening second.
    _at(s.start);
    (a, sig) = _transferAction(permitId, payee, 100_000, 0);
    _run(a, sig);
    (a, sig) = _transferAction(permitId, payee, 100_000, 0);
    vm.expectRevert(MandateWallet.PeriodAlreadyUsed.selector);
    _run(a, sig);

    // Period 1 is missed entirely; at period 2 it cannot be caught up.
    _at(s.start + 2 * INTERVAL);
    (a, sig) = _transferAction(permitId, payee, 100_000, 1);
    vm.expectRevert(MandateWallet.ScheduleWindow.selector);
    _run(a, sig);
    (a, sig) = _transferAction(permitId, payee, 100_000, 2);
    _run(a, sig);

    // The window closes exactly at start + window (exclusive).
    assertEq(token.balanceOf(payee), 200_000);
    assertEq(wallet.getPermit(permitId).paymentCount, 2);
  }

  function test_P1_03_T05_windowCloseBoundary() public {
    _at(s.start + WINDOW);
    (T.Action memory a, bytes memory sig) = _transferAction(permitId, payee, 100_000, 0);
    vm.expectRevert(MandateWallet.ScheduleWindow.selector);
    _run(a, sig);
    _at(s.start + WINDOW - 1);
    (a, sig) = _transferAction(permitId, payee, 100_000, 0);
    _run(a, sig);
  }

  function test_P1_03_T05_recipientAndAmountAreSignedConstants() public {
    _at(s.start);
    (T.Action memory a, bytes memory sig) = _transferAction(permitId, providerA, 100_000, 0);
    vm.expectRevert(MandateWallet.ScheduleMismatch.selector);
    _run(a, sig);
    (a, sig) = _transferAction(permitId, payee, 100_001, 0);
    vm.expectRevert(MandateWallet.ScheduleMismatch.selector);
    _run(a, sig);
    (a, sig) = _transferAction(permitId, payee, 100_000, 3); // out of range
    vm.expectRevert(MandateWallet.ScheduleWindow.selector);
    _run(a, sig);
    assertEq(wallet.getPermit(permitId).actionCount, 0);
  }

  function test_P1_03_scheduleActivationRules() public {
    // maxPayments must equal periods; final window must fit inside the Permit.
    T.Schedule memory bad = _schedule(payee, 100_000, uint64(START + 60), 600, 120, 3);
    T.Permit memory p = _schedulePermit("bad-count", bad);
    p.maxPayments = 2;
    address[] memory r = new address[](1);
    r[0] = payee;
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.ScheduleInvalid.selector, bytes32("maxPayments")));
    wallet.activatePermit(p, r, bad, new bytes32[](0), sig);

    T.Schedule memory late = _schedule(payee, 100_000, uint64(START + 3500), 600, 120, 3);
    p = _schedulePermit("too-late", late);
    sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.ScheduleInvalid.selector, bytes32("fit")));
    wallet.activatePermit(p, r, late, new bytes32[](0), sig);

    T.Schedule memory wide = _schedule(payee, 100_000, uint64(START + 60), 600, 601, 1);
    p = _schedulePermit("wide-window", wide);
    sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.ScheduleInvalid.selector, bytes32("window")));
    wallet.activatePermit(p, r, wide, new bytes32[](0), sig);
  }

  function test_P1_03_acceptanceThreeTransfers() public {
    for (uint32 i = 0; i < 3; i++) {
      _at(s.start + i * INTERVAL + 1);
      (T.Action memory a, bytes memory sig) = _transferAction(permitId, payee, 100_000, i);
      _run(a, sig);
    }
    assertEq(token.balanceOf(payee), 300_000);
    assertEq(wallet.getPermit(permitId).grossSpend, 300_000);
  }
}
