// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";

/// P1-01.T01: Solidity recomputes the TypeScript golden vectors in packages/schema/fixtures.
contract MandateHashesTest is Test {
  function _load(string memory file) internal view returns (string memory) {
    return vm.readFile(string.concat(vm.projectRoot(), "/../schema/fixtures/", file));
  }

  function _check(string memory json, string memory key, bytes32 structHash, bytes32 domain) internal pure {
    assertEq(structHash, vm.parseJsonBytes32(json, string.concat(key, ".structHash")), "structHash");
    assertEq(domain, vm.parseJsonBytes32(json, string.concat(key, ".domainSeparator")), "domainSeparator");
    bytes32 d = H.digest(domain, structHash);
    assertEq(d, vm.parseJsonBytes32(json, string.concat(key, ".digest")), "digest");
    bytes memory sig = vm.parseJsonBytes(json, string.concat(key, ".signature"));
    (bytes32 r, bytes32 s) = abi.decode(sig, (bytes32, bytes32));
    uint8 v = uint8(sig[64]);
    assertEq(ecrecover(d, v, r, s), vm.parseJsonAddress(json, string.concat(key, ".signer")), "signer");
  }

  function _wallet(string memory json, string memory key) internal pure returns (address) {
    return vm.parseJsonAddress(json, string.concat(key, ".domain.verifyingContract"));
  }

  function _abi(string memory json, string memory key) internal pure returns (bytes memory) {
    return vm.parseJsonBytes(json, string.concat(key, ".abiEncoded"));
  }

  function test_P1_01_T01_permit() public view {
    string memory json = _load("permit-v7.json");
    for (uint256 i = 0; i < 2; i++) {
      string memory key = string.concat(".valid[", vm.toString(i), "]");
      T.Permit memory p = abi.decode(_abi(json, key), (T.Permit));
      _check(json, key, H.hash(p), H.walletDomain(_wallet(json, key)));
    }
  }

  function test_P1_01_T01_action() public view {
    string memory json = _load("action-v7.json");
    for (uint256 i = 0; i < 2; i++) {
      string memory key = string.concat(".valid[", vm.toString(i), "]");
      T.Action memory a = abi.decode(_abi(json, key), (T.Action));
      _check(json, key, H.hash(a), H.walletDomain(_wallet(json, key)));
    }
  }

  function test_P1_01_T01_admin() public view {
    string memory json = _load("admin-v7.json");
    for (uint256 i = 0; i < 2; i++) {
      string memory key = string.concat(".valid[", vm.toString(i), "]");
      T.Admin memory a = abi.decode(_abi(json, key), (T.Admin));
      _check(json, key, H.hash(a), H.walletDomain(_wallet(json, key)));
    }
  }

  function test_P1_W01_T01_ownerTransfer() public view {
    string memory json = _load("owner-transfer-v7.json");
    for (uint256 i = 0; i < 2; i++) {
      string memory key = string.concat(".valid[", vm.toString(i), "]");
      T.OwnerTransfer memory t = abi.decode(_abi(json, key), (T.OwnerTransfer));
      _check(json, key, H.hash(t), H.walletDomain(_wallet(json, key)));
      // The same fields under the bootstrap domain 4 give a different digest.
      bytes32 old = H.digest(H.domainSeparator("MandateWallet", "4", _wallet(json, key)), H.hash(t));
      assertTrue(old != vm.parseJsonBytes32(json, string.concat(key, ".digest")), "domain4 must differ");
    }
  }

  function test_P1_A01_T01_approval() public view {
    string memory json = _load("approval-v7.json");
    T.Approval memory a = abi.decode(_abi(json, ".valid[0]"), (T.Approval));
    _check(json, ".valid[0]", H.hash(a), H.walletDomain(_wallet(json, ".valid[0]")));
  }

  function test_P1_A01_T01_walletPolicy() public view {
    string memory json = _load("wallet-policy-v7.json");
    T.WalletPolicy memory p = abi.decode(_abi(json, ".valid[0]"), (T.WalletPolicy));
    _check(json, ".valid[0]", H.hash(p), H.walletDomain(_wallet(json, ".valid[0]")));
  }

  function test_P1_A01_T01_invoice() public view {
    string memory json = _load("invoice-v7.json");
    T.Invoice memory i = abi.decode(_abi(json, ".valid[0]"), (T.Invoice));
    _check(json, ".valid[0]", H.hash(i), H.invoiceDomain(_wallet(json, ".valid[0]")));
  }

  function test_P1_01_T01_delivery() public view {
    string memory json = _load("delivery-v7.json");
    T.DeliveryReceipt memory d = abi.decode(_abi(json, ".valid[0]"), (T.DeliveryReceipt));
    _check(json, ".valid[0]", H.hash(d), H.deliveryDomain(_wallet(json, ".valid[0]")));
  }

  function test_P1_W01_T02_login() public view {
    string memory json = _load("login-v7.json");
    T.Login memory l = abi.decode(_abi(json, ".valid[0]"), (T.Login));
    _check(json, ".valid[0]", H.hash(l), H.loginDomain());
  }
}
