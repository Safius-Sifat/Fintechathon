import { z } from "zod";
import { isAddress, type Address, type Hex } from "viem";
export const AddressSchema = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), "Invalid EVM address")
  .transform((v) => v as Address);
export const Hex32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((v) => v.toLowerCase() as Hex);
export const SignatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/)
  .transform((v) => v as Hex);
export const uint = (bits: number) =>
  z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .refine((v) => BigInt(v) < 1n << BigInt(bits), `uint${bits} overflow`);
export const Uint256 = uint(256),
  Uint64 = uint(64),
  Uint32 = z.number().int().min(0).max(4294967295);
export const PermitSchema = z
  .object({
    taskId: Hex32Schema,
    executor: AddressSchema,
    kind: z.number().int().min(0).max(2),
    runbookHash: Hex32Schema,
    conditionsHash: Hex32Schema,
    recipientsHash: Hex32Schema,
    scheduleHash: Hex32Schema,
    issuedAt: Uint64,
    startsAt: Uint64,
    expiresAt: Uint64,
    epoch: Uint64,
    nonce: Uint256,
    maxActions: Uint32,
    maxPayments: Uint32,
    maxPayment: Uint256,
    spendCap: Uint256,
    liquidFloor: Uint256,
    depositCap: Uint256,
    withdrawCap: Uint256,
  })
  .strict();
export const ActionSchema = z
  .object({
    permitId: Hex32Schema,
    requestId: Hex32Schema,
    operation: z.number().int().min(0).max(4),
    target: AddressSchema,
    amount: Uint256,
    minOutput: Uint256,
    invoiceId: Hex32Schema,
    inputHash: Hex32Schema,
    period: Uint32,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict();
export const ScheduleSchema = z
  .object({
    recipient: AddressSchema,
    amount: Uint256,
    start: Uint64,
    interval: Uint32,
    window: Uint32,
    periods: Uint32,
  })
  .strict();
export const AdminSchema = z
  .object({
    command: z.number().int().min(0).max(4),
    permitId: Hex32Schema,
    nonce: Uint256,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict();
export const InvoiceSchema = z
  .object({
    invoiceId: Hex32Schema,
    taskId: Hex32Schema,
    wallet: AddressSchema,
    recipient: AddressSchema,
    amount: Uint256,
    inputHash: Hex32Schema,
    issuedAt: Uint64,
    expiresAt: Uint64,
  })
  .strict();
export const DeliveryReceiptSchema = z
  .object({
    invoiceId: Hex32Schema,
    requestId: Hex32Schema,
    inputHash: Hex32Schema,
    resultHash: Hex32Schema,
    paymentTxHash: Hex32Schema,
    completedAt: Uint64,
  })
  .strict();
export const LoginSchema = z
  .object({
    origin: z.string().url(),
    nonce: Hex32Schema,
    issuedAt: Uint64,
    expiresAt: Uint64,
  })
  .strict();
export type Permit = z.infer<typeof PermitSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Admin = z.infer<typeof AdminSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type DeliveryReceipt = z.infer<typeof DeliveryReceiptSchema>;
export const authorityTypes = {
  Permit: [
    ["taskId", "bytes32"],
    ["executor", "address"],
    ["kind", "uint8"],
    ["runbookHash", "bytes32"],
    ["conditionsHash", "bytes32"],
    ["recipientsHash", "bytes32"],
    ["scheduleHash", "bytes32"],
    ["issuedAt", "uint64"],
    ["startsAt", "uint64"],
    ["expiresAt", "uint64"],
    ["epoch", "uint64"],
    ["nonce", "uint256"],
    ["maxActions", "uint32"],
    ["maxPayments", "uint32"],
    ["maxPayment", "uint256"],
    ["spendCap", "uint256"],
    ["liquidFloor", "uint256"],
    ["depositCap", "uint256"],
    ["withdrawCap", "uint256"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  Action: [
    ["permitId", "bytes32"],
    ["requestId", "bytes32"],
    ["operation", "uint8"],
    ["target", "address"],
    ["amount", "uint256"],
    ["minOutput", "uint256"],
    ["invoiceId", "bytes32"],
    ["inputHash", "bytes32"],
    ["period", "uint32"],
    ["issuedAt", "uint64"],
    ["deadline", "uint64"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  Schedule: [
    ["recipient", "address"],
    ["amount", "uint256"],
    ["start", "uint64"],
    ["interval", "uint32"],
    ["window", "uint32"],
    ["periods", "uint32"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  Admin: [
    ["command", "uint8"],
    ["permitId", "bytes32"],
    ["nonce", "uint256"],
    ["issuedAt", "uint64"],
    ["deadline", "uint64"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  Invoice: [
    ["invoiceId", "bytes32"],
    ["taskId", "bytes32"],
    ["wallet", "address"],
    ["recipient", "address"],
    ["amount", "uint256"],
    ["inputHash", "bytes32"],
    ["issuedAt", "uint64"],
    ["expiresAt", "uint64"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  DeliveryReceipt: [
    ["invoiceId", "bytes32"],
    ["requestId", "bytes32"],
    ["inputHash", "bytes32"],
    ["resultHash", "bytes32"],
    ["paymentTxHash", "bytes32"],
    ["completedAt", "uint64"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
  Login: [
    ["origin", "string"],
    ["nonce", "bytes32"],
    ["issuedAt", "uint64"],
    ["expiresAt", "uint64"],
  ].map(([name, type]) => ({ name: name!, type: type! })),
} as const;
// Structural validation only; contract/policy semantic rules are Person1/2 deliverables.
