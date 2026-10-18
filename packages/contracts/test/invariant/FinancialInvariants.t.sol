// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MandateFixture} from "../support/MandateFixture.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateHashes as H} from "../../src/MandateHashes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";
import {DemoUSD} from "../../src/DemoUSD.sol";
import {Vm} from "forge-std/Vm.sol";

/// Random mix of payments (allowed and unauthorized recipients), replays, refunds, deposits,
/// owner transfers, pause, revoke, new Permits and stranger-signed owner commands. Ghost state
/// tracks what should have happened, independently of the wallet's own counters.
contract FinancialHandler {
  Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
  uint256 internal constant OWNER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
  uint256 internal constant EXECUTOR_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
  uint256 internal constant PROVIDER_A_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
  uint256 internal constant STRANGER_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;

  MandateWallet internal wallet;
  DemoUSD internal token;
  address internal providerA;
  address public attacker = address(0xBAD);
  bytes32 internal liquidityId;
  bytes32[] internal permitIds;
  uint256 internal nonce;

  T.Action internal lastAction;
  bytes internal lastSig;
  T.Invoice internal lastInvoice;
  bytes internal lastProviderSig;
  bool internal havePaid;

  mapping(bytes32 => uint256) public ghostGross;
  mapping(bytes32 => uint256) internal seenGross;
  mapping(bytes32 => bool) internal paidRequest;
  uint256 public duplicatePays;
  uint256 public floorBreaches;
  uint256 public nonAtomicFailures;
  uint256 public grossDecreases;
  uint256 public strangerSuccesses;
  uint256 public successfulPays;
  uint256 public eligibleAttempts;
  uint256 public eligibleRejected;

  constructor(MandateWallet w, DemoUSD t, address providerA_, bytes32 liquidityId_, bytes32 firstPermit) {
    (wallet, token, providerA, liquidityId) = (w, t, providerA_, liquidityId_);
    permitIds.push(firstPermit);
  }

  function permitCount() external view returns (uint256) {
    return permitIds.length;
  }

  function permitAt(uint256 i) external view returns (bytes32) {
    return permitIds[i];
  }

  function _sig(uint256 pk, bytes32 d) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
    return abi.encodePacked(r, s, v);
  }

  function _now() internal view returns (uint64) {
    return uint64(vm.getBlockTimestamp());
  }

  function pay(uint256 permitSeed, uint256 amountSeed, bool toAttacker) external {
    bytes32 permitId = permitIds[permitSeed % permitIds.length];
    address to = toAttacker ? attacker : providerA;
    uint256 amount = 1 + (amountSeed % 600_000);
    nonce++;
    T.Invoice memory inv = T.Invoice(
      keccak256(abi.encode("inv", nonce)), wallet.getPermit(permitId).permit.taskId, address(wallet), address(token),
      to, amount, keccak256(abi.encode("in", nonce)), _now(), _now() + 60
    );
    // The attacker cannot obtain a provider signature for itself; it signs with its own key.
    bytes memory providerSig =
      _sig(toAttacker ? STRANGER_PK : PROVIDER_A_PK, H.digest(H.invoiceDomain(address(wallet)), H.hash(inv)));
    T.Action memory a = T.Action(
      permitId, keccak256(abi.encode("req", nonce)), T.OP_PAY, to, amount, 0, inv.invoiceId, inv.inputHash, 0, _now(), _now() + 60
    );
    bytes memory sig = _sig(EXECUTOR_PK, H.digest(wallet.domainSeparator(), H.hash(a)));
    bool eligible = !toAttacker && _eligible(permitId, amount);
    if (eligible) eligibleAttempts++;
    bool ok = _submit(a, sig, inv, providerSig);
    if (eligible && !ok) eligibleRejected++;
    if (ok) {
      (lastAction, lastSig, lastInvoice, lastProviderSig, havePaid) = (a, sig, inv, providerSig, true);
    }
  }

  /// Whether the rules allow this payment, computed only from the wallet's public views.
  function _eligible(bytes32 permitId, uint256 amount) internal view returns (bool) {
    MandateWallet.PermitState memory st = wallet.getPermit(permitId);
    T.Permit memory p = st.permit;
    MandateWallet.Budget memory b = wallet.getBudget(p.executor, address(token));
    return !wallet.paused() && !wallet.frozen() && st.activated && !st.closed && !st.revoked
      && p.epoch == wallet.authorityEpoch() && _now() < p.expiresAt && amount <= p.maxPayment
      && st.paymentCount < p.maxPayments && st.actionCount < p.maxActions && st.grossSpend + amount <= p.spendCap
      && b.executorGross + amount <= 5_000_000 && b.walletGross + amount <= 10_000_000
      && b.walletWeekGross + amount <= 25_000_000 && b.liquidAssets >= amount + p.liquidFloor;
  }

  function replay() external {
    if (havePaid) _submit(lastAction, lastSig, lastInvoice, lastProviderSig);
  }

  function _submit(T.Action memory a, bytes memory sig, T.Invoice memory inv, bytes memory providerSig)
    internal
    returns (bool ok)
  {
    MandateWallet.PermitState memory before = wallet.getPermit(a.permitId);
    T.Approval memory none;
    try wallet.execute(a, sig, inv, providerSig, none, "", "") {
      ok = true;
      successfulPays++;
      if (paidRequest[a.requestId]) duplicatePays++;
      paidRequest[a.requestId] = true;
      ghostGross[a.permitId] += a.amount;
      if (token.balanceOf(address(wallet)) < before.permit.liquidFloor) floorBreaches++;
    } catch {
      MandateWallet.PermitState memory afterSt = wallet.getPermit(a.permitId);
      if (afterSt.grossSpend != before.grossSpend || afterSt.actionCount != before.actionCount) nonAtomicFailures++;
    }
    _trackGross();
  }

  function refund(uint256 seed) external {
    uint256 amount = seed % (token.balanceOf(providerA) + 1);
    vm.prank(providerA);
    token.transfer(address(wallet), amount);
    _trackGross();
  }

  function deposit(uint256 seed) external {
    uint256 amount = 1 + (seed % 400_000);
    nonce++;
    T.Action memory a = T.Action(
      liquidityId, keccak256(abi.encode("dep", nonce)), T.OP_DEPOSIT, wallet.vault(), amount, 1, bytes32(0),
      bytes32(0), 0, _now(), _now() + 60
    );
    T.Invoice memory noInvoice;
    T.Approval memory none;
    try wallet.execute(a, _sig(EXECUTOR_PK, H.digest(wallet.domainSeparator(), H.hash(a))), noInvoice, "", none, "", "") {} catch {}
  }

  function ownerTransfer(uint256 seed) external {
    T.OwnerTransfer memory t = T.OwnerTransfer(
      keccak256(abi.encode("ot", nonce++)), address(token), vm.addr(OWNER_PK), 1 + (seed % 100_000),
      wallet.authorityEpoch(), wallet.ownerTransferNonce(), _now(), _now() + 300
    );
    wallet.applyOwnerTransfer(t, _sig(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(t))));
  }

  function strangerOwnerTransfer(uint256 seed) external {
    T.OwnerTransfer memory t = T.OwnerTransfer(
      keccak256(abi.encode("st", nonce++)), address(token), attacker, 1 + (seed % 100_000), wallet.authorityEpoch(),
      wallet.ownerTransferNonce(), _now(), _now() + 300
    );
    try wallet.applyOwnerTransfer(t, _sig(STRANGER_PK, H.digest(wallet.domainSeparator(), H.hash(t)))) {
      strangerSuccesses++;
    } catch {}
  }

  function admin(uint8 cmdSeed, uint256 permitSeed) external {
    uint8 cmd = [T.CMD_PAUSE, T.CMD_UNPAUSE, T.CMD_REVOKE][cmdSeed % 3];
    bytes32 target = cmd == T.CMD_REVOKE ? permitIds[permitSeed % permitIds.length] : bytes32(0);
    T.Admin memory a = T.Admin(cmd, target, wallet.adminNonce(), _now(), _now() + 600);
    wallet.applyAdmin(a, _sig(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(a))));
  }

  function newPermit() external {
    if (wallet.paused()) return;
    address[] memory r = new address[](1);
    r[0] = providerA;
    T.Schedule memory s;
    T.Permit memory p;
    p.taskId = keccak256(abi.encode("task", nonce++));
    p.executor = vm.addr(EXECUTOR_PK);
    p.kind = T.KIND_BROWSER;
    p.asset = address(token);
    p.runbookHash = keccak256("runbook");
    p.conditionsHash = keccak256("conditions");
    p.recipientsHash = keccak256(abi.encode(r));
    p.scheduleHash = H.hashSchedule(s);
    (p.issuedAt, p.startsAt, p.expiresAt) = (_now(), _now(), _now() + 1 hours);
    (p.epoch, p.nonce) = (wallet.authorityEpoch(), wallet.permitNonce());
    (p.maxActions, p.maxPayments, p.maxPayment, p.spendCap, p.liquidFloor) = (6, 3, 500_000, 2_000_000, 3_000_000);
    p.reviewThreshold = type(uint256).max;
    permitIds.push(wallet.activatePermit(p, r, s, new bytes32[](0), _sig(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(p)))));
  }

  function _trackGross() internal {
    for (uint256 i = 0; i < permitIds.length; i++) {
      uint256 g = wallet.getPermit(permitIds[i]).grossSpend;
      if (g < seenGross[permitIds[i]]) grossDecreases++;
      seenGross[permitIds[i]] = g;
    }
  }
}

contract InvariantTest is MandateFixture {
  FinancialHandler internal handler;
  bytes32 internal liquidityId;

  function setUp() public override {
    super.setUp();
    liquidityId = _activateLiquidity("liquidity", 1_000_000, 0);
    T.Permit memory p = _permit("first");
    address[] memory r = _one(providerA);
    p.recipientsHash = keccak256(abi.encode(r));
    bytes32 first = _activateWith(p, r, _zeroSchedule());
    handler = new FinancialHandler(wallet, token, providerA, liquidityId, first);
    targetContract(address(handler));
  }

  function invariant_P1_05_T03_noDuplicatePayment() public view {
    assertEq(handler.duplicatePays(), 0);
  }

  function invariant_P1_05_T03_unauthorizedRecipientNeverPaid() public view {
    assertEq(token.balanceOf(handler.attacker()), 0);
  }

  function invariant_P1_05_T03_failedCallsAreAtomic() public view {
    assertEq(handler.nonAtomicFailures(), 0);
  }

  function invariant_P1_05_T03_grossNeverDecreasesAndMatchesPayments() public view {
    assertEq(handler.grossDecreases(), 0);
    for (uint256 i = 0; i < handler.permitCount(); i++) {
      bytes32 id = handler.permitAt(i);
      MandateWallet.PermitState memory st = wallet.getPermit(id);
      assertEq(st.grossSpend, handler.ghostGross(id));
      assertLe(st.grossSpend, st.permit.spendCap);
    }
  }

  /// Delegated payments never take liquid funds below the floor. Owner transfers and recovery
  /// are the modelled exception: they may go below it on purpose (S8.3).
  function invariant_P1_05_T03_delegatedSpendRespectsFloor() public view {
    assertEq(handler.floorBreaches(), 0);
  }

  function invariant_P1_05_T03_depositCapHolds() public view {
    MandateWallet.PermitState memory st = wallet.getPermit(liquidityId);
    assertLe(st.depositedAssets, st.permit.depositCap);
  }

  function invariant_P1_05_T03_strangerGainsNoOwnerPrivilege() public view {
    assertEq(handler.strangerSuccesses(), 0);
  }

  /// Liveness: every payment the rules allow succeeded (catches a vacuous handler and false rejections).
  function invariant_P1_05_T03_eligiblePaymentsSucceed() public view {
    assertEq(handler.eligibleRejected(), 0);
  }

  /// The eligibility model is not vacuous: ordinary payments count as eligible and succeed,
  /// and payments after a pause are not eligible.
  function test_P1_05_handlerEligibilityModel() public {
    handler.pay(0, 99_999, false);
    handler.pay(0, 199_999, false);
    assertEq(handler.eligibleAttempts(), 2);
    assertEq(handler.successfulPays(), 2);
    handler.admin(0, 0); // PAUSE
    handler.pay(0, 99_999, false);
    assertEq(handler.eligibleAttempts(), 2);
    assertEq(handler.successfulPays(), 2);
  }
}
