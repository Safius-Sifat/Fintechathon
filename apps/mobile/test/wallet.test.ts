import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { authorityTypes } from "@mandate/schema";
import {
  ADMIN_TYPES,
  LOGIN_TYPES,
  buildAdmin,
  checkAddress,
  checkAmount,
  checkLoginRequest,
  deriveAccount,
  loginDomain,
  normalizePhrase,
  phraseToSeed,
  quizPositions,
  walletDomain,
} from "../src/wallet/core";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(resolve("../../packages/schema/fixtures", name), "utf8"),
  );

const accounts = fixture("accounts-v7.json");
const seed = phraseToSeed(accounts.mnemonic);

test("wallet: derives the shared fixture accounts, with and without passphrase", () => {
  for (const a of accounts.noPassphrase)
    assert.equal(deriveAccount(seed, a.index).address, a.address);
  const withPass = phraseToSeed(
    accounts.mnemonic,
    accounts.withPassphrase.passphrase,
  );
  for (const a of accounts.withPassphrase.accounts)
    assert.equal(deriveAccount(withPass, a.index).address, a.address);
});

test("wallet: account index is limited to 0..19", () => {
  assert.throws(() => deriveAccount(seed, 20));
  assert.throws(() => deriveAccount(seed, -1));
});

test("wallet: typed data matches the shared schema", () => {
  assert.deepEqual(ADMIN_TYPES.Admin, authorityTypes.Admin);
  assert.deepEqual(LOGIN_TYPES.Login, authorityTypes.Login);
});

test("wallet: Admin and Login signatures match the golden vectors", async () => {
  const owner = deriveAccount(seed, 0);
  for (const [file, types, primaryType] of [
    ["admin-v7.json", ADMIN_TYPES, "Admin"],
    ["login-v7.json", LOGIN_TYPES, "Login"],
  ] as const) {
    for (const v of fixture(file).valid) {
      const domain =
        primaryType === "Admin"
          ? walletDomain(v.domain.verifyingContract)
          : loginDomain;
      assert.deepEqual({ ...domain }, v.domain);
      const signature = await owner.signTypedData({
        domain,
        types,
        primaryType,
        message: v.message,
      } as never);
      assert.equal(signature, v.signature, `${file} ${v.id}`);
    }
  }
});

test("wallet: phrases are normalized and checked", () => {
  assert.equal(
    normalizePhrase(
      `  ${accounts.mnemonic.toUpperCase().replace(/ /g, "  ")} `,
    ),
    accounts.mnemonic,
  );
  assert.equal(normalizePhrase("test test test"), null);
  assert.equal(
    normalizePhrase(accounts.mnemonic.replace("junk", "test")),
    null,
  );
});

test("wallet: quiz asks three different words", () => {
  const q = quizPositions(12);
  assert.equal(new Set(q).size, 3);
  assert.ok(q.every((i) => i >= 0 && i < 12));
});

test("wallet: addresses and amounts are checked", () => {
  assert.equal(
    checkAddress("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266").ok,
    true,
  );
  assert.equal(
    checkAddress("0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266").ok,
    false,
  );
  assert.equal(
    checkAddress("0x0000000000000000000000000000000000000000").ok,
    false,
  );
  assert.equal(checkAddress("hello").ok, false);
  const a = checkAmount("1.5", 6);
  assert.ok(a.ok && a.value === 1_500_000n);
  assert.equal(checkAmount("1.1234567", 6).ok, false);
  assert.equal(checkAmount("0", 18).ok, false);
  assert.equal(checkAmount("abc", 18).ok, false);
});

test("wallet: Admin lasts at most 30 minutes", () => {
  const a = buildAdmin("PAUSE", 3n, 1000n);
  assert.equal(a.command, 0);
  assert.equal(a.deadline - a.issuedAt, 1800n);
});

test("wallet: sign-in requests are checked before signing", () => {
  const v = fixture("login-v7.json").valid[0];
  const data = { ...v.typedData, domain: v.domain, message: v.message };
  const expected = {
    origin: v.message.origin,
    deviceId: v.message.deviceId,
    nowSeconds: BigInt(v.message.issuedAt) + 10n,
  };
  assert.equal(checkLoginRequest(data, expected).ok, true);
  assert.equal(
    checkLoginRequest(data, { ...expected, origin: "https://evil.example" }).ok,
    false,
  );
  assert.equal(
    checkLoginRequest(
      { ...data, domain: { ...v.domain, version: "1" } },
      expected,
    ).ok,
    false,
  );
  assert.equal(
    checkLoginRequest(data, {
      ...expected,
      nowSeconds: BigInt(v.message.expiresAt) + 1n,
    }).ok,
    false,
  );
});

test("wallet: ABI fragments match the generated contract ABI", async () => {
  const { mandateWalletAbi, walletFactoryAbi } = await import(
    "../../../packages/schema/src/generated/abi"
  );
  const { applyAdminAbi, walletAbi, factoryAbi } = await import(
    "../src/wallet/chain-abi"
  );
  const strip = (f: {
    name?: string;
    inputs?: readonly unknown[];
    outputs?: readonly unknown[];
  }) =>
    JSON.stringify(
      { name: f.name, inputs: f.inputs, outputs: f.outputs },
      (k, v) =>
        k === "internalType" || (k === "name" && v === "") ? undefined : v,
    );
  const find = (
    abi: readonly { type: string; name?: string }[],
    name: string,
  ) => abi.find((x) => x.type === "function" && x.name === name)!;
  for (const f of [...walletAbi, ...applyAdminAbi])
    assert.equal(strip(f), strip(find(mandateWalletAbi, f.name)), f.name);
  for (const f of factoryAbi)
    assert.equal(strip(f), strip(find(walletFactoryAbi, f.name)), f.name);
});
