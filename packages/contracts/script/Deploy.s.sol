// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {DemoUSD} from "../src/DemoUSD.sol";
import {DemoVault} from "../src/DemoVault.sol";
import {EvidenceAnchor} from "../src/EvidenceAnchor.sol";
import {WalletFactory} from "../src/WalletFactory.sol";

/// @notice P1-06 deployment of the fixed Base Sepolia contract set. The approved values come
/// from a committed config file; the script refuses to sign unless the chain and config match,
/// and reads every constructor value back after deployment. Each run deploys a fresh set: only
/// the run recorded in deployments/base-sepolia.json is the release. The signer is chosen on the
/// command line (`--account`); this script never reads a private key.
contract Deploy is Script {
  uint256 internal constant CHAIN_ID = 84_532;
  address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

  struct Config {
    uint256 chainId;
    address usdc;
    address anchorPublisher;
  }

  struct Deployment {
    DemoUSD token;
    DemoVault vault;
    EvidenceAnchor anchor;
    WalletFactory factory;
  }

  error WrongChain(uint256 chainId);
  error ConfigMismatch(bytes32 field);

  function run() external returns (Deployment memory d) {
    Config memory c = loadConfig(vm.envOr("DEPLOY_CONFIG", string("../../deployments/base-sepolia.config.json")));
    preflight(c);
    vm.startBroadcast();
    d = deploy(c);
    vm.stopBroadcast();
    verify(d, c);
  }

  function loadConfig(string memory path) public view returns (Config memory c) {
    string memory json = vm.readFile(path);
    c.chainId = vm.parseJsonUint(json, ".chainId");
    c.usdc = vm.parseJsonAddress(json, ".usdc");
    c.anchorPublisher = vm.parseJsonAddress(json, ".anchorPublisher");
  }

  /// Runs before anything is signed; there is no fallback chain.
  function preflight(Config memory c) public view {
    if (block.chainid != CHAIN_ID) revert WrongChain(block.chainid);
    if (c.chainId != CHAIN_ID) revert ConfigMismatch("chainId");
    if (c.usdc != BASE_SEPOLIA_USDC || c.usdc.code.length == 0) revert ConfigMismatch("usdc");
    if (c.anchorPublisher == address(0)) revert ConfigMismatch("anchorPublisher");
  }

  function deploy(Config memory c) public returns (Deployment memory d) {
    d.token = new DemoUSD();
    d.vault = new DemoVault(d.token);
    d.anchor = new EvidenceAnchor(c.anchorPublisher);
    d.factory = new WalletFactory(address(d.token), c.usdc, address(d.vault));
  }

  /// Reads the deployed configuration back; any difference from the approved config aborts.
  function verify(Deployment memory d, Config memory c) public view {
    if (d.vault.asset() != address(d.token)) revert ConfigMismatch("vault.asset");
    if (d.anchor.publisher() != c.anchorPublisher) revert ConfigMismatch("anchor.publisher");
    if (d.factory.token() != address(d.token)) revert ConfigMismatch("factory.token");
    if (d.factory.usdc() != c.usdc) revert ConfigMismatch("factory.usdc");
    if (d.factory.vault() != address(d.vault)) revert ConfigMismatch("factory.vault");
  }
}
