import { z } from "zod";
import {
  CHAIN_ID,
  LOGIN_DOMAIN_VERSION,
  INVOICE_DOMAIN_VERSION,
  WALLET_DOMAIN_VERSION,
} from "./runtime.js";
import { RunbookManifestSchema, TargetIdSchema } from "./conditions.js";
import { ProviderSchema } from "./provider.js";
import { AgentAssetSchema, TokenRegistryEntrySchema } from "./assets.js";
import { Ed25519PublicKeySchema } from "./evidence.js";
import {
  AddressSchema,
  Hex32Schema,
  NonZeroAddressSchema,
  Uint64,
  UuidSchema,
} from "./primitives.js";

export const ContractRefSchema = z
  .object({
    address: NonZeroAddressSchema,
    deploymentBlock: Uint64,
    codeHash: Hex32Schema,
  })
  .strict();

const httpsUrl = z.string().url().startsWith("https://");

export const DeploymentManifestSchema = z
  .object({
    schemaVersion: z.literal(4),
    walletDomainVersion: z.literal(WALLET_DOMAIN_VERSION),
    loginDomainVersion: z.literal(LOGIN_DOMAIN_VERSION),
    invoiceDomainVersion: z.literal(INVOICE_DOMAIN_VERSION),
    chainId: z.literal(CHAIN_ID),
    sourceTag: z.string().min(1).max(128),
    contracts: z
      .object({
        factory: ContractRefSchema,
        token: ContractRefSchema,
        vault: ContractRefSchema,
        anchor: ContractRefSchema,
        walletImplementation: z.null(),
      })
      .strict(),
    providers: z.array(ProviderSchema).min(1).max(3),
    targets: z
      .array(
        z
          .object({
            targetId: TargetIdSchema,
            url: httpsUrl,
            expectedTitle: z.string().min(1).max(256),
          })
          .strict(),
      )
      .min(1),
    origins: z.object({ api: httpsUrl, provider: httpsUrl }).strict(),
    mpc: z
      .object({
        engine: z.literal("mpcium"),
        commit: z.string().regex(/^[0-9a-f]{40}$/),
        thresholdConfig: z.literal(1),
        nodeCount: z.literal(3),
        requiredParticipants: z.literal(2),
        deploymentMode: z.literal("competition-poc-single-vm-three-containers"),
        initiatorPublicKey: Ed25519PublicKeySchema,
        authorizerPublicKey: Ed25519PublicKeySchema,
      })
      .strict(),
    evidence: z
      .object({
        ed25519PublicKey: Ed25519PublicKeySchema,
        publisher: NonZeroAddressSchema,
      })
      .strict(),
    runbooks: z.array(RunbookManifestSchema).min(1),
    supportedTokens: z.array(TokenRegistryEntrySchema),
    agentAssets: z.array(AgentAssetSchema).min(1).max(4),
    screening: z
      .object({ listId: z.literal("demo-screening-v1"), listHash: Hex32Schema })
      .strict(),
    riskRules: z
      .object({ version: z.literal("risk-rules-v1"), hash: Hex32Schema })
      .strict(),
    x402: z
      .object({
        mode: z.enum(["MANDATE_NATIVE", "ERC1271"]),
        facilitator: httpsUrl.nullable(),
        gatePassed: z.boolean(),
      })
      .strict()
      .refine(
        (x) => x.mode !== "ERC1271" || x.gatePassed,
        "ERC1271 mode requires gate X402-G to have passed",
      ),
    agent: z
      .object({
        runtime: z.literal("openai-agents-sdk"),
        sdkVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
        model: z.string().min(1).max(64),
        mcpToolsetHash: Hex32Schema,
      })
      .strict(),
    dependencyPins: z.record(z.string().min(1).max(256)),
  })
  .strict()
  .superRefine((m, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    if (!unique(m.supportedTokens.map((t) => t.address)))
      issue("supportedTokens addresses must be unique");
    if (!unique(m.agentAssets.map((a) => a.address)))
      issue("agentAssets addresses must be unique");
    if (
      !m.agentAssets.some(
        (a) =>
          a.address === m.contracts.token.address &&
          a.codeHash === m.contracts.token.codeHash,
      )
    )
      issue(
        "agentAssets must include the deployed DemoUSD token with its code hash",
      );
    if (!unique(m.providers.map((p) => p.providerId)))
      issue("providerId values must be unique");
  });

// Per-wallet mapping checked against the factory and the signed Permit (S1).
export const WalletMappingSchema = z
  .object({
    walletId: UuidSchema,
    owner: AddressSchema,
    walletAddress: NonZeroAddressSchema,
    deploymentBlock: Uint64,
    codeHash: Hex32Schema,
    mpcWalletId: z.string().min(1).max(128),
    executorAddress: NonZeroAddressSchema,
    executorPublicKey: z.string().regex(/^0x04[0-9a-fA-F]{128}$/),
    keyVersion: z.number().int().min(1),
  })
  .strict();

export type DeploymentManifest = z.infer<typeof DeploymentManifestSchema>;
export type WalletMapping = z.infer<typeof WalletMappingSchema>;
