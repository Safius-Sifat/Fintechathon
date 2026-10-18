import { z } from "zod";
import { LoginDomainSchema } from "./domains.js";
import { LoginSchema } from "./authority.js";
import {
  AddressSchema,
  Hex32Schema,
  SignatureSchema,
  Uint64,
  UuidSchema,
} from "./primitives.js";

// S8.5 / S8.6 owner sessions. deviceId identifies an installation, not hardware.
export const AuthChallengeRequestSchema = z
  .object({ ownerAddress: AddressSchema, deviceId: Hex32Schema })
  .strict();
export const AuthChallengeResponseSchema = z
  .object({
    challengeId: UuidSchema,
    typedData: z
      .object({
        types: z.record(
          z.array(z.object({ name: z.string(), type: z.string() }).strict()),
        ),
        primaryType: z.literal("Login"),
        domain: LoginDomainSchema,
        message: LoginSchema,
      })
      .strict(),
  })
  .strict();
export const AuthVerifyRequestSchema = z
  .object({ challengeId: UuidSchema, signature: SignatureSchema })
  .strict();
const opaqueToken = z.string().min(32).max(4096);
export const AuthTokensSchema = z
  .object({
    accessToken: opaqueToken,
    expiresAt: Uint64,
    sessionId: UuidSchema,
    refreshToken: opaqueToken,
    refreshExpiresAt: Uint64,
  })
  .strict();
export const AuthRefreshRequestSchema = z
  .object({ sessionId: UuidSchema, refreshToken: opaqueToken })
  .strict();
export const SessionViewSchema = z
  .object({
    sessionId: UuidSchema,
    deviceId: Hex32Schema,
    deviceLabel: z.string().max(64), // untrusted display text
    createdAt: Uint64,
    lastUsedAt: Uint64,
    expiresAt: Uint64,
    revoked: z.boolean(),
    current: z.boolean(),
  })
  .strict();
export const SessionRevokeRequestSchema = z
  .object({
    sessionIds: z.union([z.array(UuidSchema).min(1), z.literal("ALL")]),
  })
  .strict();

export type SessionView = z.infer<typeof SessionViewSchema>;
