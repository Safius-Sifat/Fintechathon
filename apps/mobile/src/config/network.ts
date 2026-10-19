import appJson from "../../app.json";

// The chain ID comes from app.json so there is a single source of truth.
const CHAIN_NAMES: Record<number, string> = {
  84532: "Base Sepolia",
};

const chainId: number = appJson.expo.extra.chainId;

export const network = {
  chainId,
  name: CHAIN_NAMES[chainId] ?? "Unknown network",
  isTestnet: chainId === 84532,
} as const;
