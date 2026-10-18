import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CallTemplateSchema,
  InvoiceSchema,
  LoginSchema,
  PermitSchema,
  Uint256,
  WalletDomainSchema,
  walletDomain,
} from "../src/index.js";
import { loadFixture } from "./support/load.js";

const permit = loadFixture("permit-v7.json");
const browser = permit.valid[0].message;
const allowance = permit.valid[1].message;

test("P1-01.T02 invalid amounts reject without coercion", () => {
  for (const bad of [
    "0.5",
    "-1",
    "01",
    "1e6",
    "",
    " 1",
    (1n << 256n).toString(),
  ])
    assert.equal(
      Uint256.safeParse(bad).success,
      false,
      `accepted ${JSON.stringify(bad)}`,
    );
  for (const bad of [500000, 0.5, null])
    assert.equal(Uint256.safeParse(bad).success, false);
  assert.equal(Uint256.parse("200000"), "200000");
  // Nested invalid values must make safeParse return false, never throw.
  for (const bad of ["0.5", "-1", "01", 500000]) {
    assert.equal(
      PermitSchema.safeParse({ ...browser, maxPayment: bad }).success,
      false,
    );
    assert.equal(
      PermitSchema.safeParse({ ...browser, issuedAt: bad }).success,
      false,
    );
  }
});

test("P1-01.T03 unknown fields and null mandatory zeros reject", () => {
  assert.equal(
    PermitSchema.safeParse({ ...browser, extra: "1" }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({ ...browser, depositCap: null }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({ ...browser, templatesHash: null }).success,
    false,
  );
  assert.equal(PermitSchema.safeParse(browser).success, true);
});

test("P1-A01.T02 ALLOWANCE period rules", () => {
  assert.equal(PermitSchema.safeParse(allowance).success, true);
  assert.equal(
    PermitSchema.safeParse({ ...allowance, periodSeconds: 3600 }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({ ...allowance, periodCap: "0" }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({ ...browser, periodCap: "1", periodSeconds: 86400 })
      .success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({
      ...browser,
      expiresAt: (BigInt(browser.startsAt) + 86401n).toString(),
    }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({
      ...allowance,
      expiresAt: (BigInt(allowance.startsAt) + 2592001n).toString(),
    }).success,
    false,
  );
  assert.equal(
    PermitSchema.safeParse({ ...browser, maxPayments: 4, maxActions: 6 })
      .success,
    false,
  );
});

test("P1-W01.T01 only wallet domain 5 on chain 84532 is accepted", () => {
  const good = walletDomain("0x1111111111111111111111111111111111111111");
  assert.equal(WalletDomainSchema.safeParse(good).success, true);
  assert.equal(
    WalletDomainSchema.safeParse({ ...good, version: "4" }).success,
    false,
  );
  assert.equal(
    WalletDomainSchema.safeParse({ ...good, chainId: 8453 }).success,
    false,
  );
  assert.equal(
    WalletDomainSchema.safeParse({
      ...good,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    }).success,
    false,
  );
});

test("P1-W01.T02 Login2 requires deviceId and a short https challenge", () => {
  const login = loadFixture("login-v7.json").valid[0].message;
  assert.equal(LoginSchema.safeParse(login).success, true);
  const { deviceId: _omit, ...v1 } = login;
  assert.equal(LoginSchema.safeParse(v1).success, false);
  assert.equal(
    LoginSchema.safeParse({ ...login, origin: "http://api.mandate.example" })
      .success,
    false,
  );
  assert.equal(
    LoginSchema.safeParse({
      ...login,
      expiresAt: (BigInt(login.issuedAt) + 301n).toString(),
    }).success,
    false,
  );
});

test("P1-A01.T05 Invoice v1 payload without asset rejects under domain 2", () => {
  const invoice = loadFixture("invoice-v7.json").valid[0].message;
  const { asset: _omit, ...v1 } = invoice;
  assert.equal(InvoiceSchema.safeParse(v1).success, false);
  assert.equal(InvoiceSchema.safeParse(invoice).success, true);
});

test("P1-A01.T01 call templates reject banned selectors", () => {
  const template = loadFixture("wallet-policy-v7.json").lists.templates[0];
  assert.equal(CallTemplateSchema.safeParse(template).success, true);
  for (const selector of [
    "0x095ea7b3",
    "0x23b872dd",
    "0xa9059cbb",
    "0xd505accf",
  ])
    assert.equal(
      CallTemplateSchema.safeParse({ ...template, selector }).success,
      false,
      selector,
    );
});
