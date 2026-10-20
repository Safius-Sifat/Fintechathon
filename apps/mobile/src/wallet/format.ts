import { formatUnits } from "viem";
import { TOKENS, type Token } from "./config";

// Up to 6 decimals, trailing zeros trimmed, at least 2 decimals.
export function formatAmount(value: bigint, decimals: number): string {
  const [whole, frac = ""] = formatUnits(value, decimals).split(".");
  const cut = frac.slice(0, 6).replace(/0+$/, "");
  return `${Number(whole).toLocaleString("en-US")}.${cut.padEnd(2, "0")}`;
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const tokenByName = (name: string): Token =>
  TOKENS.find((t) => t.name === name) ?? TOKENS[0]!;
