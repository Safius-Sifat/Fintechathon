// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MandateTypes as T} from "../MandateTypes.sol";
import {MandateHashes as H} from "../MandateHashes.sol";
import {MandateWallet} from "../MandateWallet.sol";
import {PermitTermsLib} from "./PermitTermsLib.sol";
import {WalletPolicyLib} from "./WalletPolicyLib.sol";
import "./MandateLimits.sol";

/// @notice Permit activation (S3, S9.4), split out of MandateWallet for the EIP-170 size
/// limit. Runs by DELEGATECALL in the wallet's context against the wallet's Registry.
library ActivationLib {
  /// Wallet values the library needs (immutables are not readable from a library).
  struct Config {
    address owner;
    bytes32 walletDomain;
    address token;
    address usdc;
    address vault;
    uint64 epoch;
  }

  event PermitActivated(bytes32 indexed permitId, bytes32 indexed taskId, address executor, uint64 epoch);

  error InvalidSignature();
  error WrongEpoch();
  error WrongNonce();
  error NotYetValid();
  error LifetimeTooLong();
  error Expired();
  error ZeroAddress();
  error AssetNotSupported(address asset);
  error TaskAlreadyUsed();
  error PermitIsRevoked();
  error KindNotSupported(uint8 kind);
  error ScheduleInvalid(bytes32 field);
  error PolicyViolation(bytes32 rule);
  error TemplatesNotAllowed();

  function activate(
    MandateWallet.Registry storage r,
    T.Permit calldata p,
    address[] calldata recipients,
    T.Schedule calldata schedule,
    bytes32[] calldata templateIds,
    bytes calldata ownerSignature,
    Config memory cfg
  ) external returns (bytes32 permitId) {
    permitId = H.hash(p);
    _requireSigner(H.digest(cfg.walletDomain, permitId), ownerSignature, cfg.owner);
    if (p.epoch != cfg.epoch) revert WrongEpoch();
    if (p.nonce != r.permitNonce) revert WrongNonce();
    if (p.startsAt < p.issuedAt || p.expiresAt <= p.startsAt) revert NotYetValid();
    if (p.expiresAt - p.startsAt > (p.kind == T.KIND_ALLOWANCE ? MAX_ALLOWANCE_SECONDS : MAX_PERMIT_SECONDS)) {
      revert LifetimeTooLong();
    }
    if (block.timestamp >= p.expiresAt) revert Expired();
    if (p.executor == address(0)) revert ZeroAddress();
    WalletPolicyLib.Cap memory cap = _cap(p.asset, cfg);
    if (r.taskUsed[p.taskId]) revert TaskAlreadyUsed();
    if (r.revokedPermitId[permitId]) revert PermitIsRevoked();
    if (p.kind == T.KIND_BROWSER) {
      PermitTermsLib.validateBrowserTerms(p);
      PermitTermsLib.validateRecipients(p.recipientsHash, recipients, 1, 4);
      PermitTermsLib.requireZeroSchedule(p.scheduleHash, schedule);
    } else if (p.kind == T.KIND_LIQUIDITY) {
      if (cfg.vault == address(0)) revert KindNotSupported(p.kind);
      if (p.asset != cfg.token) revert AssetNotSupported(p.asset); // DemoVault underlying is DemoUSD
      PermitTermsLib.validateLiquidityTerms(p);
      PermitTermsLib.validateRecipients(p.recipientsHash, recipients, 0, 0);
      PermitTermsLib.requireZeroSchedule(p.scheduleHash, schedule);
    } else if (p.kind == T.KIND_SCHEDULE) {
      PermitTermsLib.validateScheduleTerms(p, schedule);
      PermitTermsLib.validateRecipients(p.recipientsHash, recipients, 1, 1);
      if (recipients[0] != schedule.recipient) revert ScheduleInvalid("recipient");
      r.schedules[permitId] = schedule;
    } else if (p.kind == T.KIND_ALLOWANCE) {
      PermitTermsLib.validateAllowanceTerms(p);
      PermitTermsLib.validateRecipients(p.recipientsHash, recipients, 1, 4);
      PermitTermsLib.requireZeroSchedule(p.scheduleHash, schedule);
    } else {
      revert KindNotSupported(p.kind);
    }

    // Most restrictive rule wins: the Permit must also fit the current WalletPolicy.
    if (p.maxPayment > cap.perTx) revert PolicyViolation("perTx");
    if (p.kind == T.KIND_ALLOWANCE && p.periodCap > (p.periodSeconds == 1 days ? cap.daily : cap.weekly)) {
      revert PolicyViolation("periodCap");
    }
    for (uint256 i = 0; i < recipients.length; i++) _requireRecipientPolicy(recipients[i]);
    _storeTemplates(r, permitId, p, templateIds);

    r.permitNonce = p.nonce + 1;
    r.taskUsed[p.taskId] = true;
    MandateWallet.PermitState storage st = r.permits[permitId];
    st.permit = p;
    st.activated = true;
    for (uint256 i = 0; i < recipients.length; i++) r.permitRecipient[permitId][recipients[i]] = true;
    emit PermitActivated(permitId, p.taskId, p.executor, p.epoch);
  }

  /// templatesHash = keccak256(abi.encode(bytes32[])) over sorted unique IDs, zero when none (S3).
  /// Only LIQUIDITY Permits may carry templates, and each must be in the current policy.
  function _storeTemplates(MandateWallet.Registry storage r, bytes32 permitId, T.Permit calldata p, bytes32[] calldata templateIds) private {
    if (templateIds.length == 0) {
      if (p.templatesHash != bytes32(0)) revert TemplatesNotAllowed();
      return;
    }
    if (p.kind != T.KIND_LIQUIDITY || templateIds.length > MAX_POLICY_TEMPLATES) revert TemplatesNotAllowed();
    if (keccak256(abi.encode(templateIds)) != p.templatesHash) revert TemplatesNotAllowed();
    WalletPolicyLib.Store storage s = WalletPolicyLib.store();
    for (uint256 i = 0; i < templateIds.length; i++) {
      if (i > 0 && templateIds[i - 1] >= templateIds[i]) revert TemplatesNotAllowed();
      if (!s.template[s.policy.version][templateIds[i]]) revert PolicyViolation("template");
      // One template per (target, selector), so a CALL resolves to exactly one definition.
      T.CallTemplate storage c = s.templateById[templateIds[i]];
      for (uint256 j = 0; j < i; j++) {
        T.CallTemplate storage prior = s.templateById[templateIds[j]];
        if (prior.target == c.target && prior.selector == c.selector) revert TemplatesNotAllowed();
      }
      r.permitTemplateIds[permitId].push(templateIds[i]);
    }
  }

  function _cap(address asset, Config memory cfg) private view returns (WalletPolicyLib.Cap memory cap) {
    bool ok;
    (cap, ok) = WalletPolicyLib.capOf(asset, cfg.token, cfg.usdc);
    if (!ok) revert AssetNotSupported(asset);
  }

  function _requireRecipientPolicy(address recipient) private view {
    bytes32 violation = WalletPolicyLib.recipientViolation(recipient);
    if (violation != bytes32(0)) revert PolicyViolation(violation);
  }

  function _requireSigner(bytes32 digest, bytes calldata signature, address expected) private pure {
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
    if (err != ECDSA.RecoverError.NoError || signer != expected) revert InvalidSignature();
  }
}
