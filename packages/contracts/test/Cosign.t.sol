// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract CosignTest is MandateFixture {
  function test_P1_A02_T03_policyThresholdAppliesWhenLower() public {
    bytes32 permitId = _activateNew("permit-no-threshold"); // Permit threshold = max
    _applyPolicy(_lists(), 150_000); // wallet-wide threshold is lower and wins
    Pay memory x = _pay(permitId, 200_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(MandateWallet.ApprovalRequired.selector);
    _execute(x);
    _approve(x, OWNER_PK);
    _execute(x);
    assertEq(token.balanceOf(providerA), 200_000);
  }

  function test_P1_A02_T03_expiredApprovalRejects() public {
    T.Permit memory p = _permit("expiring");
    p.reviewThreshold = 0;
    bytes32 permitId = _activate(p);
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    _approve(x, OWNER_PK);
    x.approval.expiresAt = uint64(vm.getBlockTimestamp() - 1);
    x.ownerApproval = _sign(OWNER_PK, keccak256("ignored")); // any signature: expiry is checked first
    vm.expectRevert(MandateWallet.ApprovalInvalid.selector);
    _execute(x);
  }
}
