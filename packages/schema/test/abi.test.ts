import { test } from "node:test";
import assert from "node:assert/strict";
import { mandateWalletAbi, walletFactoryAbi } from "../src/index.js";

const fn = (abi: readonly any[], name: string) =>
  abi.find((e) => e.type === "function" && e.name === name);
const ev = (abi: readonly any[], name: string) =>
  abi.find((e) => e.type === "event" && e.name === name);

test("P1-02 generated ABI exposes the S3 wallet and factory interface", () => {
  assert.deepEqual(
    fn(mandateWalletAbi, "execute").inputs.map((i: any) => i.name),
    [
      "a",
      "executorSignature",
      "invoice",
      "providerSignature",
      "approval",
      "ownerApproval",
      "callData",
    ],
  );
  assert.deepEqual(
    fn(mandateWalletAbi, "activatePermit").inputs.map((i: any) => i.type),
    ["tuple", "address[]", "tuple", "bytes32[]", "bytes"],
  );
  for (const name of [
    "applyOwnerTransfer",
    "applyAdmin",
    "periodUsed",
    "revokedPermitId",
    "ownerTransferNonce",
    "usedOwnerTransfer",
    "getPermit",
    "getBudget",
    "usedRequest",
    "permitNonce",
    "adminNonce",
    "authorityEpoch",
    "paused",
    "owner",
    "token",
    "vault",
  ])
    assert.ok(fn(mandateWalletAbi, name), name);
  assert.deepEqual(
    ev(mandateWalletAbi, "ActionExecuted").inputs.map((i: any) => i.name),
    [
      "permitId",
      "requestId",
      "operation",
      "asset",
      "target",
      "assets",
      "shares",
      "invoiceId",
      "inputHash",
      "actionDigest",
      "ownerApproved",
    ],
  );
  for (const name of [
    "PermitActivated",
    "PermitClosed",
    "WalletPaused",
    "OwnerTransferExecuted",
    "PermitRevoked",
    "Recovered",
  ])
    assert.ok(ev(mandateWalletAbi, name), name);
  assert.ok(
    fn(walletFactoryAbi, "createWallet") &&
      fn(walletFactoryAbi, "walletForOwner"),
  );
});
