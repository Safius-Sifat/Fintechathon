// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract AuthorityTest is MandateFixture {
  uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

  function _tryActivate(T.Permit memory p, bytes memory sig, bytes4 err) internal {
    vm.expectPartialRevert(err);
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
    assertEq(wallet.permitNonce(), 0);
  }

  function test_P1_02_T04_wrongOwnerSignature() public {
    T.Permit memory p = _permit("t");
    _tryActivate(p, _signPermit(p, EXECUTOR_PK), MandateWallet.InvalidSignature.selector);
  }

  function test_P1_02_T04_highSAndMalformedSignatures() public {
    T.Permit memory p = _permit("t");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(p)));
    bytes memory highS = abi.encodePacked(r, bytes32(SECP256K1_N - uint256(s)), v == 27 ? uint8(28) : uint8(27));
    _tryActivate(p, highS, MandateWallet.InvalidSignature.selector);
    _tryActivate(p, abi.encodePacked(r, s), MandateWallet.InvalidSignature.selector);
    _tryActivate(p, "", MandateWallet.InvalidSignature.selector);
  }

  function test_P1_02_T04_wrongEpochNonceAndTime() public {
    T.Permit memory p = _permit("t");
    p.epoch = 1;
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.WrongEpoch.selector);
    p = _permit("t");
    p.nonce = 5;
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.WrongNonce.selector);
    p = _permit("t");
    p.expiresAt = uint64(vm.getBlockTimestamp() + 1 days + 1);
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.LifetimeTooLong.selector);
    p = _permit("t");
    vm.warp(vm.getBlockTimestamp() + 2 hours);
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.Expired.selector);
  }

  function test_P1_02_T04_wrongExecutorOnAction() public {
    bytes32 permitId = _activateNew("t");
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    x.executorSig = _signAction(x.action, OWNER_PK);
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
  }

  function test_P1_02_T04_activationRules() public {
    T.Permit memory p = _permit("t");
    p.executor = address(0);
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.ZeroAddress.selector);
    p = _permit("t");
    p.asset = address(0x1234);
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.AssetNotSupported.selector);
    p = _permit("t");
    p.recipientsHash = keccak256("wrong");
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.RecipientsInvalid.selector);

    // Unsorted recipients are rejected even when the hash matches them.
    p = _permit("t");
    address[] memory unsorted = new address[](2);
    (unsorted[0], unsorted[1]) = (_recipients()[1], _recipients()[0]);
    p.recipientsHash = keccak256(abi.encode(unsorted));
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(MandateWallet.RecipientsInvalid.selector);
    wallet.activatePermit(p, unsorted, _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_02_T04_duplicateTask() public {
    _activateNew("same-task");
    T.Permit memory p = _permit("same-task");
    _tryActivateAfterOne(p);
  }

  function _tryActivateAfterOne(T.Permit memory p) internal {
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(MandateWallet.TaskAlreadyUsed.selector);
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_02_T06_factoryCanonicalAndPermissionless() public {
    address stranger = makeAddr("stranger");
    address someone = makeAddr("someone-else");
    assertEq(factory.predictWallet(someone), factory.predictWallet(someone));
    vm.prank(stranger);
    address w = factory.createWallet(someone);
    assertEq(w, factory.predictWallet(someone));
    assertEq(MandateWallet(payable(w)).owner(), someone);
    assertEq(MandateWallet(payable(w)).token(), address(token));
    vm.prank(makeAddr("third"));
    assertEq(factory.createWallet(someone), w);
    assertEq(factory.walletForOwner(someone), w);
    assertEq(factory.createWallet(ownerAddr), address(wallet));
  }

  function test_P1_02_T07_kindRestrictionsAndUnusedFields() public {
    T.Permit memory p = _permit("t");
    p.depositCap = 1;
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.FieldNotZero.selector);
    p = _permit("t");
    p.periodCap = 1;
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.FieldNotZero.selector);
    p = _permit("t");
    p.kind = 4; // no such kind
    _tryActivate(p, _signPermit(p, OWNER_PK), MandateWallet.KindNotSupported.selector);

    bytes32 permitId = _activateNew("browser");
    for (uint8 op = T.OP_TRANSFER; op <= T.OP_WITHDRAW; op++) {
      Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
      x.action.operation = op;
      x.executorSig = _signAction(x.action, EXECUTOR_PK);
      vm.expectRevert(abi.encodeWithSelector(MandateWallet.OperationNotAllowed.selector, T.KIND_BROWSER, op));
      _execute(x);
    }
  }

  function test_P1_02_T04_relayerHasNoPrivilege() public {
    // The relayer can submit but cannot redirect: the signed target is what pays.
    bytes32 permitId = _activateNew("t");
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    _execute(x);
    assertEq(token.balanceOf(relayer), 0);
    assertEq(token.balanceOf(providerA), 100_000);
  }
}
