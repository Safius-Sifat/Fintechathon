// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

contract MultiAssetTest is MandateFixture {
  function test_P1_A02_usdcRequiresOwnerAssetCap() public {
    T.Permit memory p = _permit("usdc-no-cap");
    p.asset = address(usdc);
    bytes memory sig = _signPermit(p, OWNER_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.AssetNotSupported.selector, address(usdc)));
    wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), sig);
  }

  function test_P1_A02_T06_independentCountersPerAsset() public {
    _applyPolicy(_lists(), type(uint256).max);
    bytes32 dusd = _activateNew("dusd");
    T.Permit memory p = _permit("usdc");
    p.asset = address(usdc);
    bytes32 usd = _activate(p);

    _execute(_pay(dusd, 400_000, providerA, PROVIDER_A_PK));
    _execute(_pay(usd, 300_000, providerA, PROVIDER_A_PK));
    assertEq(token.balanceOf(providerA), 400_000);
    assertEq(usdc.balanceOf(providerA), 300_000);
    assertEq(wallet.getBudget(executor, address(token)).walletGross, 400_000);
    assertEq(wallet.getBudget(executor, address(usdc)).walletGross, 300_000);
  }

  function test_P1_A02_T06_invoiceAssetMustMatchPermit() public {
    _applyPolicy(_lists(), type(uint256).max);
    T.Permit memory p = _permit("usdc-invoice");
    p.asset = address(usdc);
    bytes32 permitId = _activate(p);
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    x.invoice.asset = address(token);
    x.providerSig = _sign(PROVIDER_A_PK, H.digest(H.invoiceDomain(address(wallet)), H.hash(x.invoice)));
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.InvoiceMismatch.selector, bytes32("asset")));
    _execute(x);
  }

  function test_P1_A02_removingAssetCapStopsThatAsset() public {
    _applyPolicy(_lists(), type(uint256).max);
    T.Permit memory p = _permit("usdc-removed");
    p.asset = address(usdc);
    bytes32 permitId = _activate(p);
    Lists memory l = _lists();
    T.AssetCap[] memory onlyDusd = new T.AssetCap[](1);
    onlyDusd[0] = T.AssetCap(address(token), 500_000, 10_000_000, 25_000_000);
    l.caps = onlyDusd;
    _applyPolicy(l, type(uint256).max);
    Pay memory x = _pay(permitId, 100_000, providerA, PROVIDER_A_PK);
    vm.expectRevert(abi.encodeWithSelector(MandateWallet.AssetNotSupported.selector, address(usdc)));
    _execute(x);
  }
}
