// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "../support/MandateFixture.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateHashes as H} from "../../src/MandateHashes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";
import {DemoUSD} from "../../src/DemoUSD.sol";
import {Vm} from "forge-std/Vm.sol";

/// Drives random payments, policy tightening/loosening and freezes against one wallet.
contract PolicyHandler {
  Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
  MandateWallet internal wallet;
  DemoUSD internal token;
  bytes32 internal permitId;
  address internal provider;
  uint256 internal executorPk;
  uint256 internal providerPk;
  uint256 internal ownerPk;
  uint256 internal nonce;

  uint256 public paidWhileFrozen;
  uint256 public paidAbovePerTx;
  uint256 public totalPaid;
  uint256 public successfulPays;
  uint256 public eligibleAttempts;
  uint256 public eligibleRejected;

  constructor(MandateWallet w, DemoUSD t, bytes32 id, address p, uint256 ePk, uint256 pPk, uint256 oPk) {
    (wallet, token, permitId, provider, executorPk, providerPk, ownerPk) = (w, t, id, p, ePk, pPk, oPk);
  }

  function _sig(uint256 pk, bytes32 d) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
    return abi.encodePacked(r, s, v);
  }

  function pay(uint256 seed) external {
    uint256 amount = 1 + (seed % 600_000);
    nonce++;
    uint64 nowTs = uint64(vm.getBlockTimestamp());
    T.Invoice memory inv = T.Invoice(keccak256(abi.encode("inv", nonce)), wallet.getPermit(permitId).permit.taskId, address(wallet), address(token), provider, amount, keccak256(abi.encode("in", nonce)), nowTs, nowTs + 60);
    T.Action memory a = T.Action(permitId, keccak256(abi.encode("req", nonce)), T.OP_PAY, provider, amount, 0, inv.invoiceId, inv.inputHash, 0, nowTs, nowTs + 60);
    T.Approval memory none;
    bool wasFrozen = wallet.frozen();
    (uint256 perTx,,,) = wallet.assetCap(address(token));
    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    // A payment the rules allow must go through: catches both a vacuous handler and false rejections.
    bool eligible = !wasFrozen && amount <= perTx && amount <= st.permit.maxPayment
      && wallet.getPeriodSpend(permitId, 0) + amount <= st.permit.periodCap
      && st.grossSpend + amount <= st.permit.spendCap && st.paymentCount < st.permit.maxPayments
      && st.actionCount < st.permit.maxActions;
    if (eligible) eligibleAttempts++;
    try wallet.execute(a, _sig(executorPk, H.digest(wallet.domainSeparator(), H.hash(a))), inv, _sig(providerPk, H.digest(H.invoiceDomain(address(wallet)), H.hash(inv))), none, "", "") {
      successfulPays++;
      totalPaid += amount;
      if (wasFrozen) paidWhileFrozen += amount;
      if (amount > perTx) paidAbovePerTx += amount;
    } catch {
      if (eligible) eligibleRejected++;
    }
  }

  function setPerTx(uint256 seed) external {
    uint256 perTx = 1 + (seed % 500_000);
    T.AssetCap[] memory caps = new T.AssetCap[](1);
    caps[0] = T.AssetCap(address(token), perTx, 10_000_000, 25_000_000);
    address[] memory empty;
    T.CallTemplate[] memory none;
    T.WalletPolicy memory p = T.WalletPolicy(wallet.walletPolicy().version + 1, keccak256(abi.encode(caps)), keccak256(abi.encode(empty)), keccak256(abi.encode(empty)), keccak256(abi.encode(none)), type(uint256).max, wallet.policyNonce(), uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + 600));
    wallet.applyWalletPolicy(p, caps, empty, empty, none, _sig(ownerPk, H.digest(wallet.domainSeparator(), H.hash(p))));
  }

  function toggleFreeze() external {
    uint8 cmd = wallet.frozen() ? T.CMD_UNFREEZE : T.CMD_FREEZE;
    T.Admin memory a = T.Admin(cmd, bytes32(0), wallet.adminNonce(), uint64(vm.getBlockTimestamp()), uint64(vm.getBlockTimestamp() + 600));
    wallet.applyAdmin(a, _sig(ownerPk, H.digest(wallet.domainSeparator(), H.hash(a))));
  }
}

contract PolicyInvariantsTest is MandateFixture {
  PolicyHandler internal handler;
  bytes32 internal permitId;

  function setUp() public override {
    super.setUp();
    T.Permit memory p = _allowancePermit("fuzz", 2_000_000, 1 days);
    p.maxActions = 200;
    p.maxPayments = 200;
    permitId = _activate(p);
    handler = new PolicyHandler(wallet, token, permitId, providerA, EXECUTOR_PK, PROVIDER_A_PK, OWNER_PK);
    targetContract(address(handler));
  }

  /// P1-A02.T07: frozen implies no agent outflow.
  function invariant_P1_A02_T07_noOutflowWhileFrozen() public view {
    assertEq(handler.paidWhileFrozen(), 0);
  }

  /// P1-A02.T07: no payment above the per-transaction cap in force at the time.
  function invariant_P1_A02_T07_perTxAlwaysRespected() public view {
    assertEq(handler.paidAbovePerTx(), 0);
  }

  /// P1-A02.T07: gross spend never exceeds the signed caps.
  function invariant_P1_A02_T07_grossWithinCaps() public view {
    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    assertEq(st.grossSpend, handler.totalPaid());
    assertLe(st.grossSpend, st.permit.spendCap);
    assertLe(wallet.getPeriodSpend(permitId, 0), st.permit.periodCap);
    assertEq(token.balanceOf(providerA), handler.totalPaid());
  }

  /// Liveness: every payment allowed by the Permit, policy and freeze state succeeded.
  function invariant_P1_A02_T07_eligiblePaymentsSucceed() public view {
    assertEq(handler.eligibleRejected(), 0);
  }

  function afterInvariant() public view {
    if (handler.eligibleAttempts() > 0) assertGt(handler.successfulPays(), 0);
  }
}
