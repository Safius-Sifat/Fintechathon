// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract PaymentTest is MandateFixture {
  function test_P1_02_T01_payExactAmountAndEvent() public {
    bytes32 permitId = _activateNew("task-1");
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);

    vm.expectEmit(true, true, false, true, address(wallet));
    emit MandateWallet.ActionExecuted(
      permitId, x.action.requestId, T.OP_PAY, address(token), providerA, 200_000, 0,
      x.invoice.invoiceId, x.invoice.inputHash, _actionDigest(x.action), false
    );
    _execute(x);

    assertEq(token.balanceOf(providerA), 200_000);
    assertEq(token.balanceOf(address(wallet)), 9_800_000);
    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    assertEq(st.grossSpend, 200_000);
    assertEq(st.paymentCount, 1);
    assertEq(st.actionCount, 1);
    MandateWallet.Budget memory b = wallet.getBudget(executor, address(token));
    assertEq(b.walletGross, 200_000);
    assertEq(b.executorGross, 200_000);
    assertTrue(wallet.usedRequest(x.action.requestId));
    assertTrue(wallet.usedInvoice(x.invoice.invoiceId));
  }

  function test_P1_02_T05_paymentCapBoundary() public {
    bytes32 permitId = _activateNew("task-cap");
    Pay memory over = _pay(permitId, 500_001, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("maxPayment")));
    _execute(over);
    _execute(_pay(permitId, 500_000, providerA, PROVIDER_A_PK));
    assertEq(token.balanceOf(providerA), 500_000);
  }

  function test_P1_02_T05_taskSpendCap() public {
    T.Permit memory p = _permit("task-spend");
    p.spendCap = 600_000;
    bytes32 permitId = _activate(p);
    _execute(_pay(permitId, 400_000, providerA, PROVIDER_A_PK));
    Pay memory over = _pay(permitId, 200_001, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("spendCap")));
    _execute(over);
    _execute(_pay(permitId, 200_000, providerA, PROVIDER_A_PK));
    assertEq(wallet.getPermit(permitId).grossSpend, 600_000);
  }

  function test_P1_02_T05_liquidFloorBoundary() public {
    // Leave the wallet with 3,199,999: paying 200,000 would leave 2,999,999 < floor.
    vm.prank(address(wallet));
    token.transfer(address(0xdead), 10_000_000 - 3_199_999);
    bytes32 permitId = _activateNew("task-floor");
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("liquidFloor")));
    _execute(x);
    _execute(_pay(permitId, 199_999, providerA, PROVIDER_A_PK));
    assertEq(token.balanceOf(address(wallet)), 3_000_000);
  }

  function test_P1_02_T05_executorDayCap() public {
    // Ten payments of 500,000 reach the 5,000,000 executor/day ceiling; the eleventh fails.
    bytes32[4] memory ids = [_activateNew("d1"), _activateNew("d2"), _activateNew("d3"), _activateNew("d4")];
    for (uint256 i = 0; i < 10; i++) _execute(_pay(ids[i / 3], 500_000, providerA, PROVIDER_A_PK));
    Pay memory over = _pay(ids[3], 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("executorDay")));
    _execute(over);
    // The next UTC day has a fresh allowance.
    vm.warp(START + 1 days);
    bytes32 next = _activateNew("d5");
    _execute(_pay(next, 500_000, providerA, PROVIDER_A_PK));
  }

  function test_P1_02_T05_maxPaymentsCount() public {
    bytes32 permitId = _activateNew("task-count");
    for (uint256 i = 0; i < 3; i++) _execute(_pay(permitId, 1, providerA, PROVIDER_A_PK));
    Pay memory over = _pay(permitId, 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("maxPayments")));
    _execute(over);
  }

  function test_P1_02_T07_closeSucceedsWhenQuotaExhausted() public {
    bytes32 permitId = _activateNew("task-close");
    for (uint256 i = 0; i < 3; i++) _execute(_pay(permitId, 1, providerA, PROVIDER_A_PK));
    (T.Action memory a, bytes memory sig) = _close(permitId);
    T.Invoice memory noInvoice;
    T.Approval memory noApproval;
    vm.prank(relayer);
    wallet.execute(a, sig, noInvoice, "", noApproval, "", "");
    assertTrue(wallet.getPermit(permitId).closed);
    Pay memory after_ = _pay(permitId, 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(MandateWallet.PermitNotActive.selector);
    _execute(after_);
  }

  function test_P1_02_T07_closeRejectsValue() public {
    bytes32 permitId = _activateNew("task-close-value");
    (T.Action memory a,) = _close(permitId);
    a.amount = 1;
    bytes memory sig = _signAction(a, EXECUTOR_PK);
    T.Invoice memory noInvoice;
    T.Approval memory noApproval;
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.FieldNotZero.selector, bytes32("close")));
    wallet.execute(a, sig, noInvoice, "", noApproval, "", "");
  }

  function test_P1_A02_cosignAboveReviewThreshold() public {
    T.Permit memory p = _permit("task-review");
    p.reviewThreshold = 300_000;
    bytes32 permitId = _activate(p);

    // At or below the threshold no approval is needed (and none may be attached).
    _execute(_pay(permitId, 300_000, providerA, PROVIDER_A_PK));

    Pay memory big = _pay(permitId, 400_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(MandateWallet.ApprovalRequired.selector);
    _execute(big);

    _approve(big, EXECUTOR_PK); // executor cannot approve for the owner
    vm.expectRevert(MandateWallet.ApprovalInvalid.selector);
    _execute(big);

    _approve(big, OWNER_PK);
    vm.expectEmit(true, true, false, true, address(wallet));
    emit MandateWallet.ActionExecuted(
      permitId, big.action.requestId, T.OP_PAY, address(token), providerA, 400_000, 0,
      big.invoice.invoiceId, big.invoice.inputHash, _actionDigest(big.action), true
    );
    _execute(big);
    assertEq(token.balanceOf(providerA), 700_000);
  }

  function test_P1_A02_approvalBoundToExactAction() public {
    T.Permit memory p = _permit("task-review-2");
    p.reviewThreshold = 0;
    bytes32 permitId = _activate(p);
    Pay memory first = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    Pay memory second = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    _approve(first, OWNER_PK);
    second.approval = first.approval;
    second.ownerApproval = first.ownerApproval;
    vm.expectRevert(MandateWallet.ApprovalInvalid.selector);
    _execute(second);
  }
}
