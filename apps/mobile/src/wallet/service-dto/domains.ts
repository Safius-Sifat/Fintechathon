// Mobile runtime mirror of packages/schema. Schema imports are test-only.
import { z } from "zod";
import { zeroAddress, type Address } from "viem";
import { NonZeroAddressSchema } from "./primitives";
import {
  CHAIN_ID,
  DELIVERY_DOMAIN_VERSION,
  INVOICE_DOMAIN_VERSION,
  LOGIN_DOMAIN_VERSION,
  WALLET_DOMAIN_VERSION,
} from "./runtime";

// Domains are built from trusted constants plus a verified wallet address.
// Parsing rejects any other name/version/chain, so a v4 payload cannot be
// relabelled as v5 at a boundary.
const contractDomain = <N extends string, V extends string>(
  name: N,
  version: V,
) =>
  z
    .object({
      name: z.literal(name),
      version: z.literal(version),
      chainId: z.literal(CHAIN_ID),
      verifyingContract: NonZeroAddressSchema,
    })
    .strict();
export const WalletDomainSchema = contractDomain(
  "MandateWallet",
  WALLET_DOMAIN_VERSION,
);
export const InvoiceDomainSchema = contractDomain(
  "MandateInvoice",
  INVOICE_DOMAIN_VERSION,
);
export const DeliveryDomainSchema = contractDomain(
  "MandateDelivery",
  DELIVERY_DOMAIN_VERSION,
);
export const LoginDomainSchema = z
  .object({
    name: z.literal("MandateLogin"),
    version: z.literal(LOGIN_DOMAIN_VERSION),
    chainId: z.literal(CHAIN_ID),
    verifyingContract: z.literal(zeroAddress),
  })
  .strict();
export type WalletDomain = z.infer<typeof WalletDomainSchema>;
export type InvoiceDomain = z.infer<typeof InvoiceDomainSchema>;
export type DeliveryDomain = z.infer<typeof DeliveryDomainSchema>;
export type LoginDomain = z.infer<typeof LoginDomainSchema>;
export type MandateDomain =
  | WalletDomain
  | InvoiceDomain
  | DeliveryDomain
  | LoginDomain;

export const walletDomain = (wallet: Address): WalletDomain =>
  WalletDomainSchema.parse({
    name: "MandateWallet",
    version: WALLET_DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: wallet,
  });
export const invoiceDomain = (wallet: Address): InvoiceDomain =>
  InvoiceDomainSchema.parse({
    name: "MandateInvoice",
    version: INVOICE_DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: wallet,
  });
export const deliveryDomain = (wallet: Address): DeliveryDomain =>
  DeliveryDomainSchema.parse({
    name: "MandateDelivery",
    version: DELIVERY_DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: wallet,
  });
export const loginDomain = (): LoginDomain =>
  LoginDomainSchema.parse({
    name: "MandateLogin",
    version: LOGIN_DOMAIN_VERSION,
    chainId: CHAIN_ID,
    verifyingContract: zeroAddress,
  });
