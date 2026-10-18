// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "../support/MandateFixture.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";
import {WalletFactory} from "../../src/WalletFactory.sol";
import {DemoUSD} from "../../src/DemoUSD.sol";
import {DemoVault} from "../../src/DemoVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// P1-A03.T06: the wallet pays real Base Sepolia USDC (FiatToken v2.2) through ERC-1271.
/// Runs only with BASE_SEPOLIA_RPC_URL set; skipped otherwise (CI stays offline).
contract X402ForkTest is MandateFixture {
  address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

  function setUp() public override {
    string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
    if (bytes(rpc).length == 0) {
      vm.skip(true);
      return;
    }
    vm.createSelectFork(rpc);
    token = new DemoUSD();
    usdc = MockUSDC(BASE_SEPOLIA_USDC); // same EIP-3009 ABI as the real token
    vault = new DemoVault(token);
    factory = new WalletFactory(address(token), BASE_SEPOLIA_USDC, address(vault));
    wallet = MandateWallet(payable(factory.createWallet(ownerAddr)));
    deal(BASE_SEPOLIA_USDC, address(wallet), 10_000_000);
  }

  function test_P1_A03_T06_realUsdcSettlesThroughErc1271() public {
    _applyPolicy(_lists(), type(uint256).max);
    bytes32 permitId = _activate(_usdcPermit("fork-x402"));
    Pay memory x = _x402(permitId, 400_000, providerA, PROVIDER_A_PK);
    _execute(x);
    uint256 before = usdc.balanceOf(providerA);

    _settle(x.action);
    assertEq(usdc.balanceOf(providerA) - before, 400_000);
    assertEq(usdc.balanceOf(address(wallet)), 9_600_000);

    vm.expectRevert(); // nonce already used
    _settle(x.action);
    // An authorization the wallet never registered is rejected by isValidSignature.
    T.Action memory forged = x.action;
    forged.requestId = keccak256("never-registered");
    vm.expectRevert();
    _settle(forged);
  }
}
