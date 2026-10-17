import { canonicalize } from "json-canonicalize";
import {
  sha256,
  stringToHex,
  keccak256,
  encodeAbiParameters,
  hashStruct,
  hashTypedData,
  type Address,
  type Hex,
} from "viem";
import {
  PermitSchema,
  ActionSchema,
  ScheduleSchema,
  authorityTypes,
  type Permit,
  type Action,
  type Schedule,
} from "./authority.js";
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
export const canonicalJson = (value: unknown): string => {
  assertJson(value);
  return canonicalize(value);
};
export const hashCanonical = (value: unknown): Hex =>
  sha256(stringToHex(canonicalJson(value)));
export const hashConditions = hashCanonical;
export const hashRunbook = hashCanonical;
function typedValues(
  value: Record<string, unknown>,
  fields: readonly { name: string; type: string }[],
) {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.type.startsWith("uint")
        ? BigInt(value[f.name] as string | number)
        : value[f.name],
    ]),
  );
}
export function hashPermit(value: Permit): Hex {
  const p = PermitSchema.parse(value);
  return hashStruct({
    data: typedValues(p, authorityTypes.Permit),
    primaryType: "Permit",
    types: { Permit: authorityTypes.Permit },
  });
}
export function hashAction(
  value: Action,
  domain: {
    name: "MandateWallet";
    version: "4";
    chainId: 84532;
    verifyingContract: Address;
  },
): Hex {
  const a = ActionSchema.parse(value);
  return hashTypedData({
    domain,
    types: { Action: authorityTypes.Action },
    primaryType: "Action",
    message: typedValues(a, authorityTypes.Action),
  });
}
export function hashRecipients(recipients: readonly Address[]): Hex {
  if (
    recipients.length > 4 ||
    new Set(recipients.map((x) => x.toLowerCase())).size !== recipients.length
  )
    throw new Error("At most four unique recipients");
  const sorted = [...recipients].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  if (sorted.some((v, i) => v.toLowerCase() !== recipients[i]?.toLowerCase()))
    throw new Error("Recipients must be sorted");
  return keccak256(encodeAbiParameters([{ type: "address[]" }], [sorted]));
}
export function hashSchedule(value: Schedule): Hex {
  const s = ScheduleSchema.parse(value);
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple", components: authorityTypes.Schedule }],
      [
        {
          recipient: s.recipient,
          amount: BigInt(s.amount),
          start: BigInt(s.start),
          interval: s.interval,
          window: s.window,
          periods: s.periods,
        },
      ],
    ),
  );
}
