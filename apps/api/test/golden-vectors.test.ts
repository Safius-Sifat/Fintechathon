import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  abiEncodeStruct,
  AddressSchema,
  buildTypedData,
  hashDigest,
  hashDomain,
  hashStructOf,
  recoverSigner,
  SignatureSchema,
  typedDataJson,
  type SignedType,
} from "@mandate/schema";
import { hashTypedData, recoverTypedDataAddress } from "viem";
import { z } from "zod";

// Only the fixture envelope is described here; authority validation/types come from schema.
const FixtureSchema = z.object({
  primaryType: z.string(),
  valid: z
    .array(
      z.object({
        id: z.string(),
        message: z.record(z.unknown()),
        domain: z.record(z.unknown()),
        typedData: z.unknown().optional(),
        structHash: z.string(),
        domainSeparator: z.string(),
        digest: z.string(),
        abiEncoded: z.string(),
        signer: AddressSchema,
        signature: SignatureSchema,
      }),
    )
    .nonempty(),
  invalid: z
    .array(
      z.object({
        id: z.string(),
        expect: z.enum(["SCHEMA_REJECT", "DOMAIN_REJECT", "SIGNER_MISMATCH"]),
        message: z.record(z.unknown()),
        domain: z.record(z.unknown()),
        types: z
          .record(z.array(z.object({ name: z.string(), type: z.string() })))
          .optional(),
      }),
    )
    .nonempty(),
});

const fixtures = [
  ["login-v7.json", "Login"],
  ["owner-transfer-v7.json", "OwnerTransfer"],
  ["admin-v7.json", "Admin"],
  ["action-v7.json", "Action"],
] as const satisfies readonly (readonly [string, SignedType])[];

for (const [file, primaryType] of fixtures) {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL(`../../../packages/schema/fixtures/${file}`, import.meta.url),
      "utf8",
    ),
  );
  const fixture = FixtureSchema.parse(raw);
  assert.equal(fixture.primaryType, primaryType, `${file} primary type`);
  const [original] = fixture.valid;

  for (const vector of fixture.valid) {
    test(`P2 parity ${file}/${vector.id}: exact digest, typed data and supplied signer`, async () => {
      assert.equal(
        hashStructOf(primaryType, vector.message),
        vector.structHash,
      );
      assert.equal(
        hashDomain(primaryType, vector.domain),
        vector.domainSeparator,
      );
      assert.equal(
        hashDigest(primaryType, vector.message, vector.domain),
        vector.digest,
      );
      assert.equal(
        hashTypedData(
          buildTypedData(primaryType, vector.message, vector.domain),
        ),
        vector.digest,
      );
      assert.equal(
        abiEncodeStruct(primaryType, vector.message),
        vector.abiEncoded,
      );
      if (vector.typedData !== undefined) {
        assert.deepEqual(
          typedDataJson(primaryType, vector.message, vector.domain),
          vector.typedData,
        );
      }
      assert.equal(
        await recoverSigner(
          primaryType,
          vector.message,
          vector.domain,
          vector.signature,
        ),
        vector.signer,
      );
    });
  }

  for (const vector of fixture.invalid) {
    test(`P2 parity ${file}/${vector.id}: ${vector.expect}`, async () => {
      if (
        vector.expect === "SCHEMA_REJECT" ||
        vector.expect === "DOMAIN_REJECT"
      ) {
        assert.throws(() =>
          buildTypedData(primaryType, vector.message, vector.domain),
        );
        assert.throws(() =>
          hashDigest(primaryType, vector.message, vector.domain),
        );
        await assert.rejects(() =>
          recoverSigner(
            primaryType,
            vector.message,
            vector.domain,
            original.signature,
          ),
        );
        return;
      }
      if (vector.types) {
        // Field-order counterexamples intentionally use the fixture's noncanonical types.
        const mutated = {
          ...buildTypedData(primaryType, vector.message, vector.domain),
          types: vector.types,
        };
        assert.notEqual(hashTypedData(mutated), original.digest);
        assert.notEqual(
          await recoverTypedDataAddress({
            ...mutated,
            signature: original.signature,
          }),
          original.signer,
        );
        return;
      }
      assert.notEqual(
        hashDigest(primaryType, vector.message, vector.domain),
        original.digest,
      );
      assert.notEqual(
        await recoverSigner(
          primaryType,
          vector.message,
          vector.domain,
          original.signature,
        ),
        original.signer,
      );
    });
  }
}
