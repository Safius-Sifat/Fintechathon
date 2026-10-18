// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MandateTypes as T} from "./MandateTypes.sol";
import {MandateHashes as H} from "./MandateHashes.sol";
import {PermitTermsLib} from "./lib/PermitTermsLib.sol";
import {AssetsLib} from "./lib/AssetsLib.sol";
import {WalletPolicyLib} from "./lib/WalletPolicyLib.sol";
import {VaultLib} from "./lib/VaultLib.sol";
import {CallTemplateLib} from "./lib/CallTemplateLib.sol";
import {X402Lib} from "./lib/X402Lib.sol";
import {ActivationLib} from "./lib/ActivationLib.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./lib/MandateLimits.sol";

/// @notice Managed agent wallet (architecture S3, S8.3). The immutable owner signs
/// Permits and owner commands; a per-wallet executor signs Actions inside a Permit.
/// Relayers only pay gas: no sender has any privilege.
///
/// Implemented: BROWSER (PAY, CLOSE), LIQUIDITY (DEPOSIT, WITHDRAW on the immutable
/// vault), SCHEDULE (TRANSFER), owner co-signature above the Permit review threshold,
/// Admin (PAUSE, UNPAUSE, REVOKE, RECOVER, RECOVER_LIQUID), OwnerTransfer and native ETH
/// receive, the owner WalletPolicy (S9.4), FREEZE/UNFREEZE, ALLOWANCE Permits and a second
/// agent asset (Base Sepolia test USDC), CALL through call templates and x402 payments
/// approved by ERC-1271 (S9.8, S9.10).
contract MandateWallet is ReentrancyGuard {
  using SafeERC20 for IERC20;


  struct PermitState {
    T.Permit permit;
    bool activated;
    bool closed;
    bool revoked;
    uint256 grossSpend;
    uint32 paymentCount;
    uint32 actionCount;
    uint256 depositedAssets;
    uint256 withdrawnAssets;
  }

  struct Budget {
    uint256 day;
    uint256 week;
    uint256 walletGross;
    uint256 walletWeekGross;
    uint256 executorGross;
    uint256 liquidAssets;
    uint256 vaultShares;
    uint256 vaultAssets;
  }

  address public immutable owner;
  address public immutable token;
  address public immutable usdc; // second agent asset; zero disables it
  address public immutable vault;
  address public immutable factory;
  bytes32 private immutable WALLET_DOMAIN;
  bytes32 private immutable INVOICE_DOMAIN;

  uint256 public adminNonce;

  /// Permit registry, passed to ActivationLib as one storage reference.
  struct Registry {
    uint256 permitNonce;
    mapping(bytes32 => PermitState) permits;
    mapping(bytes32 => mapping(address => bool)) permitRecipient;
    mapping(bytes32 => bool) taskUsed;
    mapping(bytes32 => bool) revokedPermitId;
    mapping(bytes32 => T.Schedule) schedules;
    mapping(bytes32 => bytes32[]) permitTemplateIds;
  }

  Registry private reg;
  uint256 public ownerTransferNonce;
  uint64 public authorityEpoch;
  bool public paused;
  bool public frozen;
  mapping(bytes32 => mapping(uint256 => uint256)) private periodSpend;

  mapping(bytes32 => bool) public usedRequest;
  mapping(bytes32 => bool) public usedInvoice;
  mapping(bytes32 => bool) public usedOwnerTransfer;
  mapping(bytes32 => mapping(uint32 => bool)) public periodUsed;
  // asset => day/week index => gross outflow; never decreased by refunds.
  mapping(address => mapping(uint256 => uint256)) private walletDayGross;
  mapping(address => mapping(uint256 => uint256)) private walletWeekGross;
  mapping(address => mapping(address => mapping(uint256 => uint256))) private executorDayGross;

  event PermitActivated(bytes32 indexed permitId, bytes32 indexed taskId, address executor, uint64 epoch);
  event PermitClosed(bytes32 indexed permitId);
  event PermitRevoked(bytes32 indexed permitId);
  event WalletPolicyUpdated(uint64 version, bytes32 policyDigest); // emitted by WalletPolicyLib
  event WalletFrozen(bool frozen);
  // Emitted by CallTemplateLib and X402Lib in the wallet's context.
  event CallExecuted(
    bytes32 indexed permitId,
    bytes32 indexed requestId,
    bytes32 indexed templateId,
    address asset,
    address target,
    bytes4 selector,
    uint256 assetOutflow
  );
  event X402Authorized(
    bytes32 indexed permitId, bytes32 indexed authorizationDigest, address payTo, uint256 amount, uint64 validBefore
  );
  event Recovered(uint256 liquidAssets, uint256 redeemedShares, uint256 redeemedAssets, bool vaultFailed);
  event WalletPaused(bool paused, uint64 epoch);
  event ActionExecuted(
    bytes32 indexed permitId,
    bytes32 indexed requestId,
    uint8 operation,
    address asset,
    address target,
    uint256 assets,
    uint256 shares,
    bytes32 invoiceId,
    bytes32 inputHash,
    bytes32 actionDigest,
    bool ownerApproved
  );
  event OwnerTransferExecuted(
    bytes32 indexed transferId,
    address indexed asset,
    address indexed recipient,
    uint256 amount,
    uint64 newEpoch,
    bytes32 transferDigest
  );

  error WrongChain();
  error ZeroAddress();
  error InvalidSignature();
  error WrongEpoch();
  error WrongNonce();
  error WalletIsPaused();
  error Expired();
  error NotYetValid();
  error LifetimeTooLong();
  error KindNotSupported(uint8 kind);
  error OperationNotSupported(uint8 operation);
  error OperationNotAllowed(uint8 kind, uint8 operation);
  error AssetNotSupported(address asset);
  error TaskAlreadyUsed();
  error PermitNotActive();
  error RecipientsInvalid();
  error RecipientDenied(address recipient);
  error ScheduleNotZero();
  error TemplatesNotAllowed();
  error TemplateDenied(bytes32 reason);
  error FieldNotZero(bytes32 field);
  error LimitExceeded(bytes32 limit);
  error RequestAlreadyUsed();
  error InvoiceAlreadyUsed();
  error InvoiceMismatch(bytes32 field);
  error ApprovalRequired();
  error ApprovalInvalid();
  error TransferAlreadyUsed();
  error InvalidRecipient();
  error InvalidAmount();
  error InvalidAsset();
  error InexactTokenTransfer();
  error NativeTransferFailed();
  error InvalidTarget();
  error ScheduleWindow();
  error PeriodAlreadyUsed();
  error ScheduleMismatch();
  error ScheduleInvalid(bytes32 field);
  error PermitIsRevoked();
  error CommandNotSupported(uint8 command);
  error WalletIsFrozen();
  error PolicyViolation(bytes32 rule);
  error PolicyInvalid(bytes32 field);

  constructor(address owner_, address token_, address usdc_, address vault_) {
    if (block.chainid != CHAIN_ID) revert WrongChain();
    if (owner_ == address(0) || token_ == address(0)) revert ZeroAddress();
    owner = owner_;
    token = token_;
    usdc = usdc_;
    vault = vault_;
    factory = msg.sender;
    WALLET_DOMAIN = H.walletDomain(address(this));
    INVOICE_DOMAIN = H.invoiceDomain(address(this));

    WalletPolicyLib.initDefault(token_);
  }

  /// Native ETH is owner-controlled only; no delegated Action can spend it.
  receive() external payable {}

  // ---------------------------------------------------------------- Permits

  function activatePermit(
    T.Permit calldata p,
    address[] calldata recipients,
    T.Schedule calldata schedule,
    bytes32[] calldata templateIds,
    bytes calldata ownerSignature
  ) external returns (bytes32) {
    if (paused) revert WalletIsPaused();
    return ActivationLib.activate(
      reg, p, recipients, schedule, templateIds, ownerSignature,
      ActivationLib.Config(owner, WALLET_DOMAIN, token, usdc, vault, authorityEpoch)
    );
  }

  function permitNonce() external view returns (uint256) {
    return reg.permitNonce;
  }

  function taskUsed(bytes32 taskId) external view returns (bool) {
    return reg.taskUsed[taskId];
  }

  function revokedPermitId(bytes32 permitId) external view returns (bool) {
    return reg.revokedPermitId[permitId];
  }

  // ---------------------------------------------------------------- Actions

  function execute(
    T.Action calldata a,
    bytes calldata executorSignature,
    T.Invoice calldata invoice,
    bytes calldata providerSignature,
    T.Approval calldata approval,
    bytes calldata ownerApproval,
    bytes calldata callData
  ) external nonReentrant {
    if (paused) revert WalletIsPaused();
    if (frozen) revert WalletIsFrozen();
    if (X402Lib.store().list.length != 0) X402Lib.prune(usdc, reg.permits, authorityEpoch);
    PermitState storage st = reg.permits[a.permitId];
    T.Permit storage p = st.permit;
    if (!st.activated || st.closed || st.revoked) revert PermitNotActive();
    if (p.epoch != authorityEpoch) revert WrongEpoch();
    if (block.timestamp < p.startsAt || block.timestamp > a.deadline) revert NotYetValid();
    if (block.timestamp >= p.expiresAt) revert Expired();
    if (block.timestamp < a.issuedAt) revert NotYetValid();

    bytes32 actionDigest = H.digest(WALLET_DOMAIN, H.hash(a));
    _requireSigner(actionDigest, executorSignature, p.executor);
    if (usedRequest[a.requestId]) revert RequestAlreadyUsed();
    if (callData.length != 0 && a.operation != T.OP_CALL) revert OperationNotSupported(a.operation);

    if (a.operation == T.OP_CLOSE) {
      _close(st, a, actionDigest, invoice, providerSignature, approval, ownerApproval);
    } else if (a.operation == T.OP_PAY) {
      if (p.kind != T.KIND_BROWSER && p.kind != T.KIND_ALLOWANCE) revert OperationNotAllowed(p.kind, a.operation);
      _pay(st, a, actionDigest, invoice, providerSignature, approval, ownerApproval);
    } else if (a.operation == T.OP_TRANSFER) {
      if (p.kind != T.KIND_SCHEDULE) revert OperationNotAllowed(p.kind, a.operation);
      _requireZeroInvoice(invoice, providerSignature);
      _scheduledTransfer(st, a, actionDigest, approval, ownerApproval);
    } else if (a.operation == T.OP_DEPOSIT || a.operation == T.OP_WITHDRAW) {
      if (p.kind != T.KIND_LIQUIDITY) revert OperationNotAllowed(p.kind, a.operation);
      _requireZeroInvoice(invoice, providerSignature);
      _requireNoApproval(approval, ownerApproval);
      if (a.deadline - a.issuedAt > MAX_ACTION_SECONDS) revert LifetimeTooLong();
      _requireVaultAction(st, a);
      if (a.operation == T.OP_DEPOSIT) VaultLib.deposit(st, a, actionDigest, vault);
      else VaultLib.withdraw(st, a, actionDigest, vault);
    } else if (a.operation == T.OP_CALL) {
      if (p.kind != T.KIND_LIQUIDITY) revert OperationNotAllowed(p.kind, a.operation);
      _requireZeroInvoice(invoice, providerSignature);
      _call(st, a, actionDigest, approval, ownerApproval, callData);
    } else if (a.operation == T.OP_X402) {
      if (p.kind != T.KIND_BROWSER && p.kind != T.KIND_ALLOWANCE) revert OperationNotAllowed(p.kind, a.operation);
      if (usdc == address(0) || p.asset != usdc) revert AssetNotSupported(p.asset);
      _pay(st, a, actionDigest, invoice, providerSignature, approval, ownerApproval);
    } else {
      revert OperationNotSupported(a.operation);
    }
  }

  function _close(
    PermitState storage st,
    T.Action calldata a,
    bytes32 actionDigest,
    T.Invoice calldata invoice,
    bytes calldata providerSignature,
    T.Approval calldata approval,
    bytes calldata ownerApproval
  ) private {
    // CLOSE is zero-value and exempt from financial quotas; every unused field is zero.
    if (a.target != address(0) || a.amount != 0 || a.minOutput != 0 || a.invoiceId != bytes32(0)
      || a.inputHash != bytes32(0) || a.period != 0) revert FieldNotZero("close");
    _requireZeroInvoice(invoice, providerSignature);
    _requireNoApproval(approval, ownerApproval);
    if (a.deadline - a.issuedAt > MAX_ACTION_SECONDS) revert LifetimeTooLong();
    usedRequest[a.requestId] = true;
    st.closed = true;
    emit PermitClosed(a.permitId);
    emit ActionExecuted(a.permitId, a.requestId, a.operation, st.permit.asset, address(0), 0, 0, bytes32(0), bytes32(0), actionDigest, false);
  }

  function _pay(
    PermitState storage st,
    T.Action calldata a,
    bytes32 actionDigest,
    T.Invoice calldata invoice,
    bytes calldata providerSignature,
    T.Approval calldata approval,
    bytes calldata ownerApproval
  ) private {
    T.Permit storage p = st.permit;
    if (a.minOutput != 0) revert FieldNotZero("minOutput");
    if (a.period != 0) revert FieldNotZero("period");
    if (a.amount == 0) revert InvalidAmount();
    if (!reg.permitRecipient[a.permitId][a.target]) revert RecipientDenied(a.target);
    _requireRecipientPolicy(a.target);

    bool approved = a.amount > _reviewThreshold(p);
    if (approved) {
      _requireApproval(actionDigest, a.deadline, approval, ownerApproval);
    } else {
      _requireNoApproval(approval, ownerApproval);
    }
    uint64 maxLife = approved ? MAX_COSIGNED_SECONDS : MAX_ACTION_SECONDS;
    if (a.deadline - a.issuedAt > maxLife) revert LifetimeTooLong();
    _checkInvoice(p, a, invoice, providerSignature, maxLife);
    _consumeSpend(a.permitId, st, a.amount, true);
    _requireFloor(p, a.amount);

    usedRequest[a.requestId] = true;
    usedInvoice[a.invoiceId] = true;
    if (a.operation == T.OP_X402) {
      // Settled later by USDC transferWithAuthorization through isValidSignature (S9.10).
      bytes32 digest = H.x402Digest(IERC20Permit(usdc).DOMAIN_SEPARATOR(), address(this), a);
      X402Lib.register(
        X402Lib.Auth(digest, a.permitId, a.requestId, p.asset, a.target, a.amount, a.deadline, authorityEpoch, approved)
      );
    } else {
      IERC20(p.asset).safeTransfer(a.target, a.amount);
    }
    // X402 moves nothing here: settlement is the later USDC Transfer, so assets is 0.
    uint256 moved = a.operation == T.OP_X402 ? 0 : a.amount;
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, a.target, moved, 0, a.invoiceId, a.inputHash, actionDigest, approved);
  }

  function _checkInvoice(
    T.Permit storage p,
    T.Action calldata a,
    T.Invoice calldata invoice,
    bytes calldata providerSignature,
    uint64 maxLife
  ) private view {
    if (invoice.invoiceId != a.invoiceId) revert InvoiceMismatch("invoiceId");
    if (invoice.taskId != p.taskId) revert InvoiceMismatch("taskId");
    if (invoice.wallet != address(this)) revert InvoiceMismatch("wallet");
    if (invoice.asset != p.asset) revert InvoiceMismatch("asset");
    if (invoice.recipient != a.target) revert InvoiceMismatch("recipient");
    if (invoice.amount != a.amount) revert InvoiceMismatch("amount");
    if (invoice.inputHash != a.inputHash) revert InvoiceMismatch("inputHash");
    if (invoice.expiresAt <= invoice.issuedAt || invoice.expiresAt - invoice.issuedAt > maxLife) revert InvoiceMismatch("lifetime");
    if (block.timestamp < invoice.issuedAt || block.timestamp > invoice.expiresAt) revert Expired();
    if (usedInvoice[invoice.invoiceId]) revert InvoiceAlreadyUsed();
    // Provider signer is the provider recipient (S6).
    _requireSigner(H.digest(INVOICE_DOMAIN, H.hash(invoice)), providerSignature, invoice.recipient);
  }

  function _consumeSpend(bytes32 permitId, PermitState storage st, uint256 amount, bool isPayment) private {
    T.Permit storage p = st.permit;
    WalletPolicyLib.Cap memory cap = _cap(p.asset);
    if (isPayment && amount > p.maxPayment) revert LimitExceeded("maxPayment");
    if (amount > cap.perTx) revert PolicyViolation("perTx");
    if (isPayment) {
      if (st.paymentCount + 1 > p.maxPayments) revert LimitExceeded("maxPayments");
      st.paymentCount += 1;
    }
    if (st.actionCount + 1 > p.maxActions) revert LimitExceeded("maxActions");
    st.actionCount += 1;
    if (st.grossSpend + amount > p.spendCap) revert LimitExceeded("spendCap");
    st.grossSpend += amount;
    if (p.kind == T.KIND_ALLOWANCE) {
      uint256 period = (block.timestamp - p.startsAt) / p.periodSeconds;
      uint256 spent = periodSpend[permitId][period] + amount;
      if (spent > p.periodCap) revert LimitExceeded("periodCap");
      periodSpend[permitId][period] = spent;
    }

    uint256 day = block.timestamp / 1 days;
    uint256 week = block.timestamp / 1 weeks;
    uint256 execDay = executorDayGross[p.asset][p.executor][day] + amount;
    if (execDay > MAX_EXECUTOR_DAY) revert LimitExceeded("executorDay");
    uint256 walletDay = walletDayGross[p.asset][day] + amount;
    if (walletDay > MAX_WALLET_DAY) revert LimitExceeded("walletDay");
    if (walletDay > cap.daily) revert PolicyViolation("daily");
    uint256 walletWeek = walletWeekGross[p.asset][week] + amount;
    if (walletWeek > MAX_WALLET_WEEK) revert LimitExceeded("walletWeek");
    if (walletWeek > cap.weekly) revert PolicyViolation("weekly");
    executorDayGross[p.asset][p.executor][day] = execDay;
    walletDayGross[p.asset][day] = walletDay;
    walletWeekGross[p.asset][week] = walletWeek;
  }

  /// Liquid funds after `pending` outflow and outstanding x402 authorizations stay at or above the floor.
  function _requireFloor(T.Permit storage p, uint256 pending) private view {
    uint256 committed = pending + (p.asset == usdc ? X402Lib.committed(usdc) : 0); // pruned at execute start
    uint256 liquid = IERC20(p.asset).balanceOf(address(this));
    if (liquid < committed || liquid - committed < p.liquidFloor) revert LimitExceeded("liquidFloor");
  }

  /// CALL through an owner-approved template (S9.8); the measured outflow is charged afterwards.
  function _call(
    PermitState storage st,
    T.Action calldata a,
    bytes32 actionDigest,
    T.Approval calldata approval,
    bytes calldata ownerApproval,
    bytes calldata callData
  ) private {
    if (a.minOutput != 0 || a.invoiceId != bytes32(0) || a.period != 0) revert FieldNotZero("call");
    bool approved = a.amount > _reviewThreshold(st.permit);
    if (approved) _requireApproval(actionDigest, a.deadline, approval, ownerApproval);
    else _requireNoApproval(approval, ownerApproval);
    if (a.deadline - a.issuedAt > (approved ? MAX_COSIGNED_SECONDS : MAX_ACTION_SECONDS)) revert LifetimeTooLong();
    usedRequest[a.requestId] = true;
    address asset = st.permit.asset;
    uint256 outflow = CallTemplateLib.executeCall(
      a, callData, reg.permitTemplateIds[a.permitId], CallTemplateLib.Assets(asset, asset == token ? usdc : token)
    );
    _consumeSpend(a.permitId, st, outflow, false);
    _requireFloor(st.permit, 0);
    emit ActionExecuted(a.permitId, a.requestId, a.operation, asset, a.target, outflow, 0, bytes32(0), a.inputHash, actionDigest, approved);
  }

  function _requireApproval(bytes32 actionDigest, uint64 deadline, T.Approval calldata approval, bytes calldata ownerApproval)
    private
    view
  {
    if (ownerApproval.length == 0) revert ApprovalRequired();
    if (approval.actionDigest != actionDigest) revert ApprovalInvalid();
    if (approval.expiresAt > deadline || block.timestamp > approval.expiresAt) revert ApprovalInvalid();
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(H.digest(WALLET_DOMAIN, H.hash(approval)), ownerApproval);
    if (err != ECDSA.RecoverError.NoError || signer != owner) revert ApprovalInvalid();
  }

  function _requireNoApproval(T.Approval calldata approval, bytes calldata ownerApproval) private pure {
    if (ownerApproval.length != 0 || approval.actionDigest != bytes32(0) || approval.expiresAt != 0) revert FieldNotZero("approval");
  }

  function _requireZeroInvoice(T.Invoice calldata i, bytes calldata providerSignature) private pure {
    if (providerSignature.length != 0 || i.invoiceId != bytes32(0) || i.taskId != bytes32(0) || i.wallet != address(0)
      || i.asset != address(0) || i.recipient != address(0) || i.amount != 0 || i.inputHash != bytes32(0)
      || i.issuedAt != 0 || i.expiresAt != 0) revert FieldNotZero("invoice");
  }

  function _scheduledTransfer(
    PermitState storage st,
    T.Action calldata a,
    bytes32 actionDigest,
    T.Approval calldata approval,
    bytes calldata ownerApproval
  ) private {
    T.Schedule storage s = reg.schedules[a.permitId];
    if (a.minOutput != 0 || a.invoiceId != bytes32(0) || a.inputHash != bytes32(0)) revert FieldNotZero("transfer");
    if (a.target != s.recipient || a.amount != s.amount) revert ScheduleMismatch();
    if (a.period >= s.periods) revert ScheduleWindow();
    // The current time must fall inside this period's window; missed windows never catch up.
    uint256 opens = uint256(s.start) + uint256(a.period) * uint256(s.interval);
    if (block.timestamp < opens || block.timestamp >= opens + s.window) revert ScheduleWindow();
    if (periodUsed[a.permitId][a.period]) revert PeriodAlreadyUsed();
    _requireRecipientPolicy(a.target);

    bool approved = a.amount > _reviewThreshold(st.permit);
    if (approved) _requireApproval(actionDigest, a.deadline, approval, ownerApproval);
    else _requireNoApproval(approval, ownerApproval);
    if (a.deadline - a.issuedAt > (approved ? MAX_COSIGNED_SECONDS : MAX_ACTION_SECONDS)) revert LifetimeTooLong();
    _consumeSpend(a.permitId, st, a.amount, true);
    _requireFloor(st.permit, a.amount);

    usedRequest[a.requestId] = true;
    periodUsed[a.permitId][a.period] = true;
    IERC20(st.permit.asset).safeTransfer(a.target, a.amount);
    emit ActionExecuted(a.permitId, a.requestId, a.operation, st.permit.asset, a.target, a.amount, 0, bytes32(0), bytes32(0), actionDigest, approved);
  }

  function _requireVaultAction(PermitState storage st, T.Action calldata a) private {
    if (a.target != vault) revert InvalidTarget();
    if (a.amount == 0 || a.minOutput == 0) revert InvalidAmount();
    if (a.period != 0 || a.invoiceId != bytes32(0)) revert FieldNotZero("vault");
    if (st.actionCount + 1 > st.permit.maxActions) revert LimitExceeded("maxActions");
    st.actionCount += 1;
    usedRequest[a.requestId] = true;
  }

  // ------------------------------------------------------------------ Admin

  /// Owner governance (S3). No MPC or backend consent; any sender may relay.
  function applyAdmin(T.Admin calldata a, bytes calldata ownerSignature) external nonReentrant {
    _requireSigner(H.digest(WALLET_DOMAIN, H.hash(a)), ownerSignature, owner);
    if (a.nonce != adminNonce) revert WrongNonce();
    if (a.deadline <= a.issuedAt || a.deadline - a.issuedAt > MAX_ADMIN_SECONDS) revert LifetimeTooLong();
    if (block.timestamp < a.issuedAt) revert NotYetValid();
    if (block.timestamp > a.deadline) revert Expired();
    if (a.command > T.CMD_UNFREEZE) revert CommandNotSupported(a.command);
    if (a.command != T.CMD_REVOKE && a.permitId != bytes32(0)) revert FieldNotZero("permitId");
    adminNonce = a.nonce + 1;

    if (a.command == T.CMD_FREEZE || a.command == T.CMD_UNFREEZE) {
      frozen = a.command == T.CMD_FREEZE; // keeps Permits, counters and epoch
      emit WalletFrozen(frozen);
    } else if (a.command == T.CMD_UNPAUSE) {
      paused = false; // never moves the epoch back; old Permits stay invalid
      emit WalletPaused(false, authorityEpoch);
    } else if (a.command == T.CMD_REVOKE) {
      reg.revokedPermitId[a.permitId] = true;
      if (reg.permits[a.permitId].activated) reg.permits[a.permitId].revoked = true;
      emit PermitRevoked(a.permitId);
    } else {
      paused = true;
      uint64 newEpoch = authorityEpoch + 1;
      authorityEpoch = newEpoch;
      emit WalletPaused(true, newEpoch);
      if (a.command == T.CMD_RECOVER) AssetsLib.recover(token, vault, owner, true);
      else if (a.command == T.CMD_RECOVER_LIQUID) AssetsLib.recover(token, vault, owner, false);
    }
  }

  // ----------------------------------------------------------------- Policy

  /// Owner-signed WalletPolicy (S9.4). Works while paused or frozen; needs no MPC or backend.
  function applyWalletPolicy(
    T.WalletPolicy calldata p,
    T.AssetCap[] calldata caps,
    address[] calldata allowlist,
    address[] calldata blocklist,
    T.CallTemplate[] calldata templates,
    bytes calldata ownerSignature
  ) external nonReentrant {
    WalletPolicyLib.applyPolicy(
      p, caps, allowlist, blocklist, templates, ownerSignature, WalletPolicyLib.Config(owner, WALLET_DOMAIN, token, usdc, factory)
    );
  }

  function policyNonce() external view returns (uint256) {
    return WalletPolicyLib.store().nonce;
  }

  function _cap(address asset) private view returns (WalletPolicyLib.Cap memory cap) {
    bool ok;
    (cap, ok) = WalletPolicyLib.capOf(asset, token, usdc);
    if (!ok) revert AssetNotSupported(asset);
  }

  function _requireRecipientPolicy(address recipient) private view {
    bytes32 violation = WalletPolicyLib.recipientViolation(recipient);
    if (violation != bytes32(0)) revert PolicyViolation(violation);
  }

  function _reviewThreshold(T.Permit storage p) private view returns (uint256) {
    return WalletPolicyLib.reviewThreshold(p.reviewThreshold);
  }

  // ---------------------------------------------------------- Owner transfer

  /// Owner-only liquid transfer (S8.3). Bypasses delegated caps/floor by design and,
  /// on success, pauses the wallet and increments the epoch so every prior Permit stops.
  function applyOwnerTransfer(T.OwnerTransfer calldata t, bytes calldata ownerSignature) external nonReentrant {
    bytes32 transferDigest = H.digest(WALLET_DOMAIN, H.hash(t));
    _requireSigner(transferDigest, ownerSignature, owner);
    if (t.epoch != authorityEpoch) revert WrongEpoch();
    if (t.nonce != ownerTransferNonce) revert WrongNonce();
    if (usedOwnerTransfer[t.transferId]) revert TransferAlreadyUsed();
    if (t.deadline <= t.issuedAt || t.deadline - t.issuedAt > MAX_OWNER_TRANSFER_SECONDS) revert LifetimeTooLong();
    if (block.timestamp < t.issuedAt) revert NotYetValid();
    if (block.timestamp > t.deadline) revert Expired();
    if (t.amount == 0) revert InvalidAmount();
    if (t.recipient == address(0) || t.recipient == address(this)) revert InvalidRecipient();
    if (t.asset != address(0) && (t.asset == vault || t.asset == address(this) || t.asset.code.length == 0)) {
      revert InvalidAsset();
    }

    // Effects before interaction; a revert below rolls all of these back.
    ownerTransferNonce = t.nonce + 1;
    usedOwnerTransfer[t.transferId] = true;
    uint64 newEpoch = authorityEpoch + 1;
    authorityEpoch = newEpoch;
    paused = true;

    AssetsLib.moveExact(t.asset, t.recipient, t.amount);
    emit WalletPaused(true, newEpoch);
    emit OwnerTransferExecuted(t.transferId, t.asset, t.recipient, t.amount, newEpoch, transferDigest);
  }

  // ------------------------------------------------------------------ Views

  function getPermit(bytes32 permitId) external view returns (PermitState memory) {
    return reg.permits[permitId];
  }

  function isPermitRecipient(bytes32 permitId, address recipient) external view returns (bool) {
    return reg.permitRecipient[permitId][recipient];
  }

  function getBudget(address executor, address asset) external view returns (Budget memory b) {
    b.day = block.timestamp / 1 days;
    b.week = block.timestamp / 1 weeks;
    b.walletGross = walletDayGross[asset][b.day];
    b.walletWeekGross = walletWeekGross[asset][b.week];
    b.executorGross = executorDayGross[asset][executor][b.day];
    b.liquidAssets = IERC20(asset).balanceOf(address(this));
    if (vault != address(0)) {
      b.vaultShares = IERC20(vault).balanceOf(address(this));
      b.vaultAssets = IERC4626(vault).convertToAssets(b.vaultShares);
    }
  }

  function walletPolicy() external view returns (T.WalletPolicy memory) {
    return WalletPolicyLib.store().policy;
  }

  function assetCap(address asset) external view returns (uint256 perTx, uint256 daily, uint256 weekly, bool set) {
    (WalletPolicyLib.Cap memory c, bool ok) = WalletPolicyLib.capOf(asset, token, usdc);
    return (c.perTx, c.daily, c.weekly, ok);
  }

  function isAllowlisted(address recipient) external view returns (bool) {
    WalletPolicyLib.Store storage s = WalletPolicyLib.store();
    return s.allow[s.policy.version][recipient];
  }

  function isBlocklisted(address recipient) external view returns (bool) {
    WalletPolicyLib.Store storage s = WalletPolicyLib.store();
    return s.blocked[s.policy.version][recipient];
  }

  function isPolicyTemplate(bytes32 templateId) external view returns (bool) {
    WalletPolicyLib.Store storage s = WalletPolicyLib.store();
    return s.template[s.policy.version][templateId];
  }

  function getTemplate(bytes32 templateId) external view returns (T.CallTemplate memory) {
    return WalletPolicyLib.store().templateById[templateId];
  }

  /// ERC-1271: approves only a recorded, still-eligible x402 authorization (S9.10).
  function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
    if (usdc == address(0)) return 0xffffffff;
    bool ok = X402Lib.isValid(hash, signature, reg.permits, X402Lib.WalletState(frozen, paused, authorityEpoch, token, usdc));
    return ok ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
  }

  function x402Outstanding(address asset) external view returns (uint256) {
    return usdc == address(0) ? 0 : X402Lib.outstanding(asset, usdc);
  }

  function getPermitTemplates(bytes32 permitId) external view returns (bytes32[] memory) {
    return reg.permitTemplateIds[permitId];
  }

  function getPeriodSpend(bytes32 permitId, uint64 periodIndex) external view returns (uint256) {
    return periodSpend[permitId][periodIndex];
  }

  function domainSeparator() external view returns (bytes32) {
    return WALLET_DOMAIN;
  }

  // ---------------------------------------------------------------- Helpers

  /// OZ ECDSA rejects malformed and high-S signatures; every failure maps to one stable error.
  function _requireSigner(bytes32 digest, bytes calldata signature, address expected) private pure {
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
    if (err != ECDSA.RecoverError.NoError || signer != expected) revert InvalidSignature();
  }
}
