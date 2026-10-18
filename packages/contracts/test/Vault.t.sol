// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract VaultTest is MandateFixture {
  bytes32 internal permitId;

  function setUp() public override {
    super.setUp();
    permitId = _activateLiquidity("liquidity", 3_000_000, 3_000_000);
  }

  function test_P1_03_T01_allocationBoundary() public {
    // 10,000,000 total: depositing 2,000,001 would put the vault above 20%.
    (T.Action memory over, bytes memory overSig) = _vaultAction(permitId, T.OP_DEPOSIT, 2_000_001, 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("allocation")));
    _run(over, overSig);

    uint256 expectedShares = vault.previewDeposit(2_000_000);
    (T.Action memory a, bytes memory sig) = _vaultAction(permitId, T.OP_DEPOSIT, 2_000_000, expectedShares);
    vm.expectEmit(true, true, false, true, address(wallet));
    emit MandateWallet.ActionExecuted(permitId, a.requestId, T.OP_DEPOSIT, address(token), address(vault), 2_000_000, expectedShares, bytes32(0), a.inputHash, _actionDigest(a), false);
    _run(a, sig);

    assertEq(vault.balanceOf(address(wallet)), expectedShares);
    assertEq(token.balanceOf(address(wallet)), 8_000_000);
    assertEq(token.allowance(address(wallet), address(vault)), 0);
    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    assertEq(st.depositedAssets, 2_000_000);
    assertEq(st.grossSpend, 0); // deposits are not payments
    MandateWallet.Budget memory b = wallet.getBudget(executor, address(token));
    assertEq(b.vaultShares, expectedShares);
    assertEq(b.walletGross, 0);
  }

  function test_P1_03_T02_minOutputAboveActualSharesIsAtomic() public {
    uint256 shares = vault.previewDeposit(1_000_000);
    (T.Action memory a, bytes memory sig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, shares + 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("minOutput")));
    _run(a, sig);
    assertEq(token.balanceOf(address(wallet)), 10_000_000);
    assertEq(vault.balanceOf(address(wallet)), 0);
    assertEq(token.allowance(address(wallet), address(vault)), 0);
    assertEq(wallet.getPermit(permitId).depositedAssets, 0);
    assertFalse(wallet.usedRequest(a.requestId));
  }

  function test_P1_03_T03_redeemOnlyToWallet() public {
    (T.Action memory d, bytes memory dsig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(d, dsig);
    uint256 shares = vault.balanceOf(address(wallet));
    uint256 assets = vault.previewRedeem(shares);

    (T.Action memory w, bytes memory wsig) = _vaultAction(permitId, T.OP_WITHDRAW, shares, assets + 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("minOutput")));
    _run(w, wsig);

    (w, wsig) = _vaultAction(permitId, T.OP_WITHDRAW, shares, assets);
    _run(w, wsig);
    assertEq(vault.balanceOf(address(wallet)), 0);
    assertEq(token.balanceOf(address(wallet)), 9_000_000 + assets);
    assertEq(wallet.getPermit(permitId).withdrawnAssets, assets);

    // Any target other than the immutable vault is rejected.
    (T.Action memory bad, bytes memory badSig) = _vaultAction(permitId, T.OP_WITHDRAW, 1, 1);
    bad.target = providerA;
    badSig = _signAction(bad, EXECUTOR_PK);
    vm.expectRevert(MandateWallet.InvalidTarget.selector);
    _run(bad, badSig);
  }

  function test_P1_03_T04_disabledRedemptionLeavesPositionVisible() public {
    (T.Action memory d, bytes memory dsig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(d, dsig);
    uint256 shares = vault.balanceOf(address(wallet));
    vault.setWithdrawalsEnabled(false);
    (T.Action memory w, bytes memory wsig) = _vaultAction(permitId, T.OP_WITHDRAW, shares, 1);
    vm.expectRevert();
    _run(w, wsig);
    assertEq(vault.balanceOf(address(wallet)), shares);
    assertEq(token.balanceOf(address(wallet)), 9_000_000);
    assertEq(wallet.getBudget(executor, address(token)).vaultShares, shares);
  }

  function test_P1_03_T06_zeroMinOutputAndWrongKind() public {
    (T.Action memory a, bytes memory sig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 0);
    vm.expectRevert(MandateWallet.InvalidAmount.selector);
    _run(a, sig);
    (a, sig) = _vaultAction(permitId, T.OP_PAY, 1_000_000, 0);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.OperationNotAllowed.selector, T.KIND_LIQUIDITY, T.OP_PAY));
    _run(a, sig);
    assertEq(wallet.getPermit(permitId).actionCount, 0);
  }

  function test_P1_03_depositAndWithdrawCaps() public {
    bytes32 small = _activateLiquidity("small-caps", 500_000, 100_000);
    (T.Action memory a, bytes memory sig) = _vaultAction(small, T.OP_DEPOSIT, 500_001, 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("depositCap")));
    _run(a, sig);
    (a, sig) = _vaultAction(small, T.OP_DEPOSIT, 500_000, 1);
    _run(a, sig);
    uint256 shares = vault.balanceOf(address(wallet));
    (a, sig) = _vaultAction(small, T.OP_WITHDRAW, shares, 1);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("withdrawCap")));
    _run(a, sig);
  }

  function test_P1_03_acceptanceDepositRedeemThenPay() public {
    // Deposit 1 DUSD from 10 liquid, redeem back, and a separate browser payment still works.
    (T.Action memory d, bytes memory dsig) = _vaultAction(permitId, T.OP_DEPOSIT, 1_000_000, 1);
    _run(d, dsig);
    uint256 shares = vault.balanceOf(address(wallet));
    (T.Action memory w, bytes memory wsig) = _vaultAction(permitId, T.OP_WITHDRAW, shares, 1);
    _run(w, wsig);
    bytes32 browser = _activateNew("browser-after-vault");
    _execute(_pay(browser, 200_000, providerA, PROVIDER_A_PK));
    assertEq(token.balanceOf(providerA), 200_000);
  }
}
