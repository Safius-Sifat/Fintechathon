// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MandateTypes as T} from "../MandateTypes.sol";
import {WalletPolicyLib} from "./WalletPolicyLib.sol";

/// @notice CALL operations through owner-approved call templates (S9.8). Runs by
/// DELEGATECALL in the wallet's context; the wallet has verified the signed Action and
/// consumed its request ID, and charges the returned outflow to its counters.
library CallTemplateLib {
  using SafeERC20 for IERC20;

  uint256 internal constant MAX_WORDS = 8;

  event CallExecuted(
    bytes32 indexed permitId,
    bytes32 indexed requestId,
    bytes32 indexed templateId,
    address asset,
    address target,
    bytes4 selector,
    uint256 assetOutflow
  );

  error TemplateDenied(bytes32 reason);

  struct Assets {
    address asset; // Permit.asset: the only agent asset allowed to decrease
    address other; // the other agent asset, or zero
  }

  function executeCall(
    T.Action calldata a,
    bytes calldata callData,
    bytes32[] storage permitTemplates,
    Assets memory assets
  ) external returns (uint256 outflow) {
    uint256 words = _words(callData);
    if (keccak256(callData) != a.inputHash) revert TemplateDenied("inputHash");
    (bytes32 templateId, T.CallTemplate memory c) = _resolve(permitTemplates, a.target, bytes4(callData[:4]));
    if (a.target.codehash != c.targetCodeHash) revert TemplateDenied("code");
    if (c.amountArg >= words) revert TemplateDenied("calldata");
    uint256 amount = _word(callData, c.amountArg);
    if (amount > c.maxAmount || amount > a.amount) revert TemplateDenied("amount");
    _checkRecipient(c, callData, words);

    IERC20 asset = IERC20(assets.asset);
    uint256 assetBefore = asset.balanceOf(address(this));
    uint256 otherBefore = assets.other == address(0) ? 0 : IERC20(assets.other).balanceOf(address(this));
    bool pulls = c.flags & T.FLAG_PULLS_ASSET != 0;
    if (pulls) asset.forceApprove(a.target, amount);
    (bool ok, bytes memory ret) = a.target.call(callData);
    if (!ok) {
      assembly {
        revert(add(ret, 0x20), mload(ret))
      }
    }
    if (pulls) asset.forceApprove(a.target, 0);
    if (asset.allowance(address(this), a.target) != 0) revert TemplateDenied("allowance");

    if (assets.other != address(0) && IERC20(assets.other).balanceOf(address(this)) < otherBefore) {
      revert TemplateDenied("otherAsset");
    }
    uint256 assetAfter = asset.balanceOf(address(this));
    outflow = assetAfter < assetBefore ? assetBefore - assetAfter : 0;
    if (outflow > a.amount) revert TemplateDenied("outflow");
    emit CallExecuted(a.permitId, a.requestId, templateId, assets.asset, a.target, c.selector, outflow);
  }

  /// Selector plus at most eight whole 32-byte words.
  function _words(bytes calldata callData) private pure returns (uint256 words) {
    if (callData.length < 4 || (callData.length - 4) % 32 != 0) revert TemplateDenied("calldata");
    words = (callData.length - 4) / 32;
    if (words > MAX_WORDS) revert TemplateDenied("calldata");
  }

  function _word(bytes calldata callData, uint256 index) private pure returns (uint256) {
    return uint256(bytes32(callData[4 + 32 * index:36 + 32 * index]));
  }

  /// The Permit's template for (target, selector); activation guarantees at most one.
  function _resolve(bytes32[] storage ids, address target, bytes4 selector)
    private
    view
    returns (bytes32 templateId, T.CallTemplate memory c)
  {
    WalletPolicyLib.Store storage s = WalletPolicyLib.store();
    for (uint256 i = 0; i < ids.length; i++) {
      T.CallTemplate storage candidate = s.templateById[ids[i]];
      if (candidate.target == target && candidate.selector == selector) {
        if (!s.template[s.policy.version][ids[i]]) revert TemplateDenied("policy");
        return (ids[i], candidate);
      }
    }
    revert TemplateDenied("template");
  }

  function _checkRecipient(T.CallTemplate memory c, bytes calldata callData, uint256 words) private view {
    if (c.recipientRule == T.RECIPIENT_NONE) return;
    if (c.recipientArg >= words) revert TemplateDenied("calldata");
    uint256 w = _word(callData, c.recipientArg);
    if (w >> 160 != 0) revert TemplateDenied("recipient");
    address recipient = address(uint160(w));
    if (c.recipientRule == T.RECIPIENT_WALLET) {
      if (recipient != address(this)) revert TemplateDenied("recipient");
    } else if (WalletPolicyLib.recipientViolation(recipient) != bytes32(0)) {
      // An ALLOWLIST-rule template is only accepted with a non-empty allowlist (S9.8).
      revert TemplateDenied("recipient");
    }
  }
}
