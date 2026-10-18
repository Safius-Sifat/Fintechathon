// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract ReplayTest is MandateFixture {
  bytes32 internal permitId;

  function setUp() public override {
    super.setUp();
    permitId = _activateNew("task-replay");
  }

  function test_P1_02_T02_replayThroughAnotherRelayer() public {
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    _execute(x);
    MandateWallet.PermitState memory before = wallet.getPermit(permitId);

    vm.txGasPrice(100 gwei);
    vm.prank(makeAddr("other-relayer"));
    vm.expectRevert(MandateWallet.RequestAlreadyUsed.selector);
    wallet.execute(x.action, x.executorSig, x.invoice, x.providerSig, x.approval, x.ownerApproval, "");

    assertEq(token.balanceOf(providerA), 200_000);
    MandateWallet.PermitState memory afterSt = wallet.getPermit(permitId);
    assertEq(afterSt.grossSpend, before.grossSpend);
    assertEq(afterSt.paymentCount, before.paymentCount);
    assertEq(wallet.getBudget(executor, address(token)).walletGross, 200_000);
  }

  function test_P1_02_T02_invoiceCannotBeReusedByNewRequest() public {
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    _execute(x);
    x.action.requestId = keccak256("fresh-request");
    x.executorSig = _signAction(x.action, EXECUTOR_PK);
    vm.expectRevert(MandateWallet.InvoiceAlreadyUsed.selector);
    _execute(x);
  }

  function _assertNothingConsumed(Pay memory x) internal view {
    assertFalse(wallet.usedRequest(x.action.requestId));
    assertFalse(wallet.usedInvoice(x.invoice.invoiceId));
    assertEq(token.balanceOf(providerA) + token.balanceOf(providerB), 0);
    assertEq(wallet.getPermit(permitId).actionCount, 0);
  }

  function test_P1_02_T03_mutatedActionFieldsBreakExecutorSignature() public {
    // Memory structs alias on assignment, so each mutation starts from a fresh signed payment.
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.action.target = providerB;
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
    _assertNothingConsumed(x);

    x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.action.amount = 200_001;
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
    _assertNothingConsumed(x);

    x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.action.inputHash = keccak256("changed");
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
    _assertNothingConsumed(x);
  }

  function test_P1_02_T03_invoiceBindingAndProviderSignature() public {
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.invoice.wallet = address(0xBEEF);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.InvoiceMismatch.selector, bytes32("wallet")));
    _execute(x);
    _assertNothingConsumed(x);

    x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.invoice.taskId = keccak256("other-task");
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.InvoiceMismatch.selector, bytes32("taskId")));
    _execute(x);
    _assertNothingConsumed(x);

    // Invoice signed by provider B for a payment to provider A.
    x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.providerSig = _sign(PROVIDER_B_PK, H.digest(H.invoiceDomain(address(wallet)), H.hash(x.invoice)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
    _assertNothingConsumed(x);
  }

  function test_P1_02_T03_expiredQuoteAndAction() public {
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    vm.warp(vm.getBlockTimestamp() + 61);
    vm.expectRevert(MandateWallet.NotYetValid.selector);
    _execute(x);
    _assertNothingConsumed(x);
  }

  function test_P1_02_T03_wrongWalletDomain() public {
    // A signature made for another wallet's domain does not authorize this wallet.
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    x.executorSig = _sign(EXECUTOR_PK, H.digest(H.walletDomain(address(0xBEEF)), H.hash(x.action)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
    x.executorSig = _sign(EXECUTOR_PK, H.digest(H.domainSeparator("MandateWallet", "4", address(wallet)), H.hash(x.action)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
  }
}
