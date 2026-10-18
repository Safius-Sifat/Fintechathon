// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Shared v7 layouts (architecture S3). Field order must match
/// packages/schema/src/authority.ts and policy.ts exactly.
library MandateTypes {
  uint8 internal constant KIND_BROWSER = 0;
  uint8 internal constant KIND_LIQUIDITY = 1;
  uint8 internal constant KIND_SCHEDULE = 2;
  uint8 internal constant KIND_ALLOWANCE = 3;

  uint8 internal constant OP_PAY = 0;
  uint8 internal constant OP_TRANSFER = 1;
  uint8 internal constant OP_DEPOSIT = 2;
  uint8 internal constant OP_WITHDRAW = 3;
  uint8 internal constant OP_CLOSE = 4;
  uint8 internal constant OP_CALL = 5;
  uint8 internal constant OP_X402 = 6;

  uint8 internal constant CMD_PAUSE = 0;
  uint8 internal constant CMD_UNPAUSE = 1;
  uint8 internal constant CMD_REVOKE = 2;
  uint8 internal constant CMD_RECOVER = 3;
  uint8 internal constant CMD_RECOVER_LIQUID = 4;
  uint8 internal constant CMD_FREEZE = 5;
  uint8 internal constant CMD_UNFREEZE = 6;

  uint8 internal constant RECIPIENT_NONE = 0;
  uint8 internal constant RECIPIENT_WALLET = 1;
  uint8 internal constant RECIPIENT_ALLOWLIST = 2;
  uint8 internal constant FLAG_PULLS_ASSET = 1;

  struct Permit {
    bytes32 taskId; address executor; uint8 kind; address asset; bytes32 runbookHash;
    bytes32 conditionsHash; bytes32 recipientsHash; bytes32 scheduleHash; bytes32 templatesHash;
    uint64 issuedAt; uint64 startsAt; uint64 expiresAt; uint64 epoch; uint256 nonce;
    uint32 maxActions; uint32 maxPayments; uint256 maxPayment; uint256 spendCap;
    uint256 liquidFloor; uint256 depositCap; uint256 withdrawCap; uint256 reviewThreshold;
    uint256 periodCap; uint32 periodSeconds;
  }
  struct Action {
    bytes32 permitId; bytes32 requestId; uint8 operation; address target;
    uint256 amount; uint256 minOutput; bytes32 invoiceId; bytes32 inputHash;
    uint32 period; uint64 issuedAt; uint64 deadline;
  }
  struct Schedule { address recipient; uint256 amount; uint64 start; uint32 interval; uint32 window; uint32 periods; }
  struct Admin { uint8 command; bytes32 permitId; uint256 nonce; uint64 issuedAt; uint64 deadline; }
  struct OwnerTransfer {
    bytes32 transferId; address asset; address recipient; uint256 amount;
    uint64 epoch; uint256 nonce; uint64 issuedAt; uint64 deadline;
  }
  struct Approval { bytes32 actionDigest; uint64 expiresAt; }
  struct WalletPolicy {
    uint64 version; bytes32 assetCapsHash; bytes32 allowlistHash; bytes32 blocklistHash;
    bytes32 templatesHash; uint256 reviewThreshold; uint256 nonce; uint64 issuedAt; uint64 deadline;
  }
  struct AssetCap { address asset; uint256 perTx; uint256 daily; uint256 weekly; }
  struct CallTemplate {
    bytes32 templateId; address target; bytes32 targetCodeHash; bytes4 selector; uint8 amountArg;
    uint8 recipientArg; uint8 recipientRule; uint8 flags; uint256 maxAmount;
  }
  struct Invoice {
    bytes32 invoiceId; bytes32 taskId; address wallet; address asset; address recipient;
    uint256 amount; bytes32 inputHash; uint64 issuedAt; uint64 expiresAt;
  }
  struct DeliveryReceipt {
    bytes32 invoiceId; bytes32 requestId; bytes32 inputHash; bytes32 resultHash;
    bytes32 paymentTxHash; uint64 completedAt;
  }
  struct Login { string origin; bytes32 nonce; bytes32 deviceId; uint64 issuedAt; uint64 expiresAt; }
}
