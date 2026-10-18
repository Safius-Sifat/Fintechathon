import { test } from "node:test";
import assert from "node:assert/strict";
import { hashTypedData, recoverTypedDataAddress, type Hex } from "viem";
import {
  abiEncodeStruct,
  hashDigest,
  hashDomain,
  hashStructOf,
  recoverSigner,
  type SignedType,
} from "../src/index.js";
import { ACCOUNTS, buildVectors } from "../scripts/vectors.js";
import { loadFixture } from "./support/load.js";

const SIGNED = [
  "permit-v7.json",
  "action-v7.json",
  "admin-v7.json",
  "owner-transfer-v7.json",
  "approval-v7.json",
  "wallet-policy-v7.json",
  "invoice-v7.json",
  "delivery-v7.json",
  "login-v7.json",
];
const KNOWN_SIGNERS = new Set(Object.values(ACCOUNTS).map((a) => a.address));

test("P1-A01.T01 committed fixtures equal freshly generated vectors", async () => {
  const fresh = JSON.parse(JSON.stringify(await buildVectors()));
  for (const [name, value] of Object.entries(fresh))
    assert.deepEqual(
      loadFixture(name),
      value,
      `${name} is stale; run pnpm --filter @mandate/schema vectors`,
    );
});

test("P1-01.T01 valid vectors: hashes recompute and signatures recover the public fixture signer", async () => {
  for (const file of SIGNED) {
    const v = loadFixture(file);
    const t = v.primaryType as SignedType;
    for (const c of v.valid) {
      assert.equal(
        hashStructOf(t, c.message),
        c.structHash,
        `${file}/${c.id} structHash`,
      );
      assert.equal(
        hashDomain(t, c.domain),
        c.domainSeparator,
        `${file}/${c.id} domain`,
      );
      assert.equal(
        hashDigest(t, c.message, c.domain),
        c.digest,
        `${file}/${c.id} digest`,
      );
      assert.equal(
        abiEncodeStruct(t, c.message),
        c.abiEncoded,
        `${file}/${c.id} abi`,
      );
      assert.ok(
        KNOWN_SIGNERS.has(c.signer),
        `${file}/${c.id} signer is a public fixture key`,
      );
      assert.equal(
        await recoverSigner(t, c.message, c.domain, c.signature),
        c.signer,
        `${file}/${c.id} recover`,
      );
    }
  }
});

test("P1-01.T04 counterexamples reject or fail to recover the authorized signer", async () => {
  for (const file of SIGNED) {
    const v = loadFixture(file);
    const t = v.primaryType as SignedType;
    const { signature, signer } = v.valid[0];
    for (const c of v.invalid) {
      const label = `${file}/${c.id}`;
      if (c.expect === "SCHEMA_REJECT" || c.expect === "DOMAIN_REJECT") {
        assert.throws(() => hashDigest(t, c.message, c.domain), label);
      } else if (c.types) {
        const digest = hashTypedData({
          domain: c.domain,
          types: c.types,
          primaryType: t,
          message: c.message,
        } as never);
        assert.notEqual(digest, v.valid[0].digest, label);
        const recovered = await recoverTypedDataAddress({
          domain: c.domain,
          types: c.types,
          primaryType: t,
          message: c.message,
          signature: signature as Hex,
        } as never);
        assert.notEqual(recovered, signer, label);
      } else {
        assert.notEqual(
          hashDigest(t, c.message, c.domain),
          v.valid[0].digest,
          label,
        );
        assert.notEqual(
          await recoverSigner(t, c.message, c.domain, signature),
          signer,
          label,
        );
      }
    }
  }
});

test("P1-W01.T04 public mnemonic derives the known Anvil addresses; passphrase changes them", () => {
  const a = loadFixture("accounts-v7.json");
  assert.deepEqual(
    a.noPassphrase.map((x: { address: string }) => x.address),
    [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ],
  );
  assert.equal(a.noPassphrase[0].path, "m/44'/60'/0'/0/0");
  assert.notEqual(
    a.withPassphrase.accounts[0].address,
    a.noPassphrase[0].address,
  );
  assert.notEqual(
    a.withPassphrase.accounts[0].address,
    a.withPassphrase.accounts[1].address,
  );
});
