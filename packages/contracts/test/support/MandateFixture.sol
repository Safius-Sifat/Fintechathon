// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateHashes as H} from "../../src/MandateHashes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";
import {WalletFactory} from "../../src/WalletFactory.sol";
import {DemoUSD} from "../../src/DemoUSD.sol";
import {DemoVault} from "../../src/DemoVault.sol";

/// Shared setup: public Anvil test keys only; wallet funded with 10,000,000 DemoUSD units.
abstract contract MandateFixture is Test {
  uint256 internal constant OWNER_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
  uint256 internal constant EXECUTOR_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
  uint256 internal constant PROVIDER_A_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
  uint256 internal constant PROVIDER_B_PK = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
  uint256 internal constant START = 1_793_000_000;

  address internal ownerAddr = vm.addr(OWNER_PK);
  address internal executor = vm.addr(EXECUTOR_PK);
  address internal providerA = vm.addr(PROVIDER_A_PK);
  address internal providerB = vm.addr(PROVIDER_B_PK);
  address internal relayer = makeAddr("relayer");

  DemoUSD internal token;
  DemoUSD internal usdc; // stands in for Base Sepolia test USDC (6 decimals)
  DemoVault internal vault;
  WalletFactory internal factory;
  MandateWallet internal wallet;
  uint256 private requestCounter;

  function setUp() public virtual {
    vm.chainId(84532);
    vm.warp(START);
    token = new DemoUSD();
    usdc = new DemoUSD();
    vault = new DemoVault(token);
    factory = new WalletFactory(address(token), address(usdc), address(vault));
    wallet = MandateWallet(payable(factory.createWallet(ownerAddr)));
    token.mint(address(wallet), 10_000_000);
    usdc.mint(address(wallet), 10_000_000);
  }

  function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
    return abi.encodePacked(r, s, v);
  }

  function _recipients() internal view returns (address[] memory r) {
    r = new address[](2);
    (r[0], r[1]) = providerA < providerB ? (providerA, providerB) : (providerB, providerA);
  }

  function _zeroSchedule() internal pure returns (T.Schedule memory s) {}

  function _permit(bytes32 taskId) internal view returns (T.Permit memory p) {
    p.taskId = taskId;
    p.executor = executor;
    p.kind = T.KIND_BROWSER;
    p.asset = address(token);
    p.runbookHash = keccak256("runbook");
    p.conditionsHash = keccak256("conditions");
    p.recipientsHash = keccak256(abi.encode(_recipients()));
    p.scheduleHash = H.hashSchedule(_zeroSchedule());
    p.issuedAt = uint64(vm.getBlockTimestamp());
    p.startsAt = uint64(vm.getBlockTimestamp());
    p.expiresAt = uint64(vm.getBlockTimestamp() + 1 hours);
    p.epoch = wallet.authorityEpoch();
    p.nonce = wallet.permitNonce();
    p.maxActions = 6;
    p.maxPayments = 3;
    p.maxPayment = 500_000;
    p.spendCap = 2_000_000;
    p.liquidFloor = 3_000_000;
    p.reviewThreshold = type(uint256).max;
  }

  function _signPermit(T.Permit memory p, uint256 pk) internal view returns (bytes memory) {
    return _sign(pk, H.digest(wallet.domainSeparator(), H.hash(p)));
  }

  function _activate(T.Permit memory p) internal returns (bytes32) {
    vm.prank(relayer);
    return wallet.activatePermit(p, _recipients(), _zeroSchedule(), new bytes32[](0), _signPermit(p, OWNER_PK));
  }

  function _activateNew(bytes32 taskId) internal returns (bytes32) {
    return _activate(_permit(taskId));
  }

  struct Pay {
    T.Action action;
    bytes executorSig;
    T.Invoice invoice;
    bytes providerSig;
    T.Approval approval;
    bytes ownerApproval;
  }

  function _pay(bytes32 permitId, uint256 amount, address provider, uint256 providerPk) internal returns (Pay memory x) {
    requestCounter++;
    T.Permit memory p = wallet.getPermit(permitId).permit;
    x.invoice = T.Invoice({
      invoiceId: keccak256(abi.encode("invoice", requestCounter)),
      taskId: p.taskId,
      wallet: address(wallet),
      asset: p.asset,
      recipient: provider,
      amount: amount,
      inputHash: keccak256(abi.encode("input", requestCounter)),
      issuedAt: uint64(vm.getBlockTimestamp()),
      expiresAt: uint64(vm.getBlockTimestamp() + 60)
    });
    x.providerSig = _sign(providerPk, H.digest(H.invoiceDomain(address(wallet)), H.hash(x.invoice)));
    x.action = T.Action({
      permitId: permitId,
      requestId: keccak256(abi.encode("request", requestCounter)),
      operation: T.OP_PAY,
      target: provider,
      amount: amount,
      minOutput: 0,
      invoiceId: x.invoice.invoiceId,
      inputHash: x.invoice.inputHash,
      period: 0,
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 60)
    });
    x.executorSig = _signAction(x.action, EXECUTOR_PK);
  }

  function _signAction(T.Action memory a, uint256 pk) internal view returns (bytes memory) {
    return _sign(pk, H.digest(wallet.domainSeparator(), H.hash(a)));
  }

  function _actionDigest(T.Action memory a) internal view returns (bytes32) {
    return H.digest(wallet.domainSeparator(), H.hash(a));
  }

  function _approve(Pay memory x, uint256 pk) internal view {
    x.approval = T.Approval({actionDigest: _actionDigest(x.action), expiresAt: x.action.deadline});
    x.ownerApproval = _sign(pk, H.digest(wallet.domainSeparator(), H.hash(x.approval)));
  }

  function _execute(Pay memory x) internal {
    vm.prank(relayer);
    wallet.execute(x.action, x.executorSig, x.invoice, x.providerSig, x.approval, x.ownerApproval, "");
  }

  function _close(bytes32 permitId) internal returns (T.Action memory a, bytes memory sig) {
    requestCounter++;
    a.permitId = permitId;
    a.requestId = keccak256(abi.encode("close", requestCounter));
    a.operation = T.OP_CLOSE;
    a.issuedAt = uint64(vm.getBlockTimestamp());
    a.deadline = uint64(vm.getBlockTimestamp() + 60);
    sig = _signAction(a, EXECUTOR_PK);
  }

  function _ownerTransfer(bytes32 id, address asset, address recipient, uint256 amount)
    internal
    view
    returns (T.OwnerTransfer memory t, bytes memory sig)
  {
    t = T.OwnerTransfer({
      transferId: id,
      asset: asset,
      recipient: recipient,
      amount: amount,
      epoch: wallet.authorityEpoch(),
      nonce: wallet.ownerTransferNonce(),
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 300)
    });
    sig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(t)));
  }

  // ------------------------------------------------------------ P1-03 / P1-04 helpers

  function _liquidityPermit(bytes32 taskId, uint256 depositCap, uint256 withdrawCap) internal view returns (T.Permit memory p) {
    p = _permit(taskId);
    p.kind = T.KIND_LIQUIDITY;
    p.recipientsHash = keccak256(abi.encode(new address[](0)));
    p.maxPayments = 0;
    p.maxPayment = 0;
    p.spendCap = 0;
    p.depositCap = depositCap;
    p.withdrawCap = withdrawCap;
  }

  function _activateWith(T.Permit memory p, address[] memory recipients, T.Schedule memory s) internal returns (bytes32) {
    vm.prank(relayer);
    return wallet.activatePermit(p, recipients, s, new bytes32[](0), _signPermit(p, OWNER_PK));
  }

  function _activateLiquidity(bytes32 taskId, uint256 depositCap, uint256 withdrawCap) internal returns (bytes32) {
    return _activateWith(_liquidityPermit(taskId, depositCap, withdrawCap), new address[](0), _zeroSchedule());
  }

  function _vaultAction(bytes32 permitId, uint8 op, uint256 amount, uint256 minOutput)
    internal
    returns (T.Action memory a, bytes memory sig)
  {
    requestCounter++;
    a = T.Action({
      permitId: permitId,
      requestId: keccak256(abi.encode("vault", requestCounter)),
      operation: op,
      target: address(vault),
      amount: amount,
      minOutput: minOutput,
      invoiceId: bytes32(0),
      inputHash: keccak256("liquidity-input"),
      period: 0,
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 60)
    });
    sig = _signAction(a, EXECUTOR_PK);
  }

  function _run(T.Action memory a, bytes memory sig) internal {
    T.Invoice memory noInvoice;
    T.Approval memory noApproval;
    vm.prank(relayer);
    wallet.execute(a, sig, noInvoice, "", noApproval, "", "");
  }

  function _schedule(address to, uint256 amount, uint64 start, uint32 interval, uint32 window, uint32 periods)
    internal
    pure
    returns (T.Schedule memory s)
  {
    s = T.Schedule({recipient: to, amount: amount, start: start, interval: interval, window: window, periods: periods});
  }

  function _schedulePermit(bytes32 taskId, T.Schedule memory s) internal view returns (T.Permit memory p) {
    p = _permit(taskId);
    p.kind = T.KIND_SCHEDULE;
    address[] memory r = new address[](1);
    r[0] = s.recipient;
    p.recipientsHash = keccak256(abi.encode(r));
    p.scheduleHash = H.hashSchedule(s);
    p.maxPayments = s.periods;
    p.maxActions = s.periods + 1;
    p.maxPayment = s.amount;
    p.spendCap = s.amount * s.periods;
  }

  function _activateSchedule(bytes32 taskId, T.Schedule memory s) internal returns (bytes32) {
    address[] memory r = new address[](1);
    r[0] = s.recipient;
    return _activateWith(_schedulePermit(taskId, s), r, s);
  }

  function _transferAction(bytes32 permitId, address to, uint256 amount, uint32 period)
    internal
    returns (T.Action memory a, bytes memory sig)
  {
    requestCounter++;
    a = T.Action({
      permitId: permitId,
      requestId: keccak256(abi.encode("transfer", requestCounter)),
      operation: T.OP_TRANSFER,
      target: to,
      amount: amount,
      minOutput: 0,
      invoiceId: bytes32(0),
      inputHash: bytes32(0),
      period: period,
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 60)
    });
    sig = _signAction(a, EXECUTOR_PK);
  }

  function _admin(uint8 command, bytes32 permitId) internal view returns (T.Admin memory a, bytes memory sig) {
    a = T.Admin({
      command: command,
      permitId: permitId,
      nonce: wallet.adminNonce(),
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 600)
    });
    sig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(a)));
  }

  function _applyAdmin(uint8 command, bytes32 permitId) internal {
    (T.Admin memory a, bytes memory sig) = _admin(command, permitId);
    vm.prank(relayer);
    wallet.applyAdmin(a, sig);
  }

  // ------------------------------------------------------------------ P1-A02 helpers

  struct Lists {
    T.AssetCap[] caps;
    address[] allowlist;
    address[] blocklist;
    T.CallTemplate[] templates;
  }

  function _defaultCaps() internal view returns (T.AssetCap[] memory caps) {
    caps = new T.AssetCap[](2);
    T.AssetCap memory a = T.AssetCap(address(token), 500_000, 10_000_000, 25_000_000);
    T.AssetCap memory b = T.AssetCap(address(usdc), 500_000, 10_000_000, 25_000_000);
    (caps[0], caps[1]) = address(token) < address(usdc) ? (a, b) : (b, a);
  }

  function _lists() internal view returns (Lists memory l) {
    l.caps = _defaultCaps();
  }

  function _signedPolicy(Lists memory l, uint256 reviewThreshold)
    internal
    view
    returns (T.WalletPolicy memory p, bytes memory sig)
  {
    p = T.WalletPolicy({
      version: wallet.walletPolicy().version + 1,
      assetCapsHash: keccak256(abi.encode(l.caps)),
      allowlistHash: keccak256(abi.encode(l.allowlist)),
      blocklistHash: keccak256(abi.encode(l.blocklist)),
      templatesHash: keccak256(abi.encode(l.templates)),
      reviewThreshold: reviewThreshold,
      nonce: wallet.policyNonce(),
      issuedAt: uint64(vm.getBlockTimestamp()),
      deadline: uint64(vm.getBlockTimestamp() + 600)
    });
    sig = _sign(OWNER_PK, H.digest(wallet.domainSeparator(), H.hash(p)));
  }

  function _applyPolicy(Lists memory l, uint256 reviewThreshold) internal {
    (T.WalletPolicy memory p, bytes memory sig) = _signedPolicy(l, reviewThreshold);
    vm.prank(relayer);
    wallet.applyWalletPolicy(p, l.caps, l.allowlist, l.blocklist, l.templates, sig);
  }

  function _one(address a) internal pure returns (address[] memory r) {
    r = new address[](1);
    r[0] = a;
  }

  function _allowancePermit(bytes32 taskId, uint256 periodCap, uint32 periodSeconds) internal view returns (T.Permit memory p) {
    p = _permit(taskId);
    p.kind = T.KIND_ALLOWANCE;
    p.expiresAt = uint64(vm.getBlockTimestamp() + 30 days);
    p.maxActions = 200;
    p.maxPayments = 150;
    p.spendCap = 20_000_000;
    p.periodCap = periodCap;
    p.periodSeconds = periodSeconds;
  }
}
