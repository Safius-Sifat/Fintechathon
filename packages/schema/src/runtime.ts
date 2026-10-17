export const CHAIN_ID = 84532 as const;
export const DOMAIN_VERSION = "4" as const;
export const EVIDENCE_SCHEMA_VERSION = 4 as const;
export const IMPLEMENTATION_STATUS = "bootstrap" as const;
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented. See docs/plans/.`);
    this.name = "NotImplementedError";
  }
}
