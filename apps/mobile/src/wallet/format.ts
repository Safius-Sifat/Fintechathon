import { formatUnits } from "viem";
import { TOKENS, type Token } from "./config";

// Up to 6 decimals, trailing zeros trimmed, at least 2 decimals.
export function formatAmount(value: bigint, decimals: number): string {
  const [whole, frac = ""] = formatUnits(value, decimals).split(".");
  const cut = frac.slice(0, 6).replace(/0+$/, "");
  return `${Number(whole).toLocaleString("en-US")}.${cut.padEnd(2, "0")}`;
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Accepts the token name ("DemoUSD", "Ether") or symbol ("ETH", "USDC").
export const tokenByName = (key: string): Token => {
  const token = TOKENS.find((t) => t.name === key || t.symbol === key);
  if (!token) throw new Error(`Unknown token ${key}`);
  return token;
};

// Small amounts such as fees: keeps three significant digits so a fee of
// 0.00000031 ETH is not shown as 0.00.
export function formatSmall(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const text = formatUnits(value, decimals);
  const [whole, frac = ""] = text.split(".");
  if (whole !== "0") return formatAmount(value, decimals);
  const lead = frac.search(/[1-9]/);
  return `0.${frac.slice(0, lead + 3).replace(/0+$/, "")}`;
}
