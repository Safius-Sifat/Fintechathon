// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {TestPool, Drainer} from "./fixtures/TestPool.sol";

contract CallTemplateTest is MandateFixture {
  bytes4 internal constant DEPOSIT = 0x6e553f65; // deposit(uint256,address)
  TestPool internal pool;
  T.CallTemplate internal tmpl;
  bytes32 internal permitId;

  function setUp() public override {
    super.setUp();
    pool = new TestPool(token);
    tmpl = T.CallTemplate(bytes32(0), address(pool), address(pool).codehash, DEPOSIT, 0, 1, T.RECIPIENT_WALLET, T.FLAG_PULLS_ASSET, 1_000_000);
    Lists memory l = _withTemplate(tmpl);
    tmpl.templateId = l.templates[0].templateId;
    _applyPolicy(l, type(uint256).max);
    permitId = _activateTemplate(_templatePermit("call", tmpl.templateId, 1_500_000), tmpl.templateId);
  }

  function _deposit(uint256 amount, address receiver) internal pure returns (bytes memory) {
    return abi.encodeWithSelector(DEPOSIT, amount, receiver);
  }

  function test_P1_A03_T04_validTemplateDepositIsMetered() public {
    bytes memory data = _deposit(400_000, address(wallet));
    uint256 shares = pool.previewDeposit(400_000);
    (T.Action memory a, bytes memory sig) = _callAction(permitId, address(pool), 400_000, data);
    vm.expectEmit(true, true, true, true, address(wallet));
    emit MandateWallet.CallExecuted(permitId, a.requestId, tmpl.templateId, address(token), address(pool), DEPOSIT, 400_000);
    _runCall(a, sig, data);

    assertEq(token.balanceOf(address(wallet)), 9_600_000);
    assertEq(pool.balanceOf(address(wallet)), shares);
    assertEq(token.allowance(address(wallet), address(pool)), 0);
    assertEq(wallet.getPermit(permitId).grossSpend, 400_000);
    assertEq(wallet.getBudget(executor, address(token)).walletGross, 400_000);
    assertEq(wallet.getBudget(executor, address(usdc)).walletGross, 0);
  }

  function test_P1_A03_T02_boundsRecipientAndShape() public {
    // Amount above the Action amount.
    bytes memory data = _deposit(400_001, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(permitId, address(pool), 400_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("amount")));
    _runCall(a, sig, data);
    // Amount above template maxAmount.
    data = _deposit(1_000_001, address(wallet));
    (a, sig) = _callAction(permitId, address(pool), 1_000_001, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("amount")));
    _runCall(a, sig, data);
    // Receiver must be the wallet.
    data = _deposit(100_000, providerA);
    (a, sig) = _callAction(permitId, address(pool), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("recipient")));
    _runCall(a, sig, data);
    // Calldata must be a selector plus whole 32-byte words.
    data = abi.encodePacked(_deposit(100_000, address(wallet)), bytes1(0x00));
    (a, sig) = _callAction(permitId, address(pool), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("calldata")));
    _runCall(a, sig, data);
    // inputHash binds the exact calldata.
    data = _deposit(100_000, address(wallet));
    (a, sig) = _callAction(permitId, address(pool), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("inputHash")));
    _runCall(a, sig, _deposit(99_999, address(wallet)));
    // execute is not payable, so no ETH value can accompany a call.
    (bool ok,) = address(wallet).call{value: 1}(abi.encodeWithSelector(MandateWallet.execute.selector));
    assertFalse(ok);
    assertEq(wallet.getPermit(permitId).actionCount, 0);
  }

  function test_P1_A03_T03_hostileTargetPullingMoreReverts() public {
    Drainer d = new Drainer(token);
    d.configure(1, token, 0); // pulls assets + 1
    T.CallTemplate memory c = T.CallTemplate(bytes32(0), address(d), address(d).codehash, DEPOSIT, 0, 1, T.RECIPIENT_WALLET, T.FLAG_PULLS_ASSET, 1_000_000);
    Lists memory l = _withTemplate(c);
    _applyPolicy(l, type(uint256).max);
    bytes32 id = l.templates[0].templateId;
    bytes32 pid = _activateTemplate(_templatePermit("drain", id, 1_000_000), id);
    bytes memory data = _deposit(100_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(pid, address(d), 100_000, data);
    vm.expectRevert(); // exact allowance: pulling one unit more fails inside the call
    _runCall(a, sig, data);
    assertEq(token.balanceOf(address(wallet)), 10_000_000);
    assertEq(token.allowance(address(wallet), address(d)), 0);
    assertFalse(wallet.usedRequest(a.requestId));
  }

  function test_P1_A03_T08_otherAgentAssetMayNotDecrease() public {
    Drainer d = new Drainer(token);
    d.configure(0, usdc, 50_000);
    vm.prank(address(wallet));
    usdc.approve(address(d), 50_000); // simulate a stray USDC allowance
    T.CallTemplate memory c = T.CallTemplate(bytes32(0), address(d), address(d).codehash, DEPOSIT, 0, 1, T.RECIPIENT_WALLET, T.FLAG_PULLS_ASSET, 1_000_000);
    Lists memory l = _withTemplate(c);
    _applyPolicy(l, type(uint256).max);
    bytes32 id = l.templates[0].templateId;
    bytes32 pid = _activateTemplate(_templatePermit("cross", id, 1_000_000), id);
    bytes memory data = _deposit(100_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(pid, address(d), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("otherAsset")));
    _runCall(a, sig, data);
    assertEq(usdc.balanceOf(address(wallet)), 10_000_000);
  }

  function test_P1_A03_T07_targetCodeChangeOrTemplateRemoval() public {
    bytes memory data = _deposit(100_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(permitId, address(pool), 100_000, data);
    vm.etch(address(pool), address(new Drainer(token)).code);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("code")));
    _runCall(a, sig, data);
  }

  function test_P1_A03_T07_removingTemplateFromPolicyDisablesIt() public {
    _applyPolicy(_lists(), type(uint256).max);
    bytes memory data = _deposit(100_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(permitId, address(pool), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("policy")));
    _runCall(a, sig, data);
  }

  function test_P1_A03_floorAndSpendCap() public {
    vm.prank(address(wallet));
    token.transfer(address(0xdead), 6_900_000); // liquid 3,100,000
    bytes memory data = _deposit(100_001, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(permitId, address(pool), 100_001, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("liquidFloor")));
    _runCall(a, sig, data);
    data = _deposit(100_000, address(wallet));
    (a, sig) = _callAction(permitId, address(pool), 100_000, data);
    _runCall(a, sig, data);
    assertEq(token.balanceOf(address(wallet)), 3_000_000);
  }

  function test_P1_A03_callOnlyForLiquidityWithTemplate() public {
    bytes32 browser = _activateNew("browser");
    bytes memory data = _deposit(100_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(browser, address(pool), 100_000, data);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.OperationNotAllowed.selector, T.KIND_BROWSER, T.OP_CALL));
    _runCall(a, sig, data);
  }

  function test_P1_A03_allowlistRecipientRule() public {
    T.CallTemplate memory c = T.CallTemplate(bytes32(0), address(pool), address(pool).codehash, DEPOSIT, 0, 1, T.RECIPIENT_ALLOWLIST, T.FLAG_PULLS_ASSET, 1_000_000);
    Lists memory l = _withTemplate(c);
    l.allowlist = _one(providerA);
    _applyPolicy(l, type(uint256).max);
    bytes32 id = l.templates[0].templateId;
    bytes32 pid = _activateTemplate(_templatePermit("allow-rule", id, 1_000_000), id);
    bytes memory bad = _deposit(100_000, providerB);
    (T.Action memory a, bytes memory sig) = _callAction(pid, address(pool), 100_000, bad);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.TemplateDenied.selector, bytes32("recipient")));
    _runCall(a, sig, bad);
    bytes memory good = _deposit(100_000, providerA);
    (a, sig) = _callAction(pid, address(pool), 100_000, good);
    _runCall(a, sig, good);
    assertGt(pool.balanceOf(providerA), 0);
  }

  function test_P1_A03_callAboveThresholdNeedsOwnerApproval() public {
    T.Permit memory p = _templatePermit("call-review", tmpl.templateId, 1_500_000);
    p.reviewThreshold = 200_000;
    bytes32 pid = _activateTemplate(p, tmpl.templateId);
    bytes memory data = _deposit(300_000, address(wallet));
    (T.Action memory a, bytes memory sig) = _callAction(pid, address(pool), 300_000, data);
    vm.expectRevert(MandateWallet.ApprovalRequired.selector);
    _runCall(a, sig, data);
    T.Approval memory ap = T.Approval(_actionDigest(a), a.deadline);
    bytes memory osig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(ap)));
    T.Invoice memory noInvoice;
    vm.prank(relayer);
    wallet.execute(a, sig, noInvoice, "", ap, osig, data);
    assertEq(token.balanceOf(address(wallet)), 9_700_000);
  }
}
