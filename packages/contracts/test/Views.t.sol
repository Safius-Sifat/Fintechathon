// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract ViewsTest is MandateFixture {
  function test_P1_05_T01_refundNeverReplenishesGross() public {
    bytes32 permitId = _activateNew("refund");
    _execute(_pay(permitId, 200_000, providerA, PROVIDER_A_PK));
    vm.prank(providerA);
    token.transfer(address(wallet), 200_000); // provider refunds
    assertEq(token.balanceOf(address(wallet)), 10_000_000);
    assertEq(wallet.getPermit(permitId).grossSpend, 200_000);
    MandateWallet.Budget memory b = wallet.getBudget(executor, address(token));
    assertEq(b.walletGross, 200_000);
    assertEq(b.executorGross, 200_000);
    assertEq(b.walletWeekGross, 200_000);
  }

  function test_P1_05_T02_viewsAfterSuccessFailureAndOwnerTransfer() public {
    bytes32 permitId = _activateNew("views");
    Pay memory ok = _pay(permitId, 300_000, providerA, PROVIDER_A_PK);
    _execute(ok);
    Pay memory bad = _pay(permitId, 500_001, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("maxPayment")));
    _execute(bad); // failed action leaves no trace

    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    assertTrue(st.activated);
    assertFalse(st.closed || st.revoked);
    assertEq(st.grossSpend, 300_000);
    assertEq(st.paymentCount, 1);
    assertEq(st.actionCount, 1);
    assertTrue(wallet.usedRequest(ok.action.requestId));
    assertFalse(wallet.usedRequest(bad.action.requestId));
    assertEq(wallet.permitNonce(), 1);

    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("owner-out", address(token), ownerAddr, 1_000_000);
    wallet.applyOwnerTransfer(t, sig);
    MandateWallet.Budget memory b = wallet.getBudget(executor, address(token));
    assertEq(b.walletGross, 300_000); // owner outflow is not agent spend
    assertEq(b.liquidAssets, 10_000_000 - 300_000 - 1_000_000);
    assertEq(wallet.getPermit(permitId).grossSpend, 300_000);
    assertTrue(wallet.paused());
    assertEq(wallet.authorityEpoch(), 1);
    assertEq(wallet.ownerTransferNonce(), 1);
  }
}
