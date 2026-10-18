import { canonicalize } from "json-canonicalize";
import {
  domainSeparator,
  encodeAbiParameters,
  getTypesForEIP712Domain,
  hashStruct,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  sha256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  authorityTypes,
  signedSchemas,
  ScheduleSchema,
  type SignedType,
} from "./authority.js";
import {
  DeliveryDomainSchema,
  InvoiceDomainSchema,
  LoginDomainSchema,
  WalletDomainSchema,
  type MandateDomain,
} from "./domains.js";
import { AddressSchema, Hex32Schema, ZERO_HASH } from "./primitives.js";
import {
  AssetCapSchema,
  CallTemplateSchema,
  MAX_POLICY_LIST,
  MAX_POLICY_TEMPLATES,
  WalletPolicyListsSchema,
  policyTypes,
} from "./policy.js";
import { ConditionsSchema, RunbookManifestSchema } from "./conditions.js";

type Field = { name: string; type: string };

function assertJson(value: unknown, seen = new Set<object>(), depth = 0): void {
  if (depth > 100) throw new Error("Canonical JSON nesting limit exceeded");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new Error("Use integer numbers or decimal strings");
    return;
  }
  if (typeof value !== "object")
    throw new Error("Canonical value must be JSON");
  if (seen.has(value)) throw new Error("Cyclic JSON");
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("Expected plain JSON object");
  seen.add(value);
  for (const item of Object.values(value)) assertJson(item, seen, depth + 1);
  seen.delete(value);
}
// RFC 8785 canonical JSON and SHA-256 commitment (S3 "other hashes").
export const canonicalJson = (value: unknown): string => {
  assertJson(value);
  return canonicalize(value);
};
export const hashCanonical = (value: unknown): Hex =>
  sha256(stringToHex(canonicalJson(value)));
export const hashConditions = (value: unknown): Hex =>
  hashCanonical(ConditionsSchema.parse(value));
export const hashRunbook = (value: unknown): Hex =>
  hashCanonical(RunbookManifestSchema.parse(value));

const domainSchemas = {
  Permit: WalletDomainSchema,
  Action: WalletDomainSchema,
  Admin: WalletDomainSchema,
  OwnerTransfer: WalletDomainSchema,
  Approval: WalletDomainSchema,
  WalletPolicy: WalletDomainSchema,
  Invoice: InvoiceDomainSchema,
  DeliveryReceipt: DeliveryDomainSchema,
  Login: LoginDomainSchema,
} as const;

const uintBits = (type: string) =>
  type.startsWith("uint") ? Number(type.slice(4)) : 0;
// EIP-712 encoding takes bigint for every uint.
function typedValues(value: Record<string, unknown>, fields: readonly Field[]) {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      uintBits(f.type)
        ? BigInt(value[f.name] as string | number)
        : value[f.name],
    ]),
  );
}
// ABI encoding takes number for uint8..uint48 and bigint above.
function abiValues(value: Record<string, unknown>, fields: readonly Field[]) {
  return Object.fromEntries(
    fields.map((f) => {
      const bits = uintBits(f.type);
      const v = value[f.name];
      return [
        f.name,
        bits === 0 ? v : bits <= 48 ? Number(v) : BigInt(v as string | number),
      ];
    }),
  );
}

function parseSigned<T extends SignedType>(
  primaryType: T,
  message: unknown,
  domain: unknown,
) {
  const parsed = signedSchemas[primaryType].parse(message) as Record<
    string,
    unknown
  >;
  const parsedDomain = domainSchemas[primaryType].parse(
    domain,
  ) as MandateDomain;
  const fields = authorityTypes[primaryType];
  return { parsed, parsedDomain, fields };
}

/** viem-ready typed data. Message and domain are validated; never infer the domain from payload. */
export function buildTypedData<T extends SignedType>(
  primaryType: T,
  message: unknown,
  domain: unknown,
) {
  const { parsed, parsedDomain, fields } = parseSigned(
    primaryType,
    message,
    domain,
  );
  return {
    domain: parsedDomain,
    types: { [primaryType]: fields } as Record<string, Field[]>,
    primaryType,
    message: typedValues(parsed, fields),
  };
}

/** JSON-safe typed data (uints as decimal strings) for native signers and fixtures. */
export function typedDataJson<T extends SignedType>(
  primaryType: T,
  message: unknown,
  domain: unknown,
) {
  const { parsed, parsedDomain, fields } = parseSigned(
    primaryType,
    message,
    domain,
  );
  return {
    types: {
      EIP712Domain: getTypesForEIP712Domain({ domain: parsedDomain }),
      [primaryType]: fields,
    },
    primaryType,
    domain: parsedDomain,
    message: parsed,
  };
}

export function hashStructOf<T extends SignedType>(
  primaryType: T,
  message: unknown,
): Hex {
  const parsed = signedSchemas[primaryType].parse(message) as Record<
    string,
    unknown
  >;
  const fields = authorityTypes[primaryType];
  return hashStruct({
    data: typedValues(parsed, fields),
    primaryType,
    types: { [primaryType]: fields } as Record<string, Field[]>,
  });
}

export function hashDigest<T extends SignedType>(
  primaryType: T,
  message: unknown,
  domain: unknown,
): Hex {
  return hashTypedData(
    buildTypedData(primaryType, message, domain) as Parameters<
      typeof hashTypedData
    >[0],
  );
}

export function hashDomain(primaryType: SignedType, domain: unknown): Hex {
  return domainSeparator({
    domain: domainSchemas[primaryType].parse(domain) as MandateDomain,
  });
}

export async function recoverSigner<T extends SignedType>(
  primaryType: T,
  message: unknown,
  domain: unknown,
  signature: Hex,
): Promise<Address> {
  const typed = buildTypedData(primaryType, message, domain);
  return recoverTypedDataAddress({ ...typed, signature } as Parameters<
    typeof recoverTypedDataAddress
  >[0]);
}

/** permitId is the Permit struct hash (no domain). */
export const hashPermit = (permit: unknown): Hex =>
  hashStructOf("Permit", permit);
/** Domain-separated Action digest that the executor signs. */
export const hashAction = (action: unknown, domain: unknown): Hex =>
  hashDigest("Action", action, domain);

function requireSortedUnique(keys: string[], label: string) {
  for (let i = 1; i < keys.length; i++)
    if (keys[i - 1]! >= keys[i]!)
      throw new Error(`${label} must be sorted ascending and unique`);
}

/** keccak256(abi.encode(address[])) over ≤4 sorted unique recipients. Noncanonical input rejects. */
export function hashRecipients(recipients: readonly string[]): Hex {
  if (recipients.length > 4) throw new Error("At most four recipients");
  return hashAddressList(recipients, 4, "Recipients");
}

/** WalletPolicy allowlist/blocklist hash; empty list hashes the empty array encoding. */
export function hashAddressList(
  addresses: readonly string[],
  max = MAX_POLICY_LIST,
  label = "Address list",
): Hex {
  if (addresses.length > max)
    throw new Error(`${label} exceeds ${max} entries`);
  const parsed = addresses.map((a) => AddressSchema.parse(a));
  requireSortedUnique(
    parsed.map((a) => a.toLowerCase()),
    label,
  );
  return keccak256(encodeAbiParameters([{ type: "address[]" }], [parsed]));
}

/** Permit.templatesHash: sorted unique template IDs; zero hash when none. */
export function hashTemplateIds(ids: readonly string[]): Hex {
  if (ids.length === 0) return ZERO_HASH;
  if (ids.length > MAX_POLICY_TEMPLATES)
    throw new Error(`At most ${MAX_POLICY_TEMPLATES} templates`);
  const parsed = ids.map((id) => Hex32Schema.parse(id));
  requireSortedUnique(parsed, "Template IDs");
  return keccak256(encodeAbiParameters([{ type: "bytes32[]" }], [parsed]));
}

export function hashAssetCaps(caps: readonly unknown[]): Hex {
  const parsed = caps.map((c) => AssetCapSchema.parse(c));
  requireSortedUnique(
    parsed.map((c) => c.asset.toLowerCase()),
    "AssetCaps",
  );
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple[]", components: policyTypes.AssetCap }],
      [parsed.map((c) => abiValues(c, policyTypes.AssetCap))],
    ),
  );
}

/** WalletPolicy.templatesHash: full CallTemplate structs sorted by templateId. */
export function hashCallTemplates(templates: readonly unknown[]): Hex {
  if (templates.length > MAX_POLICY_TEMPLATES)
    throw new Error(`At most ${MAX_POLICY_TEMPLATES} templates`);
  const parsed = templates.map((t) => CallTemplateSchema.parse(t));
  requireSortedUnique(
    parsed.map((t) => t.templateId),
    "CallTemplates",
  );
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple[]", components: policyTypes.CallTemplate }],
      [parsed.map((t) => abiValues(t, policyTypes.CallTemplate))],
    ),
  );
}

export function hashWalletPolicyLists(lists: unknown) {
  const l = WalletPolicyListsSchema.parse(lists);
  return {
    assetCapsHash: hashAssetCaps(l.assetCaps),
    allowlistHash: hashAddressList(l.allowlist, MAX_POLICY_LIST, "Allowlist"),
    blocklistHash: hashAddressList(l.blocklist, MAX_POLICY_LIST, "Blocklist"),
    templatesHash: hashCallTemplates(l.templates),
  };
}

/** keccak256(abi.encode(Schedule)); non-schedule Permits use ZERO_SCHEDULE. */
export function hashSchedule(value: unknown): Hex {
  const s = ScheduleSchema.parse(value);
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple", components: authorityTypes.Schedule }],
      [abiValues(s, authorityTypes.Schedule)],
    ),
  );
}

/** abi.encode of a signed struct, for Solidity golden-vector tests. */
export function abiEncodeStruct<T extends SignedType>(
  primaryType: T,
  message: unknown,
): Hex {
  const parsed = signedSchemas[primaryType].parse(message) as Record<
    string,
    unknown
  >;
  const fields = authorityTypes[primaryType];
  return encodeAbiParameters(
    [{ type: "tuple", components: fields as Field[] }],
    [abiValues(parsed, fields) as never],
  );
}
