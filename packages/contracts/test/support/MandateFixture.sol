// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateTypes as T} from "../../src/MandateTypes.sol";
import {MandateHashes as H} from "../../src/MandateHashes.sol";
import {MandateWallet} from "../../src/MandateWallet.sol";
import {WalletFactory} from "../../src/WalletFactory.sol";
import {DemoUSD} from "../../src/DemoUSD.sol";

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
  WalletFactory internal factory;
  MandateWallet internal wallet;
  uint256 private requestCounter;

  function setUp() public virtual {
    vm.chainId(84532);
    vm.warp(START);
    token = new DemoUSD();
    factory = new WalletFactory(address(token), address(0));
    wallet = MandateWallet(payable(factory.createWallet(ownerAddr)));
    token.mint(address(wallet), 10_000_000);
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
      asset: address(token),
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
}
