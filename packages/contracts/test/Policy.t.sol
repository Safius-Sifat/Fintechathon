// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract PolicyTest is MandateFixture {
  function test_P1_A02_defaultPolicyIsDemoUsdCeilings() public view {
    T.WalletPolicy memory p = wallet.walletPolicy();
    assertEq(p.version, 0);
    assertEq(p.reviewThreshold, type(uint256).max);
    (uint256 perTx, uint256 daily, uint256 weekly, bool set) = wallet.assetCap(address(token));
    assertEq(perTx, 500_000);
    assertEq(daily, 10_000_000);
    assertEq(weekly, 25_000_000);
    assertTrue(set);
    (,,, bool usdcSet) = wallet.assetCap(address(usdc));
    assertFalse(usdcSet); // USDC needs an explicit owner AssetCap
  }

  function test_P1_A02_T01_permitBeyondPolicyRejects() public {
    Lists memory l = _lists();
    l.caps[0].perTx = 100_000;
    l.caps[1].perTx = 100_000;
    l.allowlist = _one(providerA);
    _applyPolicy(l, type(uint256).max);

    T.Permit memory p = _permit("over-cap"); // maxPayment 500,000 > perTx 100,000
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("perTx")));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);

    p = _permit("not-allowlisted");
    p.maxPayment = 100_000; // providerB is a recipient but not on the allowlist
    sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("allowlist")));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_A02_T01_blocklistedRecipientRejects() public {
    Lists memory l = _lists();
    l.blocklist = _one(providerB);
    _applyPolicy(l, type(uint256).max);
    T.Permit memory p = _permit("blocked");
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("blocklist")));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_A02_T02_tighteningAppliesToActivePermits() public {
    bytes32 permitId = _activateNew("active");
    Pay memory x = _pay(permitId, 300_000, providerA, PROVIDER_A_PK);
    Lists memory l = _lists();
    l.caps[0].perTx = 200_000;
    l.caps[1].perTx = 200_000;
    _applyPolicy(l, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("perTx")));
    _execute(x);
    _execute(_pay(permitId, 200_000, providerA, PROVIDER_A_PK));

    // Blocklisting a recipient stops it immediately for active Permits.
    l.blocklist = _one(providerA);
    _applyPolicy(l, type(uint256).max);
    Pay memory y = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyViolation.selector, bytes32("blocklist")));
    _execute(y);
  }

  function test_P1_A02_T02_looseningNeverEnlargesPermit() public {
    T.Permit memory p = _permit("small");
    p.maxPayment = 100_000;
    bytes32 permitId = _activate(p);
    _applyPolicy(_lists(), type(uint256).max); // already at ceilings: "loosest" policy
    Pay memory x = _pay(permitId, 100_001, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.LimitExceeded.selector, bytes32("maxPayment")));
    _execute(x);
  }

  function test_P1_A02_policyApplyRules() public {
    Lists memory l = _lists();
    (T.WalletPolicy memory p, bytes memory sig) = _signedPolicy(l, type(uint256).max);
    bytes memory executorSig = _sign(EXECUTOR_PK, H.digest(wallet.domainSeparator(), H.hash(p)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, executorSig);

    // Lists must hash to what the owner signed.
    l.allowlist = _one(providerA);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyInvalid.selector, bytes32("allowlistHash")));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);

    // Caps above S2 ceilings reject.
    l = _lists();
    l.caps[0].daily = 10_000_001;
    (p, sig) = _signedPolicy(l, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyInvalid.selector, bytes32("ceiling")));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);

    // Version must increase; a valid policy applies and bumps the nonce.
    l = _lists();
    (p, sig) = _signedPolicy(l, 250_000);
    vm.expectEmit(false, false, false, true, address(wallet));
    emit MandateWallet.WalletPolicyUpdated(1, H.digest(wallet.domainSeparator(), H.hash(p)));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);
    assertEq(wallet.policyNonce(), 1);
    assertEq(wallet.walletPolicy().reviewThreshold, 250_000);
    vm.expectRevert(MandateWallet.WrongNonce.selector);
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);
  }

  function test_P1_A02_bannedTemplatesRejected() public {
    Lists memory l = _lists();
    l.templates = new T.CallTemplate[](1);
    l.templates[0] = T.CallTemplate(bytes32(0), address(vault), address(vault).codehash, bytes4(0x095ea7b3), 0, 0, 0, 0, 1);
    l.templates[0].templateId = H.callTemplateId(l.templates[0]);
    (T.WalletPolicy memory p, bytes memory sig) = _signedPolicy(l, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyInvalid.selector, bytes32("selector")));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);

    // deposit(uint256,address) on an agent asset token is a banned target.
    l.templates[0] = T.CallTemplate(bytes32(0), address(token), address(token).codehash, bytes4(0x6e553f65), 0, 1, 1, 1, 1);
    l.templates[0].templateId = H.callTemplateId(l.templates[0]);
    (p, sig) = _signedPolicy(l, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyInvalid.selector, bytes32("target")));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);

    // A wrong (non content-addressed) template ID rejects.
    l.templates[0] = T.CallTemplate(keccak256("forged"), address(vault), address(vault).codehash, bytes4(0x6e553f65), 0, 1, 1, 1, 1);
    (p, sig) = _signedPolicy(l, type(uint256).max);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.PolicyInvalid.selector, bytes32("templateId")));
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);
  }

  function test_P1_A02_policyWorksWhilePausedAndFrozen() public {
    _applyAdmin(T.CMD_FREEZE, bytes32(0));
    _applyAdmin(T.CMD_PAUSE, bytes32(0));
    _applyPolicy(_lists(), 1);
    assertEq(wallet.walletPolicy().reviewThreshold, 1);
  }
}
