// Exact amounts for the two agent assets only (plan S2: DemoUSD and test
// USDC, both six decimals), used by the agent policy, task and allowance
// forms. Text is parsed straight into integer base units, never through
// floating point. Do not use it for ETH, imported tokens or personal sends:
// that validation (decimals per token, balances, EIP-55) belongs to P3-W02
// and is not built.
//
// Pure TypeScript with no React Native imports, so Node tests can load it.

export const AGENT_ASSET_DECIMALS = 6;

const AMOUNT = /^(\d+)(?:\.(\d{1,6}))?$/;

// "0.5" -> 500000n. Returns null for empty text, signs, exponents, commas
// or more than six decimals.
export function parseAgentAmount(text: string): bigint | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) return null;
  const whole = match[1]!;
  const fraction = (match[2] ?? "").padEnd(AGENT_ASSET_DECIMALS, "0");
  return BigInt(whole + fraction);
}

// 500000n -> "0.50". At least two decimals; no trailing zeros beyond them.
export function formatAgentAmount(units: bigint): string {
  const digits = units.toString().padStart(AGENT_ASSET_DECIMALS + 1, "0");
  const whole = digits.slice(0, -AGENT_ASSET_DECIMALS);
  const fraction = digits
    .slice(-AGENT_ASSET_DECIMALS)
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${whole}.${fraction}`;
}
