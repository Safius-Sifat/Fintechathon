import { z } from "zod";
import { zeroAddress } from "viem";
import {
  AddressSchema,
  big,
  Hex32Schema,
  NonZeroAddressSchema,
  Uint256,
  Uint32,
  Uint64,
  uintNumber,
} from "./primitives.js";
import { WalletPolicySchema, policyTypes } from "./policy.js";

export const Kind = {
  BROWSER: 0,
  LIQUIDITY: 1,
  SCHEDULE: 2,
  ALLOWANCE: 3,
} as const;
export const Operation = {
  PAY: 0,
  TRANSFER: 1,
  DEPOSIT: 2,
  WITHDRAW: 3,
  CLOSE: 4,
  CALL: 5,
  X402: 6,
} as const;
export const AdminCommand = {
  PAUSE: 0,
  UNPAUSE: 1,
  REVOKE: 2,
  RECOVER: 3,
  RECOVER_LIQUID: 4,
  FREEZE: 5,
  UNFREEZE: 6,
} as const;

export const DAY_SECONDS = 86400n;
export const WEEK_SECONDS = 604800n;
export const MAX_PERMIT_SECONDS = DAY_SECONDS;
export const MAX_ALLOWANCE_SECONDS = 30n * DAY_SECONDS;
export const MAX_ACTION_SECONDS = 900n; // co-signed Actions; others are limited to 60s by policy
export const MAX_ADMIN_SECONDS = 1800n;
export const MAX_OWNER_TRANSFER_SECONDS = 600n;
export const MAX_LOGIN_SECONDS = 300n;

export const PermitSchema = z
  .object({
    taskId: Hex32Schema,
    executor: NonZeroAddressSchema,
    kind: uintNumber(3),
    asset: NonZeroAddressSchema,
    runbookHash: Hex32Schema,
    conditionsHash: Hex32Schema,
    recipientsHash: Hex32Schema,
    scheduleHash: Hex32Schema,
    templatesHash: Hex32Schema,
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
    reviewThreshold: Uint256,
    periodCap: Uint256,
    periodSeconds: Uint32,
  })
  .strict()
  .superRefine((p, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const allowance = p.kind === Kind.ALLOWANCE;
    const life = big(p.expiresAt) - big(p.startsAt);
    if (big(p.startsAt) < big(p.issuedAt))
      issue("startsAt must not precede issuedAt");
    if (life <= 0n) issue("expiresAt must follow startsAt");
    if (life > (allowance ? MAX_ALLOWANCE_SECONDS : MAX_PERMIT_SECONDS))
      issue("Permit lifetime exceeds its kind limit");
    if (p.maxActions > (allowance ? 200 : 20))
      issue("maxActions exceeds its kind limit");
    if (p.maxPayments > p.maxActions)
      issue("maxPayments must not exceed maxActions");
    if (p.kind === Kind.BROWSER && p.maxPayments > 3)
      issue("Browser Permit allows at most 3 payments");
    if (allowance) {
      if (p.periodSeconds !== 86400 && p.periodSeconds !== 604800)
        issue("ALLOWANCE periodSeconds must be 86400 or 604800");
      if (big(p.periodCap) === 0n)
        issue("ALLOWANCE periodCap must be positive");
    } else if (p.periodSeconds !== 0 || p.periodCap !== "0") {
      issue(
        "periodCap and periodSeconds must be zero unless kind is ALLOWANCE",
      );
    }
  });

export const ActionSchema = z
  .object({
    permitId: Hex32Schema,
    requestId: Hex32Schema,
    operation: uintNumber(6),
    target: AddressSchema,
    amount: Uint256,
    minOutput: Uint256,
    invoiceId: Hex32Schema,
    inputHash: Hex32Schema,
    period: Uint32,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict()
  .refine(
    (a) => big(a.deadline) > big(a.issuedAt),
    "deadline must follow issuedAt",
  )
  .refine(
    (a) => big(a.deadline) - big(a.issuedAt) <= MAX_ACTION_SECONDS,
    "Action lifetime exceeds 15 minutes",
  );

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
export const ZERO_SCHEDULE = {
  recipient: zeroAddress,
  amount: "0",
  start: "0",
  interval: 0,
  window: 0,
  periods: 0,
} as const;

export const AdminSchema = z
  .object({
    command: uintNumber(6),
    permitId: Hex32Schema,
    nonce: Uint256,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict()
  .refine(
    (a) => big(a.deadline) > big(a.issuedAt),
    "deadline must follow issuedAt",
  )
  .refine(
    (a) => big(a.deadline) - big(a.issuedAt) <= MAX_ADMIN_SECONDS,
    "Admin lifetime exceeds 30 minutes",
  );

export const OwnerTransferSchema = z
  .object({
    transferId: Hex32Schema,
    asset: AddressSchema, // zero address means native ETH
    recipient: NonZeroAddressSchema,
    amount: Uint256,
    epoch: Uint64,
    nonce: Uint256,
    issuedAt: Uint64,
    deadline: Uint64,
  })
  .strict()
  .refine((t) => big(t.amount) > 0n, "amount must be positive")
  .refine(
    (t) => big(t.deadline) > big(t.issuedAt),
    "deadline must follow issuedAt",
  )
  .refine(
    (t) => big(t.deadline) - big(t.issuedAt) <= MAX_OWNER_TRANSFER_SECONDS,
    "OwnerTransfer lifetime exceeds 10 minutes",
  );

export const ApprovalSchema = z
  .object({ actionDigest: Hex32Schema, expiresAt: Uint64 })
  .strict();

export const InvoiceSchema = z
  .object({
    invoiceId: Hex32Schema,
    taskId: Hex32Schema,
    wallet: NonZeroAddressSchema,
    asset: NonZeroAddressSchema,
    recipient: NonZeroAddressSchema,
    amount: Uint256,
    inputHash: Hex32Schema,
    issuedAt: Uint64,
    expiresAt: Uint64,
  })
  .strict()
  .refine(
    (i) => big(i.expiresAt) > big(i.issuedAt),
    "expiresAt must follow issuedAt",
  )
  .refine(
    (i) => big(i.expiresAt) - big(i.issuedAt) <= MAX_ACTION_SECONDS,
    "Invoice lifetime exceeds 15 minutes",
  );

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
    origin: z.string().url().startsWith("https://"),
    nonce: Hex32Schema,
    deviceId: Hex32Schema,
    issuedAt: Uint64,
    expiresAt: Uint64,
  })
  .strict()
  .refine(
    (l) => big(l.expiresAt) > big(l.issuedAt),
    "expiresAt must follow issuedAt",
  )
  .refine(
    (l) => big(l.expiresAt) - big(l.issuedAt) <= MAX_LOGIN_SECONDS,
    "Login challenge lifetime exceeds 5 minutes",
  );

export type Permit = z.infer<typeof PermitSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Admin = z.infer<typeof AdminSchema>;
export type OwnerTransfer = z.infer<typeof OwnerTransferSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type DeliveryReceipt = z.infer<typeof DeliveryReceiptSchema>;
export type Login = z.infer<typeof LoginSchema>;

const f = (entries: readonly (readonly [string, string])[]) =>
  entries.map(([name, type]) => ({ name, type }));
// EIP-712 field order and types are fixed by architecture S3. Do not reorder.
export const authorityTypes = {
  Permit: f([
    ["taskId", "bytes32"],
    ["executor", "address"],
    ["kind", "uint8"],
    ["asset", "address"],
    ["runbookHash", "bytes32"],
    ["conditionsHash", "bytes32"],
    ["recipientsHash", "bytes32"],
    ["scheduleHash", "bytes32"],
    ["templatesHash", "bytes32"],
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
    ["reviewThreshold", "uint256"],
    ["periodCap", "uint256"],
    ["periodSeconds", "uint32"],
  ]),
  Action: f([
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
  ]),
  Schedule: f([
    ["recipient", "address"],
    ["amount", "uint256"],
    ["start", "uint64"],
    ["interval", "uint32"],
    ["window", "uint32"],
    ["periods", "uint32"],
  ]),
  Admin: f([
    ["command", "uint8"],
    ["permitId", "bytes32"],
    ["nonce", "uint256"],
    ["issuedAt", "uint64"],
    ["deadline", "uint64"],
  ]),
  OwnerTransfer: f([
    ["transferId", "bytes32"],
    ["asset", "address"],
    ["recipient", "address"],
    ["amount", "uint256"],
    ["epoch", "uint64"],
    ["nonce", "uint256"],
    ["issuedAt", "uint64"],
    ["deadline", "uint64"],
  ]),
  Approval: f([
    ["actionDigest", "bytes32"],
    ["expiresAt", "uint64"],
  ]),
  WalletPolicy: policyTypes.WalletPolicy,
  Invoice: f([
    ["invoiceId", "bytes32"],
    ["taskId", "bytes32"],
    ["wallet", "address"],
    ["asset", "address"],
    ["recipient", "address"],
    ["amount", "uint256"],
    ["inputHash", "bytes32"],
    ["issuedAt", "uint64"],
    ["expiresAt", "uint64"],
  ]),
  DeliveryReceipt: f([
    ["invoiceId", "bytes32"],
    ["requestId", "bytes32"],
    ["inputHash", "bytes32"],
    ["resultHash", "bytes32"],
    ["paymentTxHash", "bytes32"],
    ["completedAt", "uint64"],
  ]),
  Login: f([
    ["origin", "string"],
    ["nonce", "bytes32"],
    ["deviceId", "bytes32"],
    ["issuedAt", "uint64"],
    ["expiresAt", "uint64"],
  ]),
};

export const signedSchemas = {
  Permit: PermitSchema,
  Action: ActionSchema,
  Admin: AdminSchema,
  OwnerTransfer: OwnerTransferSchema,
  Approval: ApprovalSchema,
  WalletPolicy: WalletPolicySchema,
  Invoice: InvoiceSchema,
  DeliveryReceipt: DeliveryReceiptSchema,
  Login: LoginSchema,
} as const;
export type SignedType = keyof typeof signedSchemas;
export type SignedMessage<T extends SignedType> = z.infer<
  (typeof signedSchemas)[T]
>;
