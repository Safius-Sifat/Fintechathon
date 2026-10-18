// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MandateTypes as T} from "./MandateTypes.sol";
import {MandateHashes as H} from "./MandateHashes.sol";

/// @notice Managed agent wallet (architecture S3, S8.3). The immutable owner signs
/// Permits and owner commands; a per-wallet executor signs Actions inside a Permit.
/// Relayers only pay gas: no sender has any privilege.
///
/// Implemented: BROWSER (PAY, CLOSE), LIQUIDITY (DEPOSIT, WITHDRAW on the immutable
/// vault), SCHEDULE (TRANSFER), owner co-signature above the Permit review threshold,
/// Admin (PAUSE, UNPAUSE, REVOKE, RECOVER, RECOVER_LIQUID), OwnerTransfer and native ETH
/// receive. ALLOWANCE, CALL, X402, FREEZE/UNFREEZE and non-DemoUSD agent assets revert
/// explicitly until P1-A02/P1-A03 land.
contract MandateWallet is ReentrancyGuard {
  using SafeERC20 for IERC20;

  uint256 public constant CHAIN_ID = 84532;
  uint256 public constant MAX_PAYMENT = 500_000;
  uint256 public constant MAX_TASK_SPEND = 2_000_000;
  uint256 public constant MAX_EXECUTOR_DAY = 5_000_000;
  uint256 public constant MAX_WALLET_DAY = 10_000_000;
  uint256 public constant MAX_WALLET_WEEK = 25_000_000;
  uint256 public constant MIN_LIQUID_FLOOR = 3_000_000;
  uint32 public constant MAX_ACTIONS = 20;
  uint32 public constant MAX_BROWSER_PAYMENTS = 3;
  uint64 public constant MAX_PERMIT_SECONDS = 1 days;
  uint64 public constant MAX_ACTION_SECONDS = 60;
  uint64 public constant MAX_COSIGNED_SECONDS = 15 minutes;
  uint64 public constant MAX_OWNER_TRANSFER_SECONDS = 10 minutes;
  uint64 public constant MAX_ADMIN_SECONDS = 30 minutes;
  uint256 public constant MAX_ALLOCATION_BPS = 2_000;
  /// Gas forwarded to the vault during RECOVER. A misbehaving vault cannot block recovery.
  uint256 public constant RECOVER_VIEW_GAS = 50_000;
  uint256 public constant RECOVER_REDEEM_GAS = 300_000;

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
  address public immutable vault;
  bytes32 private immutable WALLET_DOMAIN;
  bytes32 private immutable INVOICE_DOMAIN;

  uint256 public permitNonce;
  uint256 public adminNonce;
  uint256 public ownerTransferNonce;
  uint64 public authorityEpoch;
  bool public paused;

  mapping(bytes32 => PermitState) private permits;
  mapping(bytes32 => mapping(address => bool)) private permitRecipient;
  mapping(bytes32 => bool) public taskUsed;
  mapping(bytes32 => bool) public usedRequest;
  mapping(bytes32 => bool) public usedInvoice;
  mapping(bytes32 => bool) public usedOwnerTransfer;
  mapping(bytes32 => bool) public revokedPermitId;
  mapping(bytes32 => T.Schedule) private schedules;
  mapping(bytes32 => mapping(uint32 => bool)) public periodUsed;
  // asset => day/week index => gross outflow; never decreased by refunds.
  mapping(address => mapping(uint256 => uint256)) private walletDayGross;
  mapping(address => mapping(uint256 => uint256)) private walletWeekGross;
  mapping(address => mapping(address => mapping(uint256 => uint256))) private executorDayGross;

  event PermitActivated(bytes32 indexed permitId, bytes32 indexed taskId, address executor, uint64 epoch);
  event PermitClosed(bytes32 indexed permitId);
  event PermitRevoked(bytes32 indexed permitId);
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
  error FieldNotZero(string field);
  error LimitExceeded(string limit);
  error RequestAlreadyUsed();
  error InvoiceAlreadyUsed();
  error InvoiceMismatch(string field);
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
  error ScheduleInvalid(string field);
  error PermitIsRevoked();
  error CommandNotSupported(uint8 command);

  constructor(address owner_, address token_, address vault_) {
    if (block.chainid != CHAIN_ID) revert WrongChain();
    if (owner_ == address(0) || token_ == address(0)) revert ZeroAddress();
    owner = owner_;
    token = token_;
    vault = vault_;
    WALLET_DOMAIN = H.walletDomain(address(this));
    INVOICE_DOMAIN = H.invoiceDomain(address(this));
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
  ) external returns (bytes32 permitId) {
    if (paused) revert WalletIsPaused();
    permitId = H.hash(p);
    _requireSigner(H.digest(WALLET_DOMAIN, permitId), ownerSignature, owner);
    if (p.epoch != authorityEpoch) revert WrongEpoch();
    if (p.nonce != permitNonce) revert WrongNonce();
    if (p.startsAt < p.issuedAt || p.expiresAt <= p.startsAt) revert NotYetValid();
    if (p.expiresAt - p.startsAt > MAX_PERMIT_SECONDS) revert LifetimeTooLong();
    if (block.timestamp >= p.expiresAt) revert Expired();
    if (p.executor == address(0)) revert ZeroAddress();
    if (p.asset != token) revert AssetNotSupported(p.asset);
    if (taskUsed[p.taskId]) revert TaskAlreadyUsed();
    if (revokedPermitId[permitId]) revert PermitIsRevoked();
    if (p.kind == T.KIND_BROWSER) {
      _validateBrowserTerms(p);
      _validateRecipients(p.recipientsHash, recipients, 1, 4);
      _requireZeroSchedule(p.scheduleHash, schedule);
    } else if (p.kind == T.KIND_LIQUIDITY) {
      if (vault == address(0)) revert KindNotSupported(p.kind);
      _validateLiquidityTerms(p);
      _validateRecipients(p.recipientsHash, recipients, 0, 0);
      _requireZeroSchedule(p.scheduleHash, schedule);
    } else if (p.kind == T.KIND_SCHEDULE) {
      _validateScheduleTerms(p, schedule);
      _validateRecipients(p.recipientsHash, recipients, 1, 1);
      if (recipients[0] != schedule.recipient) revert ScheduleInvalid("recipient");
      schedules[permitId] = schedule;
    } else {
      revert KindNotSupported(p.kind);
    }
    if (templateIds.length != 0 || p.templatesHash != bytes32(0)) revert TemplatesNotAllowed();

    permitNonce = p.nonce + 1;
    taskUsed[p.taskId] = true;
    PermitState storage st = permits[permitId];
    st.permit = p;
    st.activated = true;
    for (uint256 i = 0; i < recipients.length; i++) permitRecipient[permitId][recipients[i]] = true;
    emit PermitActivated(permitId, p.taskId, p.executor, p.epoch);
  }

  function _validateBrowserTerms(T.Permit calldata p) private pure {
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

  function _validateLiquidityTerms(T.Permit calldata p) private pure {
    if (p.maxActions == 0 || p.maxActions > MAX_ACTIONS) revert LimitExceeded("maxActions");
    if (p.maxPayments != 0) revert FieldNotZero("maxPayments");
    if (p.maxPayment != 0) revert FieldNotZero("maxPayment");
    if (p.spendCap != 0) revert FieldNotZero("spendCap");
    if (p.liquidFloor < MIN_LIQUID_FLOOR) revert LimitExceeded("liquidFloor");
    if (p.periodCap != 0) revert FieldNotZero("periodCap");
    if (p.periodSeconds != 0) revert FieldNotZero("periodSeconds");
  }

  function _validateScheduleTerms(T.Permit calldata p, T.Schedule calldata s) private pure {
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

  function _requireZeroSchedule(bytes32 scheduleHash, T.Schedule calldata s) private pure {
    if (H.hashSchedule(s) != scheduleHash || s.recipient != address(0) || s.amount != 0 || s.start != 0
      || s.interval != 0 || s.window != 0 || s.periods != 0) revert ScheduleNotZero();
  }

  /// recipientsHash = keccak256(abi.encode(address[])) over strictly ascending nonzero addresses.
  function _validateRecipients(bytes32 recipientsHash, address[] calldata recipients, uint256 minLen, uint256 maxLen)
    private
    pure
  {
    if (recipients.length < minLen || recipients.length > maxLen) revert RecipientsInvalid();
    for (uint256 i = 0; i < recipients.length; i++) {
      if (recipients[i] == address(0)) revert RecipientsInvalid();
      if (i > 0 && recipients[i - 1] >= recipients[i]) revert RecipientsInvalid();
    }
    if (keccak256(abi.encode(recipients)) != recipientsHash) revert RecipientsInvalid();
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
    PermitState storage st = permits[a.permitId];
    T.Permit storage p = st.permit;
    if (!st.activated || st.closed || st.revoked) revert PermitNotActive();
    if (p.epoch != authorityEpoch) revert WrongEpoch();
    if (block.timestamp < p.startsAt || block.timestamp > a.deadline) revert NotYetValid();
    if (block.timestamp >= p.expiresAt) revert Expired();
    if (block.timestamp < a.issuedAt) revert NotYetValid();

    bytes32 actionDigest = H.digest(WALLET_DOMAIN, H.hash(a));
    _requireSigner(actionDigest, executorSignature, p.executor);
    if (usedRequest[a.requestId]) revert RequestAlreadyUsed();
    if (callData.length != 0) revert OperationNotSupported(a.operation);

    if (a.operation == T.OP_CLOSE) {
      _close(st, a, actionDigest, invoice, providerSignature, approval, ownerApproval);
    } else if (a.operation == T.OP_PAY) {
      if (p.kind != T.KIND_BROWSER) revert OperationNotAllowed(p.kind, a.operation);
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
      if (a.operation == T.OP_DEPOSIT) _deposit(st, a, actionDigest);
      else _withdraw(st, a, actionDigest);
    } else if (a.operation == T.OP_CALL) {
      // CALL and X402 land with P1-A03.
      if (p.kind != T.KIND_LIQUIDITY) revert OperationNotAllowed(p.kind, a.operation);
      revert OperationNotSupported(a.operation);
    } else if (a.operation == T.OP_X402) {
      if (p.kind != T.KIND_BROWSER) revert OperationNotAllowed(p.kind, a.operation);
      revert OperationNotSupported(a.operation);
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
    if (!permitRecipient[a.permitId][a.target]) revert RecipientDenied(a.target);

    bool approved = a.amount > p.reviewThreshold;
    if (approved) {
      _requireApproval(actionDigest, a.deadline, approval, ownerApproval);
    } else {
      _requireNoApproval(approval, ownerApproval);
    }
    uint64 maxLife = approved ? MAX_COSIGNED_SECONDS : MAX_ACTION_SECONDS;
    if (a.deadline - a.issuedAt > maxLife) revert LifetimeTooLong();
    _checkInvoice(p, a, invoice, providerSignature, maxLife);
    _consumeSpend(st, a.amount, true);

    usedRequest[a.requestId] = true;
    usedInvoice[a.invoiceId] = true;
    IERC20(p.asset).safeTransfer(a.target, a.amount);
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, a.target, a.amount, 0, a.invoiceId, a.inputHash, actionDigest, approved);
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

  function _consumeSpend(PermitState storage st, uint256 amount, bool isPayment) private {
    T.Permit storage p = st.permit;
    if (isPayment) {
      if (amount > p.maxPayment) revert LimitExceeded("maxPayment");
      if (st.paymentCount + 1 > p.maxPayments) revert LimitExceeded("maxPayments");
      st.paymentCount += 1;
    }
    if (st.actionCount + 1 > p.maxActions) revert LimitExceeded("maxActions");
    st.actionCount += 1;
    if (st.grossSpend + amount > p.spendCap) revert LimitExceeded("spendCap");
    st.grossSpend += amount;

    uint256 day = block.timestamp / 1 days;
    uint256 week = block.timestamp / 1 weeks;
    uint256 execDay = executorDayGross[p.asset][p.executor][day] + amount;
    if (execDay > MAX_EXECUTOR_DAY) revert LimitExceeded("executorDay");
    uint256 walletDay = walletDayGross[p.asset][day] + amount;
    if (walletDay > MAX_WALLET_DAY) revert LimitExceeded("walletDay");
    uint256 walletWeek = walletWeekGross[p.asset][week] + amount;
    if (walletWeek > MAX_WALLET_WEEK) revert LimitExceeded("walletWeek");
    executorDayGross[p.asset][p.executor][day] = execDay;
    walletDayGross[p.asset][day] = walletDay;
    walletWeekGross[p.asset][week] = walletWeek;

    uint256 liquid = IERC20(p.asset).balanceOf(address(this));
    if (liquid < amount || liquid - amount < p.liquidFloor) revert LimitExceeded("liquidFloor");
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
    T.Schedule storage s = schedules[a.permitId];
    if (a.minOutput != 0 || a.invoiceId != bytes32(0) || a.inputHash != bytes32(0)) revert FieldNotZero("transfer");
    if (a.target != s.recipient || a.amount != s.amount) revert ScheduleMismatch();
    if (a.period >= s.periods) revert ScheduleWindow();
    // The current time must fall inside this period's window; missed windows never catch up.
    uint256 opens = uint256(s.start) + uint256(a.period) * uint256(s.interval);
    if (block.timestamp < opens || block.timestamp >= opens + s.window) revert ScheduleWindow();
    if (periodUsed[a.permitId][a.period]) revert PeriodAlreadyUsed();

    bool approved = a.amount > st.permit.reviewThreshold;
    if (approved) _requireApproval(actionDigest, a.deadline, approval, ownerApproval);
    else _requireNoApproval(approval, ownerApproval);
    if (a.deadline - a.issuedAt > (approved ? MAX_COSIGNED_SECONDS : MAX_ACTION_SECONDS)) revert LifetimeTooLong();
    _consumeSpend(st, a.amount, true);

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

  /// DEPOSIT: Action.amount is assets, minOutput is minimum shares (S3).
  function _deposit(PermitState storage st, T.Action calldata a, bytes32 actionDigest) private {
    _requireVaultAction(st, a);
    T.Permit storage p = st.permit;
    if (st.depositedAssets + a.amount > p.depositCap) revert LimitExceeded("depositCap");
    st.depositedAssets += a.amount;
    IERC20 asset = IERC20(p.asset);
    IERC4626 v = IERC4626(vault);
    uint256 liquidBefore = asset.balanceOf(address(this));
    if (liquidBefore < a.amount || liquidBefore - a.amount < p.liquidFloor) revert LimitExceeded("liquidFloor");
    uint256 sharesBefore = IERC20(vault).balanceOf(address(this));

    asset.forceApprove(vault, a.amount);
    v.deposit(a.amount, address(this));
    asset.forceApprove(vault, 0);

    uint256 liquidAfter = asset.balanceOf(address(this));
    uint256 sharesReceived = IERC20(vault).balanceOf(address(this)) - sharesBefore;
    if (liquidBefore - liquidAfter != a.amount) revert InexactTokenTransfer();
    if (sharesReceived < a.minOutput) revert LimitExceeded("minOutput");
    uint256 vaultAssets = v.convertToAssets(IERC20(vault).balanceOf(address(this)));
    if (vaultAssets * 10_000 > MAX_ALLOCATION_BPS * (liquidAfter + vaultAssets)) revert LimitExceeded("allocation");
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, vault, a.amount, sharesReceived, bytes32(0), a.inputHash, actionDigest, false);
  }

  /// WITHDRAW: Action.amount is shares, minOutput is minimum assets; assets return only to the wallet.
  function _withdraw(PermitState storage st, T.Action calldata a, bytes32 actionDigest) private {
    _requireVaultAction(st, a);
    T.Permit storage p = st.permit;
    IERC20 asset = IERC20(p.asset);
    if (a.amount > IERC20(vault).balanceOf(address(this))) revert LimitExceeded("shares");
    uint256 liquidBefore = asset.balanceOf(address(this));

    uint256 reported = IERC4626(vault).redeem(a.amount, address(this), address(this));

    uint256 received = asset.balanceOf(address(this)) - liquidBefore;
    if (received != reported) revert InexactTokenTransfer();
    if (received < a.minOutput) revert LimitExceeded("minOutput");
    if (st.withdrawnAssets + received > p.withdrawCap) revert LimitExceeded("withdrawCap");
    st.withdrawnAssets += received; // incoming assets never replenish gross spend
    emit ActionExecuted(a.permitId, a.requestId, a.operation, p.asset, vault, received, a.amount, bytes32(0), a.inputHash, actionDigest, false);
  }

  // ------------------------------------------------------------------ Admin

  /// Owner governance (S3). No MPC or backend consent; any sender may relay.
  function applyAdmin(T.Admin calldata a, bytes calldata ownerSignature) external nonReentrant {
    _requireSigner(H.digest(WALLET_DOMAIN, H.hash(a)), ownerSignature, owner);
    if (a.nonce != adminNonce) revert WrongNonce();
    if (a.deadline <= a.issuedAt || a.deadline - a.issuedAt > MAX_ADMIN_SECONDS) revert LifetimeTooLong();
    if (block.timestamp < a.issuedAt) revert NotYetValid();
    if (block.timestamp > a.deadline) revert Expired();
    if (a.command > T.CMD_RECOVER_LIQUID) revert CommandNotSupported(a.command); // FREEZE/UNFREEZE: P1-A02
    if (a.command != T.CMD_REVOKE && a.permitId != bytes32(0)) revert FieldNotZero("permitId");
    adminNonce = a.nonce + 1;

    if (a.command == T.CMD_UNPAUSE) {
      paused = false; // never moves the epoch back; old Permits stay invalid
      emit WalletPaused(false, authorityEpoch);
    } else if (a.command == T.CMD_REVOKE) {
      revokedPermitId[a.permitId] = true;
      if (permits[a.permitId].activated) permits[a.permitId].revoked = true;
      emit PermitRevoked(a.permitId);
    } else {
      paused = true;
      uint64 newEpoch = authorityEpoch + 1;
      authorityEpoch = newEpoch;
      emit WalletPaused(true, newEpoch);
      if (a.command == T.CMD_RECOVER) _recover(true);
      else if (a.command == T.CMD_RECOVER_LIQUID) _recover(false);
    }
  }

  /// Sends core DemoUSD to the immutable owner. RECOVER first tries to redeem vault shares
  /// to the owner with bounded gas; any vault failure is reported, never blocks liquid recovery.
  function _recover(bool withVault) private {
    uint256 redeemedShares;
    uint256 redeemedAssets;
    bool vaultFailed;
    IERC20 asset = IERC20(token);
    if (withVault && vault != address(0)) {
      (bool okMax, bytes memory maxData) =
        vault.staticcall{gas: RECOVER_VIEW_GAS}(abi.encodeCall(IERC4626.maxRedeem, (address(this))));
      (bool okBal, bytes memory balData) =
        vault.staticcall{gas: RECOVER_VIEW_GAS}(abi.encodeCall(IERC20.balanceOf, (address(this))));
      uint256 shares = okMax && maxData.length >= 32 ? abi.decode(maxData, (uint256)) : 0;
      uint256 held = okBal && balData.length >= 32 ? abi.decode(balData, (uint256)) : 0;
      if (shares > held) shares = held;
      if (shares > 0) {
        uint256 ownerBefore = asset.balanceOf(owner);
        (bool okRedeem,) =
          vault.call{gas: RECOVER_REDEEM_GAS}(abi.encodeCall(IERC4626.redeem, (shares, owner, address(this))));
        if (okRedeem) {
          redeemedShares = shares;
          redeemedAssets = asset.balanceOf(owner) - ownerBefore;
        } else {
          vaultFailed = true;
        }
      } else if (!okMax || !okBal || held > 0) {
        vaultFailed = true; // position exists (or is unreadable) but cannot be redeemed now
      }
    }
    uint256 liquid = asset.balanceOf(address(this));
    if (liquid > 0) asset.safeTransfer(owner, liquid);
    emit Recovered(liquid, redeemedShares, redeemedAssets, vaultFailed);
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

    if (t.asset == address(0)) {
      (bool ok,) = t.recipient.call{value: t.amount}("");
      if (!ok) revert NativeTransferFailed();
    } else {
      IERC20 asset = IERC20(t.asset);
      uint256 walletBefore = asset.balanceOf(address(this));
      uint256 recipientBefore = asset.balanceOf(t.recipient);
      asset.safeTransfer(t.recipient, t.amount);
      if (walletBefore - asset.balanceOf(address(this)) != t.amount || asset.balanceOf(t.recipient) - recipientBefore != t.amount) {
        revert InexactTokenTransfer();
      }
    }
    emit WalletPaused(true, newEpoch);
    emit OwnerTransferExecuted(t.transferId, t.asset, t.recipient, t.amount, newEpoch, transferDigest);
  }

  // ------------------------------------------------------------------ Views

  function getPermit(bytes32 permitId) external view returns (PermitState memory) {
    return permits[permitId];
  }

  function isPermitRecipient(bytes32 permitId, address recipient) external view returns (bool) {
    return permitRecipient[permitId][recipient];
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
