// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {UnavailableVault} from "./mocks/Mocks.sol";

contract RecoveryTest is MandateFixture {
  function test_P1_04_T03_recoverHealthyVaultToOwner() public {
    bytes32 permitId = _activateLiquidity("liq", 2_000_000, 0);
    (T.Action memory d, bytes memory dsig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(d, dsig);
    uint256 shares = vault.balanceOf(address(wallet));
    uint256 assets = vault.previewRedeem(shares);

    vm.expectEmit(false, false, false, true, address(wallet));
    emit MandateWallet.Recovered(9_000_000, shares, assets, false);
    _applyAdmin(T.CMD_RECOVER, bytes32(0));

    assertEq(token.balanceOf(ownerAddr), 9_000_000 + assets);
    assertEq(token.balanceOf(address(wallet)), 0);
    assertEq(vault.balanceOf(address(wallet)), 0);
    assertTrue(wallet.paused());
    assertEq(wallet.authorityEpoch(), 1);
  }

  function _badVaultWallet(UnavailableVault.Mode mode) internal returns (MandateWallet w, UnavailableVault bad) {
    bad = new UnavailableVault(address(token), mode);
    w = new MandateWallet(ownerAddr, address(token), address(usdc), address(bad));
    token.mint(address(w), 5_000_000);
    bad.mintShares(address(w), 1_000);
  }

  function _recoverOn(MandateWallet w, uint8 command) internal {
    T.Admin memory a = T.Admin(command, bytes32(0), w.adminNonce(), uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + 600));
    bytes memory sig = _sign(OWNER_PK, H.digest(w.domainSeparator(), H.hash(a)));
    vm.prank(makeAddr("independent-sender"));
    w.applyAdmin(a, sig);
  }

  function test_P1_04_T04_revertingVaultStillRecoversLiquid() public {
    (MandateWallet w, UnavailableVault bad) = _badVaultWallet(UnavailableVault.Mode.Revert);
    vm.expectEmit(false, false, false, true, address(w));
    emit MandateWallet.Recovered(5_000_000, 0, 0, true);
    _recoverOn(w, T.CMD_RECOVER);
    assertEq(token.balanceOf(ownerAddr), 5_000_000);
    assertEq(bad.balanceOf(address(w)), 1_000); // position remains visible
    assertTrue(w.paused());
  }

  function test_P1_04_T04_gasBurningVaultIsBounded() public {
    (MandateWallet w,) = _badVaultWallet(UnavailableVault.Mode.BurnGas);
    uint256 gasBefore = gasleft();
    _recoverOn(w, T.CMD_RECOVER);
    assertLt(gasBefore - gasleft(), 1_000_000);
    assertEq(token.balanceOf(ownerAddr), 5_000_000);
  }

  function test_P1_04_T04_recoverLiquidMakesNoVaultCall() public {
    (MandateWallet w, UnavailableVault bad) = _badVaultWallet(UnavailableVault.Mode.Revert);
    _recoverOn(w, T.CMD_RECOVER_LIQUID);
    assertEq(bad.redeemCalls(), 0);
    assertEq(token.balanceOf(ownerAddr), 5_000_000);
    assertEq(w.authorityEpoch(), 1);
  }

  function test_P1_04_T06_recoveryWhilePausedFromIndependentSender() public {
    _applyAdmin(T.CMD_PAUSE, bytes32(0));
    (T.Admin memory a, bytes memory sig) = _admin(T.CMD_RECOVER_LIQUID, bytes32(0));
    address sender = makeAddr("funded-stranger");
    vm.prank(sender);
    wallet.applyAdmin(a, sig);
    assertEq(token.balanceOf(ownerAddr), 10_000_000);
    assertEq(token.balanceOf(sender), 0);
    assertEq(wallet.authorityEpoch(), 2);
  }

  function test_P1_04_T04_disabledVaultReportedNotHidden() public {
    bytes32 permitId = _activateLiquidity("liq-disabled", 2_000_000, 0);
    (T.Action memory d, bytes memory dsig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(d, dsig);
    uint256 shares = vault.balanceOf(address(wallet));
    vault.setWithdrawalsEnabled(false);
    vm.expectEmit(false, false, false, true, address(wallet));
    emit MandateWallet.Recovered(9_000_000, 0, 0, true);
    _applyAdmin(T.CMD_RECOVER, bytes32(0));
    assertEq(vault.balanceOf(address(wallet)), shares); // unrecovered position stays visible
    assertEq(token.balanceOf(ownerAddr), 9_000_000);
  }

  function test_P1_04_T04_returnBombVaultCannotInflateRecovery() public {
    (MandateWallet w,) = _badVaultWallet(UnavailableVault.Mode.ReturnBomb);
    uint256 gasBefore = gasleft();
    _recoverOn(w, T.CMD_RECOVER);
    assertLt(gasBefore - gasleft(), 400_000); // measured ~205k: returned data is bounded by the forwarded gas
    assertEq(token.balanceOf(ownerAddr), 5_000_000);
  }
}
