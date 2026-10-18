// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateWallet} from "../MandateWallet.sol";
import {WalletPolicyLib} from "./WalletPolicyLib.sol";

interface IEIP3009 {
  function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}

/// @notice x402 `exact` authorizations paid through ERC-1271 (S9.10). Storage lives at a
/// fixed namespaced slot; runs by DELEGATECALL in the wallet's context. The wallet has
/// already applied every PAY check and charged the counters before `register`.
library X402Lib {
  uint256 internal constant MAX_OUTSTANDING = 8;
  bytes32 internal constant STORE_SLOT = keccak256("mandate.wallet.x402.v1");

  struct Auth {
    bytes32 digest;
    bytes32 permitId;
    bytes32 requestId;
    address asset;
    address recipient;
    uint256 amount;
    uint64 validBefore;
    uint64 epoch;
    bool ownerApproved;
  }

  struct Store {
    Auth[] list;
  }

  event X402Authorized(
    bytes32 indexed permitId, bytes32 indexed authorizationDigest, address payTo, uint256 amount, uint64 validBefore
  );

  error LimitExceeded(bytes32 limit);

  function store() internal pure returns (Store storage s) {
    bytes32 slot = STORE_SLOT;
    assembly {
      s.slot := slot
    }
  }

  function register(Auth memory auth) external {
    Store storage s = store();
    if (s.list.length >= MAX_OUTSTANDING) revert LimitExceeded("x402Outstanding");
    s.list.push(auth);
    emit X402Authorized(auth.permitId, auth.digest, auth.recipient, auth.amount, auth.validBefore);
  }

  /// Drops authorizations that expired, settled (EIP-3009 nonce used), or can never become
  /// valid again (old epoch, or Permit closed/revoked/expired). Policy-ineligible ones stay:
  /// a later policy can make them valid again, so they keep their reservation.
  function prune(address usdc, mapping(bytes32 => MandateWallet.PermitState) storage permits, uint64 epoch) external {
    Auth[] storage list = store().list;
    uint256 i = 0;
    while (i < list.length) {
      Auth storage auth = list[i];
      MandateWallet.PermitState storage st = permits[auth.permitId];
      bool permitLive = !st.closed && !st.revoked && block.timestamp < st.permit.expiresAt;
      if (_live(auth, usdc) && auth.epoch == epoch && permitLive) {
        i++;
      } else {
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
  }

  /// Sum of recorded amounts; equals committed outflow right after `prune`, without token calls.
  function committed(address asset) internal view returns (uint256 total) {
    Auth[] storage list = store().list;
    for (uint256 i = 0; i < list.length; i++) {
      if (list[i].asset == asset) total += list[i].amount;
    }
  }

  /// Committed, not yet settled outflow of `asset` at any time (view for clients).
  function outstanding(address asset, address usdc) internal view returns (uint256 total) {
    Auth[] storage list = store().list;
    for (uint256 i = 0; i < list.length; i++) {
      if (list[i].asset == asset && _live(list[i], usdc)) total += list[i].amount;
    }
  }

  struct WalletState {
    bool frozen;
    bool paused;
    uint64 epoch;
    address token;
    address usdc;
  }

  /// ERC-1271 approval of a recorded authorization under the *current* rules (S9.10).
  /// Day/week/period/spend counters are not re-checked: they were charged at registration.
  function isValid(
    bytes32 digest,
    bytes calldata signature,
    mapping(bytes32 => MandateWallet.PermitState) storage permits,
    WalletState memory w
  ) external view returns (bool) {
    if (w.frozen || w.paused || signature.length != 65 || signature[64] != 0x01) return false;
    Auth[] storage list = store().list;
    for (uint256 i = 0; i < list.length; i++) {
      Auth storage auth = list[i];
      if (auth.digest != digest) continue;
      if (bytes32(signature[:32]) != auth.requestId || bytes32(signature[32:64]) != auth.permitId) return false;
      if (block.timestamp >= auth.validBefore || auth.epoch != w.epoch) return false;
      MandateWallet.PermitState storage st = permits[auth.permitId];
      if (!st.activated || st.closed || st.revoked || block.timestamp >= st.permit.expiresAt) return false;
      return _policyAllows(auth, st.permit.reviewThreshold, w);
    }
    return false;
  }

  function _policyAllows(Auth storage auth, uint256 permitThreshold, WalletState memory w) private view returns (bool) {
    if (WalletPolicyLib.recipientViolation(auth.recipient) != bytes32(0)) return false;
    (WalletPolicyLib.Cap memory cap, bool ok) = WalletPolicyLib.capOf(auth.asset, w.token, w.usdc);
    if (!ok || auth.amount > cap.perTx) return false;
    return auth.amount <= WalletPolicyLib.reviewThreshold(permitThreshold) || auth.ownerApproved;
  }

  /// Unexpired and not reported settled. If the token's view call fails, the authorization is
  /// treated as still outstanding: it stays reserved, and unrelated payments are not blocked.
  function _live(Auth storage auth, address usdc) private view returns (bool) {
    if (block.timestamp >= auth.validBefore) return false;
    (bool ok, bytes memory data) =
      usdc.staticcall(abi.encodeCall(IEIP3009.authorizationState, (address(this), auth.requestId)));
    return !(ok && data.length >= 32 && abi.decode(data, (bool)));
  }
}
