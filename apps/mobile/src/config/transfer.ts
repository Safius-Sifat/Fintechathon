// Transfer form choices. Personal sends and agent-wallet (managed) sends are
// different operations: the second is an owner transfer that pauses the
// agent wallet and ends its active permissions.

export type TransferSource = "personal" | "agent";
export type TransferAsset = "DemoUSD" | "ETH" | "USDC";

export const SOURCE_LABELS: Record<TransferSource, string> = {
  personal: "Personal account",
  agent: "Agent wallet",
};

export const FEE_PAYER: Record<TransferSource, string> = {
  personal: "Your personal account, in ETH",
  agent: "Sponsor or your personal account (unavailable)",
};
