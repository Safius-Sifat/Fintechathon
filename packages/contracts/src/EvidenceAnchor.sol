// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Publishes evidence checkpoint commitments (S6). Only the immutable publisher can
/// anchor; sequences strictly increase per task and a stored digest is never overwritten.
/// An anchor commits that these bytes were published at this time; it does not certify that
/// the export is true or complete. No owner or executor authority, no upgrade key.
contract EvidenceAnchor {
  address public immutable publisher;
  mapping(bytes32 => uint64) public nextSequence;
  mapping(bytes32 => mapping(uint64 => bytes32)) public checkpointOf;

  event Anchored(bytes32 indexed taskId, bytes32 checkpointDigest, uint64 sequence, address publisher);

  error NotPublisher();
  error ZeroValue();
  error SequenceNotIncreasing();

  constructor(address publisher_) {
    if (publisher_ == address(0)) revert ZeroValue();
    publisher = publisher_;
  }

  function anchor(bytes32 taskId, bytes32 checkpointDigest, uint64 sequence) external {
    if (msg.sender != publisher) revert NotPublisher();
    if (taskId == bytes32(0) || checkpointDigest == bytes32(0)) revert ZeroValue();
    if (sequence < nextSequence[taskId] || sequence == type(uint64).max) revert SequenceNotIncreasing();
    nextSequence[taskId] = sequence + 1;
    checkpointOf[taskId][sequence] = checkpointDigest;
    emit Anchored(taskId, checkpointDigest, sequence, msg.sender);
  }
}
