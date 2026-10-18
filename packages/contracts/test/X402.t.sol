// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract X402Test is MandateFixture {
  bytes4 internal constant MAGIC = 0x1626ba7e;
  bytes4 internal constant INVALID = 0xffffffff;
  bytes32 internal permitId;

  function setUp() public override {
    super.setUp();
    _applyPolicy(_lists(), type(uint256).max); // adds the USDC AssetCap
    permitId = _activate(_usdcPermit("x402"));
  }

  function _register(uint256 amount) internal returns (Pay memory x) {
    x = _x402(permitId, amount, providerA, PROVIDER_A_PK);
    _execute(x);
  }

  function _valid(Pay memory x) internal view returns (bytes4) {
    return wallet.isValidSignature(_x402Digest(x.action), _x402Sig(x.action));
  }

  function test_P1_A03_registerChargesAndSettles() public {
    Pay memory x = _x402(permitId, 400_000, providerA, PROVIDER_A_PK);
    vm.expectEmit(true, true, false, true, address(wallet));
    emit MandateWallet.X402Authorized(permitId, _x402Digest(x.action), providerA, 400_000, x.action.deadline);
    _execute(x);
    assertEq(wallet.getPermit(permitId).grossSpend, 400_000); // charged at registration
    assertEq(usdc.balanceOf(address(wallet)), 10_000_000); // nothing moved yet
    assertEq(_valid(x), MAGIC);

    _settle(x.action); // USDC pulls via ERC-1271
    assertEq(usdc.balanceOf(providerA), 400_000);
    assertEq(usdc.balanceOf(address(wallet)), 9_600_000);
    assertEq(wallet.getPermit(permitId).grossSpend, 400_000); // not charged twice
    vm.expectRevert(); // nonce used
    _settle(x.action);
  }

  function test_P1_A03_T05_nonMagicCases() public {
    Pay memory x = _register(100_000);
    assertEq(wallet.isValidSignature(keccak256("random"), _x402Sig(x.action)), INVALID);
    assertEq(wallet.isValidSignature(_x402Digest(x.action), abi.encodePacked(x.action.requestId, x.action.permitId, uint8(2))), INVALID);
    assertEq(wallet.isValidSignature(_x402Digest(x.action), ""), INVALID);
    vm.warp(x.action.deadline);
    assertEq(_valid(x), INVALID); // expired: block.timestamp >= validBefore
  }

  function test_P1_A03_T05_stoppedByFreezePauseRevokeEpoch() public {
    Pay memory x = _register(100_000);
    _applyAdmin(T.CMD_FREEZE, bytes32(0));
    assertEq(_valid(x), INVALID);
    _applyAdmin(T.CMD_UNFREEZE, bytes32(0));
    assertEq(_valid(x), MAGIC);
    _applyAdmin(T.CMD_REVOKE, permitId);
    assertEq(_valid(x), INVALID);
    vm.expectRevert(); // settlement fails closed
    _settle(x.action);
  }

  function test_P1_A03_T05_pauseAndEpochChange() public {
    Pay memory x = _register(100_000);
    _applyAdmin(T.CMD_PAUSE, bytes32(0));
    assertEq(_valid(x), INVALID);
    _applyAdmin(T.CMD_UNPAUSE, bytes32(0)); // epoch stays bumped
    assertEq(_valid(x), INVALID);
  }

  function test_P1_A03_T09_outstandingCountsAgainstFloor() public {
    // Liquid USDC 3,800,000; two outstanding 400,000 authorizations leave 3,000,000.
    vm.prank(address(wallet));
    usdc.transfer(address(0xdead), 6_200_000);
    _register(400_000);
    _register(400_000);
    bytes32 other = _activate(_usdcPermit("x402-pay"));
    Pay memory pay = _pay(other, 1, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("liquidFloor")));
    _execute(pay);
  }

  function test_P1_A03_T10_tighterPerTxOrRemovedCapInvalidates() public {
    Pay memory x = _register(400_000);
    Lists memory l = _lists();
    for (uint256 i = 0; i < 2; i++) if (l.caps[i].asset == address(usdc)) l.caps[i].perTx = 300_000;
    _applyPolicy(l, type(uint256).max);
    assertEq(_valid(x), INVALID);
    vm.expectRevert();
    _settle(x.action);

    _applyPolicy(_lists(), type(uint256).max);
    assertEq(_valid(x), MAGIC);
    T.AssetCap[] memory onlyDusd = new T.AssetCap[](1);
    onlyDusd[0] = T.AssetCap(address(token), 500_000, 10_000_000, 25_000_000);
    l = _lists();
    l.caps = onlyDusd;
    _applyPolicy(l, type(uint256).max);
    assertEq(_valid(x), INVALID);
  }

  function test_P1_A03_T11_reviewThresholdVersusOwnerApproval() public {
    Pay memory plain = _register(400_000);
    T.Permit memory p = _usdcPermit("x402-reviewed");
    p.reviewThreshold = 100_000;
    bytes32 reviewed = _activate(p);
    Pay memory approved = _x402(reviewed, 400_000, providerA, PROVIDER_A_PK);
    _approve(approved, OWNER_PK);
    _execute(approved);

    _applyPolicy(_lists(), 100_000); // lower the wallet-wide review threshold
    assertEq(_valid(plain), INVALID);
    assertEq(_valid(approved), MAGIC); // the owner approved this exact Action
  }

  function test_P1_A03_T12_lowerDailyCapDoesNotDoubleCharge() public {
    Pay memory x = _register(400_000);
    Lists memory l = _lists();
    for (uint256 i = 0; i < 2; i++) if (l.caps[i].asset == address(usdc)) (l.caps[i].perTx, l.caps[i].daily) = (400_000, 400_000);
    _applyPolicy(l, type(uint256).max);
    assertEq(_valid(x), MAGIC);
    _settle(x.action);
    assertEq(wallet.getBudget(executor, address(usdc)).walletGross, 400_000);
  }

  function test_P1_A03_T13_allowlistRemovalAndBlocklist() public {
    Lists memory l = _lists();
    l.allowlist = _one(providerA);
    _applyPolicy(l, type(uint256).max);
    Pay memory x = _register(100_000);
    l.allowlist = new address[](0); // empty list turns filtering off
    _applyPolicy(l, type(uint256).max);
    assertEq(_valid(x), MAGIC);
    l.blocklist = _one(providerA);
    _applyPolicy(l, type(uint256).max);
    assertEq(_valid(x), INVALID);
    Pay memory y = _x402(permitId, 100_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("blocklist")));
    _execute(y);
  }

  function test_P1_A03_atMostEightOutstandingAndPruning() public {
    T.Permit memory p = _usdcPermit("x402-many");
    p.maxActions = 20;
    p.maxPayments = 3;
    bytes32[3] memory ids = [permitId, _activate(p), _activate(_usdcPermit("x402-third"))];
    Pay[9] memory xs;
    for (uint256 i = 0; i < 8; i++) {
      xs[i] = _x402(ids[i / 3], 1_000, providerA, PROVIDER_A_PK);
      _execute(xs[i]);
    }
    bytes32 fourth = _activate(_usdcPermit("x402-fourth"));
    xs[8] = _x402(fourth, 1_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("x402Outstanding")));
    _execute(xs[8]);
    // Settling one frees a slot (pruned via authorizationState on the next execute).
    _settle(xs[0].action);
    _execute(xs[8]);
    assertEq(wallet.x402Outstanding(address(usdc)), 8 * 1_000);
  }

  function test_P1_A03_x402RequiresUsdcPermit() public {
    bytes32 dusd = _activateNew("dusd-x402");
    Pay memory x = _x402(dusd, 100_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.AssetNotSupported.selector, address(token)));
    _execute(x);
  }

  function test_P1_A03_registrationEventReportsNoMovement() public {
    Pay memory x = _x402(permitId, 400_000, providerA, PROVIDER_A_PK);
    vm.expectEmit(true, true, false, true, address(wallet));
    emit MandateWallet.ActionExecuted(permitId, x.action.requestId, T.OP_X402, address(usdc), providerA, 0, 0, x.invoice.invoiceId, x.invoice.inputHash, _actionDigest(x.action), false);
    _execute(x);
  }

  function test_P1_A03_revokedAndExpiredAuthorizationsAreFreed() public {
    bytes32 other = _activate(_usdcPermit("x402-other"));
    Pay memory expiring = _x402(other, 300_000, providerA, PROVIDER_A_PK);
    _execute(expiring);
    vm.warp(vm.getBlockTimestamp() + 30);
    Pay memory revoked = _register(400_000); // expires 30 s after `expiring`
    assertEq(wallet.x402Outstanding(address(usdc)), 700_000);
    _applyAdmin(T.CMD_REVOKE, permitId);
    vm.warp(expiring.action.deadline);
    assertLt(vm.getBlockTimestamp(), revoked.action.deadline); // still unexpired, only revoked
    // The next execute prunes both: one can never become valid again, one expired.
    bytes32 fresh = _activate(_usdcPermit("x402-fresh"));
    _execute(_x402(fresh, 100_000, providerA, PROVIDER_A_PK));
    assertEq(wallet.x402Outstanding(address(usdc)), 100_000);
    assertEq(_valid(revoked), INVALID);
  }

  function test_P1_A03_failingUsdcViewDoesNotBlockOtherPayments() public {
    _register(100_000);
    vm.mockCallRevert(address(usdc), abi.encodeWithSelector(usdc.authorizationState.selector), "down");
    bytes32 dusd = _activateNew("dusd-during-outage");
    _execute(_pay(dusd, 100_000, providerA, PROVIDER_A_PK));
    assertEq(token.balanceOf(providerA), 100_000);
    assertEq(wallet.x402Outstanding(address(usdc)), 100_000); // kept reserved, not dropped
  }

  function test_P1_A03_x402UnderAllowancePeriodCap() public {
    T.Permit memory p = _allowancePermit("x402-allowance", 500_000, 1 days);
    p.asset = address(usdc);
    bytes32 allowance = _activate(p);
    _execute(_x402(allowance, 400_000, providerA, PROVIDER_A_PK));
    Pay memory over = _x402(allowance, 100_001, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("periodCap")));
    _execute(over);
    assertEq(wallet.getPeriodSpend(allowance, 0), 400_000);
  }
}
