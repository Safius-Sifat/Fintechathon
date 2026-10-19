// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "./support/MandateFixture.sol";
import {MandateTypes as T} from "../src/MandateTypes.sol";
import {MandateHashes as H} from "../src/MandateHashes.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {TaxToken, PlainToken18, FalseToken} from "./mocks/Mocks.sol";

/// P1-W03: contract side of history attribution and the wallet cases WQ03/04/07/08/13.
contract OwnerActivityTest is MandateFixture {
  address internal payee = makeAddr("owner-payee");

  function _relay(T.OwnerTransfer memory t, bytes memory sig) internal {
    vm.prank(relayer);
    wallet.applyOwnerTransfer(t, sig);
  }

  function _domain(string memory version, uint256 chainId, address verifyingContract) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(H.DOMAIN_TYPEHASH, keccak256("MandateWallet"), keccak256(bytes(version)), chainId, verifyingContract)
    );
  }

  /// Personal -> managed funding moves balances only: no counter, nonce or epoch changes.
  function test_P1_W03_T01_fundingIsNotAgentSpend() public {
    deal(address(token), ownerAddr, 1_000_000);
    MandateWallet.Budget memory before = wallet.getBudget(executor, address(token));
    uint256 total = token.balanceOf(ownerAddr) + token.balanceOf(address(wallet));

    vm.prank(ownerAddr);
    token.transfer(address(wallet), 1_000_000);

    MandateWallet.Budget memory b = wallet.getBudget(executor, address(token));
    assertEq(token.balanceOf(ownerAddr) + token.balanceOf(address(wallet)), total);
    assertEq(b.liquidAssets, before.liquidAssets + 1_000_000);
    assertEq(b.walletGross, before.walletGross);
    assertEq(b.executorGross, before.executorGross);
    assertEq(wallet.authorityEpoch(), 0);
    assertEq(wallet.ownerTransferNonce(), 0);
    assertFalse(wallet.paused());
  }

  /// WQ07: a manual managed send needs only the owner signature (no executor, no MPC); any relayer
  /// submits it. It is OWNER_CONTROL: task gross is preserved, the wallet pauses and the epoch advances.
  function test_P1_W03_T02_WQ07_ownerSendIsOwnerControl() public {
    bytes32 permitId = _activateNew("task");
    _execute(_pay(permitId, 200_000, providerA, PROVIDER_A_PK));

    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("manual", address(token), payee, 400_000);
    vm.expectEmit(true, false, false, true, address(wallet));
    emit MandateWallet.WalletPaused(true, 1);
    vm.expectEmit(true, true, true, true, address(wallet));
    emit MandateWallet.OwnerTransferExecuted("manual", address(token), payee, 400_000, 1, H.digest(wallet.domainSeparator(), H.hash(t)));
    _relay(t, sig);

    assertEq(token.balanceOf(payee), 400_000);
    assertEq(wallet.getPermit(permitId).grossSpend, 200_000);
    assertEq(wallet.getBudget(executor, address(token)).walletGross, 200_000);
    assertTrue(wallet.paused());
    assertEq(wallet.authorityEpoch(), 1);

    Pay memory late = _pay(permitId, 1_000, providerA, PROVIDER_A_PK);
    vm.expectRevert();
    _execute(late); // the agent's old authority is dead
    assertEq(wallet.getPermit(permitId).grossSpend, 200_000);
  }

  /// WQ03: domain 84532 only, and amounts are exact base units with no rounding.
  function test_P1_W03_WQ03_wrongChainAndPrecision() public {
    vm.chainId(1);
    // The constructor's WrongChain revert surfaces through CREATE2 as DeploymentFailed.
    vm.expectRevert(WalletFactory.DeploymentFailed.selector);
    factory.createWallet(makeAddr("chain-1-owner"));
    vm.chainId(84_532);

    (T.OwnerTransfer memory t,) = _ownerTransfer("chain-1", address(token), payee, 1);
    bytes memory sig = _sign(OWNER_PK, H.digest(_domain("5", 1, address(wallet)), H.hash(t)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _relay(t, sig);

    (t, sig) = _ownerTransfer("one-unit", address(token), payee, 1);
    _relay(t, sig);
    assertEq(token.balanceOf(payee), 1);
    assertEq(token.balanceOf(address(wallet)), 10_000_000 - 1);

    uint256 balance = token.balanceOf(address(wallet));
    (t, sig) = _ownerTransfer("over", address(token), payee, balance + 1);
    vm.expectRevert();
    _relay(t, sig);
    assertEq(token.balanceOf(address(wallet)), balance);
  }

  /// WQ04: ETH and ERC-20 sends debit exactly the amount; the relayer pays gas, never the wallet.
  function test_P1_W03_WQ04_exactDebit() public {
    vm.deal(address(wallet), 1 ether);
    vm.deal(relayer, 1 ether);
    vm.txGasPrice(1 gwei);

    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("eth", address(0), payee, 0.3 ether);
    _relay(t, sig);
    assertEq(address(wallet).balance, 0.7 ether);
    assertEq(payee.balance, 0.3 ether);

    _applyAdmin(T.CMD_UNPAUSE, bytes32(0));
    (t, sig) = _ownerTransfer("erc20", address(token), payee, 2_500_000);
    _relay(t, sig);
    assertEq(token.balanceOf(address(wallet)), 7_500_000);
    assertEq(token.balanceOf(payee), 2_500_000);
    assertEq(address(wallet).balance, 0.7 ether);
  }

  /// WQ08: owner commands signed by the agent key, for domain 4, another chain, another wallet
  /// or with a future or replayed nonce are rejected and change nothing.
  function test_P1_W03_WQ08_rejectedSignaturesDomainsAndNonces() public {
    (T.OwnerTransfer memory t, bytes memory good) = _ownerTransfer("wq08", address(token), payee, 1_000);
    bytes32 s = H.hash(t);
    bytes[4] memory bad = [
      _sign(EXECUTOR_PK, H.digest(wallet.domainSeparator(), s)),
      _sign(OWNER_PK, H.digest(_domain("4", 84_532, address(wallet)), s)),
      _sign(OWNER_PK, H.digest(_domain("5", 11_155_111, address(wallet)), s)),
      _sign(OWNER_PK, H.digest(_domain("5", 84_532, makeAddr("other-wallet")), s))
    ];
    for (uint256 i; i < bad.length; ++i) {
      vm.expectRevert(MandateWallet.InvalidSignature.selector);
      _relay(t, bad[i]);
    }

    (T.OwnerTransfer memory future,) = _ownerTransfer("wq08-future", address(token), payee, 1_000);
    future.nonce = 1;
    bytes memory futureSig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(future)));
    vm.expectRevert(MandateWallet.WrongNonce.selector);
    _relay(future, futureSig);

    _relay(t, good);
    vm.expectRevert(MandateWallet.WrongEpoch.selector);
    _relay(t, good); // replay
    assertEq(token.balanceOf(payee), 1_000);

    // An agent Action signed for domain 4 is rejected too.
    _applyAdmin(T.CMD_UNPAUSE, bytes32(0));
    Pay memory x = _pay(_activateNew("wq08-agent"), 1_000, providerA, PROVIDER_A_PK);
    x.executorSig = _sign(EXECUTOR_PK, H.digest(_domain("4", 84_532, address(wallet)), H.hash(x.action)));
    vm.expectRevert(MandateWallet.InvalidSignature.selector);
    _execute(x);
  }

  /// WQ13: imported tokens move by exact base units regardless of metadata; taxed, non-compliant
  /// and code-less "tokens" are rejected without side effects.
  function test_P1_W03_WQ13_importedTaxedAndInvalidTokens() public {
    PlainToken18 imported = new PlainToken18();
    imported.mint(address(wallet), 1e18 + 1);
    (T.OwnerTransfer memory t, bytes memory sig) = _ownerTransfer("imported", address(imported), payee, 1e18 + 1);
    _relay(t, sig);
    assertEq(imported.balanceOf(payee), 1e18 + 1);
    _applyAdmin(T.CMD_UNPAUSE, bytes32(0));

    TaxToken taxed = new TaxToken();
    taxed.mint(address(wallet), 1_000);
    (t, sig) = _ownerTransfer("taxed", address(taxed), payee, 1_000);
    vm.expectRevert(MandateWallet.InexactTokenTransfer.selector);
    _relay(t, sig);

    FalseToken falseToken = new FalseToken();
    falseToken.mint(address(wallet), 1_000);
    (t, sig) = _ownerTransfer("false", address(falseToken), payee, 1_000);
    vm.expectRevert();
    _relay(t, sig);

    (t, sig) = _ownerTransfer("no-code", makeAddr("eoa-token"), payee, 1_000);
    vm.expectRevert(MandateWallet.InvalidAsset.selector);
    _relay(t, sig);

    assertEq(taxed.balanceOf(address(wallet)), 1_000);
    assertEq(falseToken.balanceOf(address(wallet)), 1_000);
    assertEq(wallet.ownerTransferNonce(), 1);
    assertEq(wallet.authorityEpoch(), 1); // UNPAUSE never moves the epoch back
  }
}
