// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract DeployTest is Test {
  Deploy internal script;
  address internal constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
  address internal publisher = makeAddr("anchor-publisher");

  function setUp() public {
    vm.chainId(84_532);
    script = new Deploy();
    vm.etch(USDC, address(new MockUSDC()).code); // local stand-in at the canonical address
  }

  function _config() internal view returns (Deploy.Config memory) {
    return Deploy.Config({chainId: 84_532, usdc: USDC, anchorPublisher: publisher});
  }

  function test_P1_06_T01_wrongChainAbortsBeforeDeploy() public {
    uint256[2] memory chains = [uint256(1), 11_155_111];
    for (uint256 i; i < chains.length; ++i) {
      vm.chainId(chains[i]);
      vm.expectRevert(abi.encodeWithSelector(Deploy.WrongChain.selector, chains[i]));
      script.preflight(_config());
    }
  }

  function test_P1_06_T02_configMismatchAbortsBeforeDeploy() public {
    Deploy.Config memory c = _config();
    c.chainId = 1;
    vm.expectRevert(abi.encodeWithSelector(Deploy.ConfigMismatch.selector, bytes32("chainId")));
    script.preflight(c);

    c = _config();
    c.usdc = makeAddr("not-usdc");
    vm.expectRevert(abi.encodeWithSelector(Deploy.ConfigMismatch.selector, bytes32("usdc")));
    script.preflight(c);

    c = _config();
    c.anchorPublisher = address(0);
    vm.expectRevert(abi.encodeWithSelector(Deploy.ConfigMismatch.selector, bytes32("anchorPublisher")));
    script.preflight(c);
  }

  function test_P1_06_T02_committedConfigIsTheApprovedOne() public {
    Deploy.Config memory c = script.loadConfig("../../deployments/base-sepolia.config.json");
    assertEq(c.chainId, 84_532);
    assertEq(c.usdc, USDC);
    assertEq(c.anchorPublisher, 0x5cCEfD0Ac77088d72d38047856f4045E5ae56a95); // Person2 worker
    script.preflight(c);
  }

  function test_P1_06_T02_readbackRejectsDifferentWiring() public {
    Deploy.Deployment memory d = script.deploy(_config());
    d.factory = new WalletFactory(address(d.token), makeAddr("other-usdc"), address(d.vault));
    vm.expectRevert(abi.encodeWithSelector(Deploy.ConfigMismatch.selector, bytes32("factory.usdc")));
    script.verify(d, _config());
  }

  function test_P1_06_dryRunDeploysAndWiresContracts() public {
    script.preflight(_config());
    Deploy.Deployment memory d = script.deploy(_config());
    script.verify(d, _config());
    assertEq(d.anchor.publisher(), publisher);
    MandateWallet w = MandateWallet(payable(d.factory.createWallet(makeAddr("owner"))));
    assertEq(w.token(), address(d.token));
    assertEq(w.usdc(), USDC);
    assertEq(w.vault(), address(d.vault));
  }
}
