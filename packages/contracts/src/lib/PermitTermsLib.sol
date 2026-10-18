// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateTypes as T} from "../MandateTypes.sol";
import {MandateHashes as H} from "../MandateHashes.sol";
import "./MandateLimits.sol";

/// @notice Pure Permit-term checks for each kind (S2/S3), split out of MandateWallet to
/// keep it under the EIP-170 size limit. Error signatures match MandateWallet's.
library PermitTermsLib {
  error LimitExceeded(bytes32 limit);
  error FieldNotZero(bytes32 field);
  error ScheduleInvalid(bytes32 field);
  error ScheduleNotZero();
  error RecipientsInvalid();

  function validateBrowserTerms(T.Permit calldata p) external pure {
    if (p.maxActions == 0 || p.maxActions > MAX_ACTIONS) revert LimitExceeded("maxActions");
    if (p.maxPayments > MAX_BROWSER_PAYMENTS || p.maxPayments > p.maxActions) revert LimitExceeded("maxPayments");
    if (p.maxPayment == 0 || p.maxPayment > MAX_PAYMENT) revert LimitExceeded("maxPayment");
    if (p.spendCap > MAX_TASK_SPEND) revert LimitExceeded("spendCap");
    if (p.liquidFloor < MIN_LIQUID_FLOOR) revert LimitExceeded("liquidFloor");
    if (p.depositCap != 0) revert FieldNotZero("depositCap");
    if (p.withdrawCap != 0) revert FieldNotZero("withdrawCap");
    if (p.periodCap != 0) revert FieldNotZero("periodCap");
    if (p.periodSeconds != 0) revert FieldNotZero("periodSeconds");
  }


  function validateAllowanceTerms(T.Permit calldata p) external pure {
    if (p.maxActions == 0 || p.maxActions > MAX_ALLOWANCE_ACTIONS) revert LimitExceeded("maxActions");
    if (p.maxPayments == 0 || p.maxPayments > p.maxActions) revert LimitExceeded("maxPayments");
    if (p.maxPayment == 0 || p.maxPayment > MAX_PAYMENT) revert LimitExceeded("maxPayment");
    if (p.spendCap == 0) revert LimitExceeded("spendCap");
    if (p.periodSeconds != 1 days && p.periodSeconds != 1 weeks) revert LimitExceeded("periodSeconds");
    if (p.periodCap == 0 || p.periodCap > (p.periodSeconds == 1 days ? MAX_WALLET_DAY : MAX_WALLET_WEEK)) {
      revert LimitExceeded("periodCap");
    }
    if (p.liquidFloor < MIN_LIQUID_FLOOR) revert LimitExceeded("liquidFloor");
    if (p.depositCap != 0) revert FieldNotZero("depositCap");
    if (p.withdrawCap != 0) revert FieldNotZero("withdrawCap");
  }


  function validateLiquidityTerms(T.Permit calldata p) external pure {
    if (p.maxActions == 0 || p.maxActions > MAX_ACTIONS) revert LimitExceeded("maxActions");
    if (p.maxPayments != 0) revert FieldNotZero("maxPayments");
    if (p.maxPayment != 0) revert FieldNotZero("maxPayment");
    if (p.spendCap != 0) revert FieldNotZero("spendCap");
    if (p.liquidFloor < MIN_LIQUID_FLOOR) revert LimitExceeded("liquidFloor");
    if (p.periodCap != 0) revert FieldNotZero("periodCap");
    if (p.periodSeconds != 0) revert FieldNotZero("periodSeconds");
  }


  function validateScheduleTerms(T.Permit calldata p, T.Schedule calldata s) external pure {
    if (H.hashSchedule(s) != p.scheduleHash) revert ScheduleInvalid("hash");
    if (s.recipient == address(0)) revert ScheduleInvalid("recipient");
    if (s.amount == 0 || s.amount > MAX_PAYMENT) revert ScheduleInvalid("amount");
    if (s.interval == 0 || s.window == 0 || s.window > s.interval) revert ScheduleInvalid("window");
    if (s.periods == 0) revert ScheduleInvalid("periods");
    if (p.maxPayments != s.periods) revert ScheduleInvalid("maxPayments");
    if (p.maxActions < p.maxPayments || p.maxActions > MAX_ACTIONS) revert LimitExceeded("maxActions");
    if (p.maxPayment < s.amount || p.maxPayment > MAX_PAYMENT) revert LimitExceeded("maxPayment");
    if (p.spendCap > MAX_TASK_SPEND) revert LimitExceeded("spendCap");
    if (p.liquidFloor < MIN_LIQUID_FLOOR) revert LimitExceeded("liquidFloor");
    // uint256 arithmetic: the last window must close inside the Permit lifetime.
    uint256 lastClose = uint256(s.start) + uint256(s.periods - 1) * uint256(s.interval) + uint256(s.window);
    if (s.start < p.startsAt || lastClose > p.expiresAt) revert ScheduleInvalid("fit");
    if (p.depositCap != 0) revert FieldNotZero("depositCap");
    if (p.withdrawCap != 0) revert FieldNotZero("withdrawCap");
    if (p.periodCap != 0) revert FieldNotZero("periodCap");
    if (p.periodSeconds != 0) revert FieldNotZero("periodSeconds");
  }


  function requireZeroSchedule(bytes32 scheduleHash, T.Schedule calldata s) external pure {
    if (H.hashSchedule(s) != scheduleHash || s.recipient != address(0) || s.amount != 0 || s.start != 0
      || s.interval != 0 || s.window != 0 || s.periods != 0) revert ScheduleNotZero();
  }


  /// recipientsHash = keccak256(abi.encode(address[])) over strictly ascending nonzero addresses.
  function validateRecipients(bytes32 recipientsHash, address[] calldata recipients, uint256 minLen, uint256 maxLen)
    external
    pure
  {
    if (recipients.length < minLen || recipients.length > maxLen) revert RecipientsInvalid();
    for (uint256 i = 0; i < recipients.length; i++) {
      if (recipients[i] == address(0)) revert RecipientsInvalid();
      if (i > 0 && recipients[i - 1] >= recipients[i]) revert RecipientsInvalid();
    }
    if (keccak256(abi.encode(recipients)) != recipientsHash) revert RecipientsInvalid();
  }

}
