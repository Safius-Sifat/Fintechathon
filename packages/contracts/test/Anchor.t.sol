// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvidenceAnchor} from "../src/EvidenceAnchor.sol";

contract AnchorTest is Test {
  EvidenceAnchor internal anchor;
  address internal publisher = makeAddr("publisher");
  bytes32 internal constant TASK = keccak256("task");
  bytes32 internal constant DIGEST = keccak256("checkpoint-1");

  function setUp() public {
    anchor = new EvidenceAnchor(publisher);
  }

  function test_P1_05_T04_publisherAnchorsExactCommitment() public {
    vm.expectEmit(true, false, false, true, address(anchor));
    emit EvidenceAnchor.Anchored(TASK, DIGEST, 3, publisher);
    vm.prank(publisher);
    anchor.anchor(TASK, DIGEST, 3);
    assertEq(anchor.checkpointOf(TASK, 3), DIGEST);
    assertEq(anchor.nextSequence(TASK), 4);
  }

  function test_P1_05_T04_onlyPublisher() public {
    vm.prank(makeAddr("someone"));
    vm.expectRevert(EvidenceAnchor.NotPublisher.selector);
    anchor.anchor(TASK, DIGEST, 0);
  }

  function test_P1_05_T04_rejectsZeroAndNonIncreasingSequence() public {
    vm.startPrank(publisher);
    vm.expectRevert(EvidenceAnchor.ZeroValue.selector);
    anchor.anchor(bytes32(0), DIGEST, 0);
    vm.expectRevert(EvidenceAnchor.ZeroValue.selector);
    anchor.anchor(TASK, bytes32(0), 0);
    anchor.anchor(TASK, DIGEST, 5);
    vm.expectRevert(EvidenceAnchor.SequenceNotIncreasing.selector);
    anchor.anchor(TASK, keccak256("other"), 5); // duplicate sequence
    vm.expectRevert(EvidenceAnchor.SequenceNotIncreasing.selector);
    anchor.anchor(TASK, keccak256("other"), 4); // lower sequence
    anchor.anchor(TASK, keccak256("checkpoint-6"), 6);
    anchor.anchor(keccak256("other-task"), DIGEST, 0); // sequences are per task
    vm.expectRevert(EvidenceAnchor.SequenceNotIncreasing.selector);
    anchor.anchor(TASK, DIGEST, type(uint64).max); // no successor sequence
    vm.stopPrank();
    assertEq(anchor.checkpointOf(TASK, 5), DIGEST); // never overwritten
  }

  function test_P1_05_T04_constructorRejectsZeroPublisher() public {
    vm.expectRevert(EvidenceAnchor.ZeroValue.selector);
    new EvidenceAnchor(address(0));
  }
}
