import type { Address } from "viem";
import appJson from "../../app.json";

// Base Sepolia deployment (deployments/README.md). Consumers fail closed if
// the chain differs.
export const CHAIN_ID = 84532 as const;
export const RPC_URL: string = appJson.expo.extra.rpcUrl;
// Mandate service origin for signed login. Not configured in this build.
export const API_ORIGIN: string | null = appJson.expo.extra.apiOrigin;
export const EXPLORER = "https://sepolia.basescan.org";
// Where the Mandate Test Shop serves its product images; null shows a plain
// placeholder instead.
export const SHOP_ORIGIN: string | null = appJson.expo.extra.shopOrigin;

export const WALLET_FACTORY: Address =
  "0x094875D5656726980016E8712a8A02C96aD382ce";

export interface Token {
  symbol: string;
  name: string;
  // null is native ETH.
  address: Address | null;
  decimals: number;
  note: string;
}

export const TOKENS: readonly Token[] = [
  {
    symbol: "DUSD",
    name: "DemoUSD",
    address: "0xE030717a657E9194bC086A546fb59aDBc631ad7a",
    decimals: 6,
    note: "Base Sepolia",
  },
  {
    symbol: "ETH",
    name: "Ether",
    address: null,
    decimals: 18,
    note: "Test ETH, pays network fees",
  },
  {
    symbol: "USDC",
    name: "USDC",
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    note: "Circle test token",
  },
];

export const MAX_ACCOUNT_INDEX = 19;

// Policy ceilings fixed by the contracts (MandateLimits.sol), in base units of
// a 6-decimal agent asset.
export const POLICY_CEILINGS = {
  perTx: 500_000n,
  daily: 10_000_000n,
  weekly: 25_000_000n,
} as const;

export const AGENT_ASSETS = TOKENS.filter((t) => t.address !== null);
