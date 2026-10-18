// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {ReentrantRecipient} from "./mocks/Mocks.sol";

contract NativeReceiveTest is MandateFixture {
  function test_P1_W02_receivesEthAndRejectsUnknownCalls() public {
    vm.deal(address(this), 2 ether);
    (bool ok,) = address(wallet).call{value: 1 ether}("");
    assertTrue(ok);
    assertEq(address(wallet).balance, 1 ether);
    (bool unknown,) = address(wallet).call{value: 1}(hex"12345678");
    assertFalse(unknown);
  }

  function test_P1_W02_ethSweepToOwner() public {
    vm.deal(address(wallet), 1 ether);
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("eth", address(0), ownerAddr, 0.4 ether);
    uint256 before = ownerAddr.balance;
    wallet.applyOwnerTransfer(t, sig);
    assertEq(ownerAddr.balance - before, 0.4 ether);
    assertEq(address(wallet).balance, 0.6 ether);
  }

  function test_P1_W02_T04_reentrantRecipientGetsOneTransfer() public {
    vm.deal(address(wallet), 1 ether);
    ReentrantRecipient attacker = new ReentrantRecipient();
    (T.OwnerTransfer memory first, bytes memory sig1) = _ownerTransfer("first", address(0), address(attacker), 0.1 ether);
    // A second valid owner-signed transfer for the next epoch/nonce, replayed from inside receive().
    T.OwnerTransfer memory second = T.OwnerTransfer("second", address(0), address(attacker), 0.1 ether, 1, 1, uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + 300));
    attacker.arm(wallet, second, _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(second))));

    wallet.applyOwnerTransfer(first, sig1);
    assertTrue(attacker.reentryFailed());
    assertEq(attacker.received(), 0.1 ether);
    assertEq(wallet.ownerTransferNonce(), 1);
    assertEq(wallet.authorityEpoch(), 1);
  }
}
