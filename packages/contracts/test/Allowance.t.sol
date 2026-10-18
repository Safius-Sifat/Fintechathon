// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract AllowanceTest is MandateFixture {
  function test_P1_A02_T05_periodCapsAcrossBoundary() public {
    T.Permit memory p = _allowancePermit("allowance", 1_000_000, 1 days);
    p.spendCap = 1_500_000;
    bytes32 permitId = _activate(p);

    _execute(_pay(permitId, 500_000, providerA, PROVIDER_A_PK));
    _execute(_pay(permitId, 500_000, providerA, PROVIDER_A_PK));
    Pay memory over = _pay(permitId, 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("periodCap")));
    _execute(over);
    assertEq(wallet.getPeriodSpend(permitId, 0), 1_000_000);

    // Next period: fresh period cap, but the total spendCap (1,500,000) still binds.
    vm.warp(START + 1 days);
    _execute(_pay(permitId, 500_000, providerA, PROVIDER_A_PK));
    assertEq(wallet.getPeriodSpend(permitId, 1), 500_000);
    Pay memory overTotal = _pay(permitId, 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("spendCap")));
    _execute(overTotal);
  }

  function test_P1_A02_allowanceActivationRules() public {
    T.Permit memory p = _allowancePermit("too-long", 1_000_000, 1 days);
    p.expiresAt = uint64(vm.getBlockTimestamp() + 30 days + 1);
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(MandateWallet.LifetimeTooLong.selector);
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);

    p = _allowancePermit("bad-period", 1_000_000, 3600);
    sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("periodSeconds")));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);

    Lists memory l = _lists();
    l.caps[0].daily = 800_000;
    l.caps[1].daily = 800_000;
    _applyPolicy(l, type(uint256).max);
    p = _allowancePermit("above-policy-daily", 1_000_000, 1 days);
    sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("periodCap")));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_A02_allowanceOnlyPayAndClose() public {
    bytes32 permitId = _activate(_allowancePermit("ops", 1_000_000, 1 weeks));
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    x.action.operation = T.OP_TRANSFER;
    x.executorSig = _signAction(x.action, EXECUTOR_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.OperationNotAllowed.selector, T.KIND_ALLOWANCE, T.OP_TRANSFER));
    _execute(x);
    (T.Action memory c, bytes memory csig) = _close(permitId);
    _run(c, csig);
    assertTrue(wallet.getPermit(permitId).closed);
  }
}
