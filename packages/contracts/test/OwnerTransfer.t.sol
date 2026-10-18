// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {DemoUSD} from "../src/DemoUSD.sol";
import {TaxToken, RevertingRecipient} from "./mocks/Mocks.sol";

contract OwnerTransferTest is MandateFixture {
  address internal recipient = makeAddr("owner-recipient");

  function _snapshot() internal view returns (uint256 nonce, uint64 epoch, bool isPaused, uint256 balance) {
    return (wallet.ownerTransferNonce(), wallet.authorityEpoch(), wallet.paused(), token.balanceOf(address(wallet)));
  }

  function test_P1_W02_T01_transferPausesAndInvalidatesPermits() public {
    bytes32 permitId = _activateNew("active");
    Pay memory pending = _pay(permitId, 100_000, providerA, PROVIDER_A_PK); // signed before the stop
    // Leave 3,200,000 so the 400,000 transfer deliberately goes below the delegated floor.
    vm.prank(address(wallet));
    token.transfer(address(0xdead), 6_800_000);

    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("ot-1", address(token), recipient, 400_000);
    vm.expectEmit(true, true, true, true, address(wallet));
    emit MandateWallet.OwnerTransferExecuted("ot-1", address(token), recipient, 400_000, 1, H.digest(wallet.domainSeparator(), H.hash(t)));
    vm.prank(relayer);
    wallet.applyOwnerTransfer(t, sig);

    assertEq(token.balanceOf(recipient), 400_000);
    assertEq(token.balanceOf(address(wallet)), 2_800_000);
    assertEq(wallet.ownerTransferNonce(), 1);
    assertEq(wallet.authorityEpoch(), 1);
    assertTrue(wallet.paused());
    assertTrue(wallet.usedOwnerTransfer("ot-1"));
    assertEq(wallet.permitNonce(), 1); // permit nonce lane untouched

    vm.expectRevert(MandateWallet.WalletIsPaused.selector);
    _execute(pending);
  }

  function test_P1_W02_T02_replayAndWrongSigner() public {
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("ot-1", address(token), recipient, 100_000);
    wallet.applyOwnerTransfer(t, sig);
    vm.expectRevert(MandateWallet.WrongEpoch.selector);
    wallet.applyOwnerTransfer(t, sig);

    (T.OwnerTransfer memory t2,) = _ownerTransfer("ot-1", address(token), recipient, 100_000);
    bytes memory sig2 = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(t2)));
    vm.expectRevert(MandateWallet.TransferAlreadyUsed.selector);
    wallet.applyOwnerTransfer(t2, sig2);

    (T.OwnerTransfer memory t3,) = _ownerTransfer("ot-3", address(token), recipient, 100_000);
    bytes memory executorSig = _sign(EXECUTOR_PK, H.digest(wallet.domainSeparator(), H.hash(t3)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    wallet.applyOwnerTransfer(t3, executorSig);
    assertEq(token.balanceOf(recipient), 100_000);
    assertEq(wallet.authorityEpoch(), 1);
  }

  function test_P1_W02_T03_failuresRollBackEverything() public {
    (uint256 n0, uint64 e0, bool p0, uint256 b0) = _snapshot();

    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("too-much", address(token), recipient, 10_000_001);
    vm.expectRevert();
    wallet.applyOwnerTransfer(t, sig);

    vm.deal(address(wallet), 1 ether);
    RevertingRecipient bad = new RevertingRecipient();
    (t, sig) = _ownerTransfer("eth-revert", address(0), address(bad), 0.5 ether);
    vm.expectRevert(MandateWallet.NativeTransferFailed.selector);
    wallet.applyOwnerTransfer(t, sig);

    (t, sig) = _ownerTransfer("expired", address(token), recipient, 1);
    vm.warp(vm.getBlockTimestamp() + 301);
    vm.expectRevert(MandateWallet.Expired.selector);
    wallet.applyOwnerTransfer(t, sig);

    (uint256 n1, uint64 e1, bool p1, uint256 b1) = _snapshot();
    assertEq(n1, n0);
    assertEq(e1, e0);
    assertEq(p1, p0);
    assertEq(b1, b0);
    assertFalse(wallet.usedOwnerTransfer("too-much"));
    assertEq(address(wallet).balance, 1 ether);
  }

  function test_P1_W02_T05_vaultSharesAndInexactTokensRejected() public {
    // A wallet configured with a vault share token cannot sweep shares directly.
    DemoUSD shares = new DemoUSD();
    MandateWallet vaultWallet = new MandateWallet(ownerAddr, address(token), address(shares));
    shares.mint(address(vaultWallet), 1_000);
    T.OwnerTransfer memory t = T.OwnerTransfer("shares", address(shares), recipient, 1_000, 0, 0, uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + 300));
    bytes memory sig = _sign(OWNER_PK, H.digest(vaultWallet.domainSeparator(), H.hash(t)));
    vm.expectRevert(MandateWallet.InvalidAsset.selector);
    vaultWallet.applyOwnerTransfer(t, sig);

    TaxToken tax = new TaxToken();
    tax.mint(address(wallet), 1_000_000);
    (T.OwnerTransfer memory tt, bytes memory tsig) = _ownerTransfer("tax", address(tax), recipient, 100_000);
    vm.expectRevert(MandateWallet.InexactTokenTransfer.selector);
    wallet.applyOwnerTransfer(tt, tsig);
    assertEq(tax.balanceOf(address(wallet)), 1_000_000);
    assertEq(wallet.authorityEpoch(), 0);

    (T.OwnerTransfer memory ts, bytes memory ssig) = _ownerTransfer("self", address(token), address(wallet), 1);
    vm.expectRevert(MandateWallet.InvalidRecipient.selector);
    wallet.applyOwnerTransfer(ts, ssig);
  }

  function test_P1_W02_T06_worksWhilePausedViaAnyRelayer() public {
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("first", address(token), recipient, 100_000);
    wallet.applyOwnerTransfer(t, sig);
    assertTrue(wallet.paused());
    // No API or MPC exists in this test: only the owner signature and any funded sender.
    (T.OwnerTransfer memory t2, bytes memory sig2) = _ownerTransfer("second", address(token), recipient, 50_000);
    vm.prank(makeAddr("independent-sender"));
    wallet.applyOwnerTransfer(t2, sig2);
    assertEq(token.balanceOf(recipient), 150_000);
    assertEq(wallet.authorityEpoch(), 2);
    assertEq(wallet.ownerTransferNonce(), 2);
  }

  function test_P1_W02_T07_orderingAgainstAgentActions() public {
    bytes32 permitId = _activateNew("ordering");
    Pay memory early = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    Pay memory late = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);

    _execute(early); // mined before the owner transfer: settles
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("stop", address(token), recipient, 1);
    wallet.applyOwnerTransfer(t, sig);
    vm.expectRevert(MandateWallet.WalletIsPaused.selector); // mined after: rejected
    _execute(late);
    assertEq(token.balanceOf(providerA), 100_000);
  }
}
