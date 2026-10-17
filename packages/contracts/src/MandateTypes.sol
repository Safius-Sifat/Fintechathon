// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Shared layouts only. No wallet logic is implemented by this file.
library MandateTypes {
 struct Permit {
  bytes32 taskId; address executor; uint8 kind; bytes32 runbookHash;
  bytes32 conditionsHash; bytes32 recipientsHash; bytes32 scheduleHash;
  uint64 issuedAt; uint64 startsAt; uint64 expiresAt; uint64 epoch;
  uint256 nonce; uint32 maxActions; uint32 maxPayments; uint256 maxPayment;
  uint256 spendCap; uint256 liquidFloor; uint256 depositCap; uint256 withdrawCap;
 }
 struct Action {
  bytes32 permitId; bytes32 requestId; uint8 operation; address target;
  uint256 amount; uint256 minOutput; bytes32 invoiceId; bytes32 inputHash;
  uint32 period; uint64 issuedAt; uint64 deadline;
 }
 struct Schedule { address recipient; uint256 amount; uint64 start; uint32 interval; uint32 window; uint32 periods; }
 struct Admin { uint8 command; bytes32 permitId; uint256 nonce; uint64 issuedAt; uint64 deadline; }
 struct Invoice { bytes32 invoiceId; bytes32 taskId; address wallet; address recipient; uint256 amount; bytes32 inputHash; uint64 issuedAt; uint64 expiresAt; }
}
