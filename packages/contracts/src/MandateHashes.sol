// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateTypes as T} from "./MandateTypes.sol";

/// @notice EIP-712 type hashes, struct hashes and domain separators for v7.
/// Type strings are checked against the TypeScript schema by
/// packages/schema/test/solidity-types.test.ts; vectors by test/MandateHashes.t.sol.
library MandateHashes {
  bytes32 internal constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  uint256 internal constant CHAIN_ID = 84532;

  bytes32 internal constant PERMIT_TYPEHASH = keccak256(
    "Permit(bytes32 taskId,address executor,uint8 kind,address asset,bytes32 runbookHash,bytes32 conditionsHash,bytes32 recipientsHash,bytes32 scheduleHash,bytes32 templatesHash,uint64 issuedAt,uint64 startsAt,uint64 expiresAt,uint64 epoch,uint256 nonce,uint32 maxActions,uint32 maxPayments,uint256 maxPayment,uint256 spendCap,uint256 liquidFloor,uint256 depositCap,uint256 withdrawCap,uint256 reviewThreshold,uint256 periodCap,uint32 periodSeconds)"
  );
  bytes32 internal constant ACTION_TYPEHASH = keccak256(
    "Action(bytes32 permitId,bytes32 requestId,uint8 operation,address target,uint256 amount,uint256 minOutput,bytes32 invoiceId,bytes32 inputHash,uint32 period,uint64 issuedAt,uint64 deadline)"
  );
  bytes32 internal constant ADMIN_TYPEHASH =
    keccak256("Admin(uint8 command,bytes32 permitId,uint256 nonce,uint64 issuedAt,uint64 deadline)");
  bytes32 internal constant OWNER_TRANSFER_TYPEHASH = keccak256(
    "OwnerTransfer(bytes32 transferId,address asset,address recipient,uint256 amount,uint64 epoch,uint256 nonce,uint64 issuedAt,uint64 deadline)"
  );
  bytes32 internal constant APPROVAL_TYPEHASH = keccak256("Approval(bytes32 actionDigest,uint64 expiresAt)");
  bytes32 internal constant WALLET_POLICY_TYPEHASH = keccak256(
    "WalletPolicy(uint64 version,bytes32 assetCapsHash,bytes32 allowlistHash,bytes32 blocklistHash,bytes32 templatesHash,uint256 reviewThreshold,uint256 nonce,uint64 issuedAt,uint64 deadline)"
  );
  bytes32 internal constant INVOICE_TYPEHASH = keccak256(
    "Invoice(bytes32 invoiceId,bytes32 taskId,address wallet,address asset,address recipient,uint256 amount,bytes32 inputHash,uint64 issuedAt,uint64 expiresAt)"
  );
  bytes32 internal constant DELIVERY_RECEIPT_TYPEHASH = keccak256(
    "DeliveryReceipt(bytes32 invoiceId,bytes32 requestId,bytes32 inputHash,bytes32 resultHash,bytes32 paymentTxHash,uint64 completedAt)"
  );
  bytes32 internal constant LOGIN_TYPEHASH =
    keccak256("Login(string origin,bytes32 nonce,bytes32 deviceId,uint64 issuedAt,uint64 expiresAt)");

  // All-static structs: abi.encode(struct) equals the concatenated field encoding EIP-712 needs.
  function hash(T.Permit memory p) internal pure returns (bytes32) { return keccak256(abi.encode(PERMIT_TYPEHASH, p)); }
  function hash(T.Action memory a) internal pure returns (bytes32) { return keccak256(abi.encode(ACTION_TYPEHASH, a)); }
  function hash(T.Admin memory a) internal pure returns (bytes32) { return keccak256(abi.encode(ADMIN_TYPEHASH, a)); }
  function hash(T.OwnerTransfer memory t) internal pure returns (bytes32) { return keccak256(abi.encode(OWNER_TRANSFER_TYPEHASH, t)); }
  function hash(T.Approval memory a) internal pure returns (bytes32) { return keccak256(abi.encode(APPROVAL_TYPEHASH, a)); }
  function hash(T.WalletPolicy memory p) internal pure returns (bytes32) { return keccak256(abi.encode(WALLET_POLICY_TYPEHASH, p)); }
  function hash(T.Invoice memory i) internal pure returns (bytes32) { return keccak256(abi.encode(INVOICE_TYPEHASH, i)); }
  function hash(T.DeliveryReceipt memory d) internal pure returns (bytes32) { return keccak256(abi.encode(DELIVERY_RECEIPT_TYPEHASH, d)); }
  function hash(T.Login memory l) internal pure returns (bytes32) {
    return keccak256(abi.encode(LOGIN_TYPEHASH, keccak256(bytes(l.origin)), l.nonce, l.deviceId, l.issuedAt, l.expiresAt));
  }

  function domainSeparator(string memory name, string memory version, address verifyingContract) internal pure returns (bytes32) {
    return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), CHAIN_ID, verifyingContract));
  }
  function walletDomain(address wallet) internal pure returns (bytes32) { return domainSeparator("MandateWallet", "5", wallet); }
  function invoiceDomain(address wallet) internal pure returns (bytes32) { return domainSeparator("MandateInvoice", "2", wallet); }
  function deliveryDomain(address wallet) internal pure returns (bytes32) { return domainSeparator("MandateDelivery", "1", wallet); }
  function loginDomain() internal pure returns (bytes32) { return domainSeparator("MandateLogin", "2", address(0)); }

  function digest(bytes32 domain, bytes32 structHash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
  }
}
