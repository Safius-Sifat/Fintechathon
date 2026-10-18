// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract AdminTest is MandateFixture {
  function test_P1_04_T02_revokeUnactivatedPermit() public {
    T.Permit memory p = _permit("revoke-me");
    bytes32 permitId = H.hash(p);
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectEmit(true, false, false, false, address(wallet));
    emit MandateWallet.PermitRevoked(permitId);
    _applyAdmin(T.CMD_REVOKE, permitId);
    vm.expectRevert(MandateWallet.PermitIsRevoked.selector);
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);

    // An unrelated grant is unaffected.
    bytes32 other = _activateNew("unrelated");
    _execute(_pay(other, 100_000, providerA, PROVIDER_A_PK));
  }

  function test_P1_04_T02_revokeActivePermit() public {
    bytes32 permitId = _activateNew("active");
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    _applyAdmin(T.CMD_REVOKE, permitId);
    assertTrue(wallet.getPermit(permitId).revoked);
    vm.expectRevert(MandateWallet.PermitNotActive.selector);
    _execute(x);
    assertFalse(wallet.paused()); // REVOKE does not pause
    assertEq(wallet.authorityEpoch(), 0);
  }

  function test_P1_04_T05_wrongSignerNonceDeadlineAndPermitId() public {
    (T.Admin memory a, bytes memory sig) = _admin(T.CMD_PAUSE, bytes32(0));
    bytes memory executorSig = _sign(EXECUTOR_PK, H.digest(wallet.domainSeparator(), H.hash(a)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    wallet.applyAdmin(a, executorSig);

    a.nonce = 1;
    sig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(a)));
    vm.expectRevert(MandateWallet.WrongNonce.selector);
    wallet.applyAdmin(a, sig);

    (a, sig) = _admin(T.CMD_PAUSE, bytes32(0));
    a.deadline = a.issuedAt + 1801;
    sig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(a)));
    vm.expectRevert(MandateWallet.LifetimeTooLong.selector);
    wallet.applyAdmin(a, sig);

    (a, sig) = _admin(T.CMD_PAUSE, keccak256("not-zero"));
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.FieldNotZero.selector, bytes32("permitId")));
    wallet.applyAdmin(a, sig);

    (a, sig) = _admin(T.CMD_PAUSE, bytes32(0));
    vm.warp(vm.getBlockTimestamp() + 601);
    vm.expectRevert(MandateWallet.Expired.selector);
    wallet.applyAdmin(a, sig);

    assertEq(wallet.adminNonce(), 0);
    assertEq(wallet.authorityEpoch(), 0);
    assertFalse(wallet.paused());
  }

  function test_P1_04_nonceConsumedOnceAndReplayRejected() public {
    (T.Admin memory a, bytes memory sig) = _admin(T.CMD_PAUSE, bytes32(0));
    wallet.applyAdmin(a, sig);
    assertEq(wallet.adminNonce(), 1);
    vm.expectRevert(MandateWallet.WrongNonce.selector);
    wallet.applyAdmin(a, sig);
  }

  function test_P1_04_unknownCommandRejected() public {
    (T.Admin memory a, bytes memory sig) = _admin(7, bytes32(0));
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.CommandNotSupported.selector, uint8(7)));
    wallet.applyAdmin(a, sig);
  }
}
