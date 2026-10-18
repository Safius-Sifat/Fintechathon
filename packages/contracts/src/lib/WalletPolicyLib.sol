// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MandateTypes as T} from "../MandateTypes.sol";
import {MandateHashes as H} from "../MandateHashes.sol";
import "./MandateLimits.sol";

/// @notice Owner WalletPolicy (S9.4): storage at a fixed namespaced slot plus the apply logic,
/// split out of MandateWallet for the EIP-170 size limit. Runs by DELEGATECALL in the
/// wallet's context. Lists are keyed by policy version, so a new policy replaces them atomically.
library WalletPolicyLib {
  struct Cap {
    uint256 perTx;
    uint256 daily;
    uint256 weekly;
    bool set;
  }

  struct Store {
    T.WalletPolicy policy;
    uint256 nonce;
    mapping(uint64 => mapping(address => Cap)) cap;
    mapping(uint64 => mapping(address => bool)) allow;
    mapping(uint64 => uint256) allowCount;
    mapping(uint64 => mapping(address => bool)) blocked;
    mapping(uint64 => mapping(bytes32 => bool)) template;
    mapping(bytes32 => T.CallTemplate) templateById;
  }

  /// Wallet values the library needs (immutables are not readable from a library).
  struct Config {
    address owner;
    bytes32 walletDomain;
    address token;
    address usdc;
    address factory;
  }

  bytes32 internal constant STORE_SLOT = keccak256("mandate.wallet.policy.v1");

  event WalletPolicyUpdated(uint64 version, bytes32 policyDigest);

  error InvalidSignature();
  error WrongNonce();
  error LifetimeTooLong();
  error NotYetValid();
  error Expired();
  error PolicyInvalid(bytes32 field);

  function store() internal pure returns (Store storage s) {
    bytes32 slot = STORE_SLOT;
    assembly {
      s.slot := slot
    }
  }

  /// Default policy (S9.4): DemoUSD at the S2 ceilings only, empty lists, no review threshold.
  function initDefault(address token) internal {
    Store storage s = store();
    T.AssetCap[] memory caps = new T.AssetCap[](1);
    caps[0] = T.AssetCap(token, MAX_PAYMENT, MAX_WALLET_DAY, MAX_WALLET_WEEK);
    s.cap[0][token] = Cap(MAX_PAYMENT, MAX_WALLET_DAY, MAX_WALLET_WEEK, true);
    address[] memory none;
    T.CallTemplate[] memory noTemplates;
    s.policy = T.WalletPolicy(
      0, keccak256(abi.encode(caps)), keccak256(abi.encode(none)), keccak256(abi.encode(none)),
      keccak256(abi.encode(noTemplates)), type(uint256).max, 0, 0, 0
    );
  }

  function applyPolicy(
    T.WalletPolicy calldata p,
    T.AssetCap[] calldata caps,
    address[] calldata allowlist,
    address[] calldata blocklist,
    T.CallTemplate[] calldata templates,
    bytes calldata ownerSignature,
    Config memory cfg
  ) external {
    Store storage s = store();
    bytes32 policyDigest = H.digest(cfg.walletDomain, H.hash(p));
    _requireSigner(policyDigest, ownerSignature, cfg.owner);
    if (p.nonce != s.nonce) revert WrongNonce();
    if (p.version <= s.policy.version) revert PolicyInvalid("version");
    if (p.deadline <= p.issuedAt || p.deadline - p.issuedAt > MAX_ADMIN_SECONDS) revert LifetimeTooLong();
    if (block.timestamp < p.issuedAt) revert NotYetValid();
    if (block.timestamp > p.deadline) revert Expired();
    if (caps.length == 0 || caps.length > MAX_POLICY_LIST || allowlist.length > MAX_POLICY_LIST
      || blocklist.length > MAX_POLICY_LIST || templates.length > MAX_POLICY_TEMPLATES) revert PolicyInvalid("size");
    if (keccak256(abi.encode(caps)) != p.assetCapsHash) revert PolicyInvalid("assetCapsHash");
    if (keccak256(abi.encode(allowlist)) != p.allowlistHash) revert PolicyInvalid("allowlistHash");
    if (keccak256(abi.encode(blocklist)) != p.blocklistHash) revert PolicyInvalid("blocklistHash");
    if (keccak256(abi.encode(templates)) != p.templatesHash) revert PolicyInvalid("templatesHash");

    uint64 v = p.version;
    for (uint256 i = 0; i < caps.length; i++) {
      T.AssetCap calldata c = caps[i];
      if (i > 0 && caps[i - 1].asset >= c.asset) revert PolicyInvalid("assetOrder");
      if (!_isAgentAsset(c.asset, cfg)) revert PolicyInvalid("asset");
      if (c.perTx > MAX_PAYMENT || c.daily > MAX_WALLET_DAY || c.weekly > MAX_WALLET_WEEK) revert PolicyInvalid("ceiling");
      if (c.perTx > c.daily || c.daily > c.weekly) revert PolicyInvalid("capOrder");
      s.cap[v][c.asset] = Cap(c.perTx, c.daily, c.weekly, true);
    }
    for (uint256 i = 0; i < allowlist.length; i++) {
      if (allowlist[i] == address(0) || (i > 0 && allowlist[i - 1] >= allowlist[i])) revert PolicyInvalid("allowlist");
      s.allow[v][allowlist[i]] = true;
    }
    s.allowCount[v] = allowlist.length;
    for (uint256 i = 0; i < blocklist.length; i++) {
      if (blocklist[i] == address(0) || (i > 0 && blocklist[i - 1] >= blocklist[i])) revert PolicyInvalid("blocklist");
      s.blocked[v][blocklist[i]] = true;
    }
    for (uint256 i = 0; i < templates.length; i++) {
      T.CallTemplate calldata c = templates[i];
      if (i > 0 && templates[i - 1].templateId >= c.templateId) revert PolicyInvalid("templateOrder");
      _validateTemplate(c, allowlist.length, cfg);
      s.template[v][c.templateId] = true;
      s.templateById[c.templateId] = c;
    }
    s.nonce = p.nonce + 1;
    s.policy = p;
    emit WalletPolicyUpdated(v, policyDigest);
  }

  function _validateTemplate(T.CallTemplate calldata c, uint256 allowlistLength, Config memory cfg) private view {
    if (H.callTemplateId(c) != c.templateId) revert PolicyInvalid("templateId");
    if (c.target == address(0) || _isAgentAsset(c.target, cfg) || c.target == address(this) || c.target == cfg.factory) {
      revert PolicyInvalid("target");
    }
    bytes4 s = c.selector;
    // approve, increaseAllowance, permit, transferFrom, setApprovalForAll, transfer, transferAndCall
    if (s == 0x095ea7b3 || s == 0x39509351 || s == 0xd505accf || s == 0x23b872dd || s == 0xa22cb465
      || s == 0xa9059cbb || s == 0x4000aea0) revert PolicyInvalid("selector");
    if (c.recipientRule > T.RECIPIENT_ALLOWLIST || c.flags > T.FLAG_PULLS_ASSET || c.amountArg > 7 || c.recipientArg > 7) {
      revert PolicyInvalid("template");
    }
    if (c.recipientRule == T.RECIPIENT_ALLOWLIST && allowlistLength == 0) revert PolicyInvalid("recipientRule");
  }

  function _isAgentAsset(address asset, Config memory cfg) private pure returns (bool) {
    return asset == cfg.token || (cfg.usdc != address(0) && asset == cfg.usdc);
  }

  function _requireSigner(bytes32 digest, bytes calldata signature, address expected) private pure {
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
    if (err != ECDSA.RecoverError.NoError || signer != expected) revert InvalidSignature();
  }
}
