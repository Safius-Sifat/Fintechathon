import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  authorityTypes,
  policyTypes,
  transferWithAuthorizationTypes,
} from "../src/index.js";

const encodeType = (
  name: string,
  fields: readonly { name: string; type: string }[],
) => `${name}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;

test("P1-01.T01 Solidity EIP-712 type strings equal the TypeScript schema", () => {
  const sol = readFileSync(
    resolve(import.meta.dirname, "../../contracts/src/MandateHashes.sol"),
    "utf8",
  );
  const found = new Set(
    [...sol.matchAll(/keccak256\(\s*"([A-Za-z0-9]+\([^"]*\))"\s*\)/g)].map(
      (m) => m[1],
    ),
  );
  const expected = [
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    encodeType(
      "TransferWithAuthorization",
      transferWithAuthorizationTypes.TransferWithAuthorization,
    ),
    ...(
      [
        "Permit",
        "Action",
        "Admin",
        "OwnerTransfer",
        "Approval",
        "WalletPolicy",
        "Invoice",
        "DeliveryReceipt",
        "Login",
      ] as const
    ).map((t) => encodeType(t, authorityTypes[t])),
  ];
  for (const e of expected)
    assert.ok(found.has(e), `MandateHashes.sol is missing or differs: ${e}`);
});

test("P1-01.T01 Solidity struct field order equals the TypeScript schema", () => {
  const sol = readFileSync(
    resolve(import.meta.dirname, "../../contracts/src/MandateTypes.sol"),
    "utf8",
  );
  const structs = new Map(
    [...sol.matchAll(/struct\s+(\w+)\s*\{([^}]*)\}/g)].map((m) => [
      m[1]!,
      m[2]!
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\s+/g, " ")),
    ]),
  );
  for (const t of [
    "Permit",
    "Action",
    "Schedule",
    "Admin",
    "OwnerTransfer",
    "Approval",
    "WalletPolicy",
    "Invoice",
    "DeliveryReceipt",
    "Login",
  ] as const)
    assert.deepEqual(
      structs.get(t),
      authorityTypes[t].map((f) => `${f.type} ${f.name}`),
      t,
    );
  assert.deepEqual(
    structs.get("CallTemplate"),
    policyTypes.CallTemplate.map((f) => `${f.type} ${f.name}`),
    "CallTemplate",
  );
});
