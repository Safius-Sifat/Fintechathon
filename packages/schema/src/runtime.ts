export const CHAIN_ID = 84532 as const;
export const DOCUMENTATION_VERSION = "7.0" as const;
export const WALLET_DOMAIN_VERSION = "5" as const;
export const LOGIN_DOMAIN_VERSION = "2" as const;
export const INVOICE_DOMAIN_VERSION = "2" as const;
export const DELIVERY_DOMAIN_VERSION = "1" as const;
export const EVIDENCE_SCHEMA_VERSION = 4 as const;
export const IMPLEMENTATION_STATUS = "w0-schema" as const;
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented. See docs/plans/.`);
    this.name = "NotImplementedError";
  }
}
