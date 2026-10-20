import { formatAgentAmount, parseAgentAmount } from "../domain/amounts";

// Fixed S2 ceilings, in base units of one agent asset (six decimals). The
// owner's wallet policy and each permission can only tighten them. The
// shared schema does not export the amount ceilings, so they are copied
// here and a test checks them against Person1's MandateLimits.sol.

export const CEILINGS = {
  perPayment: 500_000n,
  taskSpend: 2_000_000n,
  walletDay: 10_000_000n,
  walletWeek: 25_000_000n,
  liquidFloor: 3_000_000n,
  allowanceActions: 200,
  allowanceDays: 30,
  policyList: 32,
  policyTemplates: 8,
} as const;

// Result of checking a form. fieldErrors holds problems with what was
// typed; missing names required fields that are still empty.
export interface FormCheck<K extends string> {
  fieldErrors: Partial<Record<K, string>>;
  missing: string[];
  complete: boolean;
}

export function formCheck<K extends string>(
  fieldErrors: Partial<Record<K, string>>,
  missing: string[],
): FormCheck<K> {
  return {
    fieldErrors,
    missing,
    complete: missing.length === 0 && Object.keys(fieldErrors).length === 0,
  };
}

export interface AmountCheck {
  units: bigint | null;
  error: string | null;
}

// Empty text is not an error here; callers list it as missing.
export function checkAmount(
  text: string,
  assetLabel: string,
  ceiling: bigint | null,
): AmountCheck {
  if (text.trim() === "") return { units: null, error: null };
  const units = parseAgentAmount(text);
  if (units === null)
    return {
      units: null,
      error: "Use digits with up to six decimals, like 0.25",
    };
  if (units === 0n) return { units, error: "Enter more than 0" };
  if (ceiling !== null && units > ceiling)
    return {
      units,
      error: `Above the ${formatAgentAmount(ceiling)} ${assetLabel} limit`,
    };
  return { units, error: null };
}

export function checkCount(
  text: string,
  max: number,
  unit: string,
): { value: number | null; error: string | null } {
  if (text.trim() === "") return { value: null, error: null };
  if (!/^\d+$/.test(text.trim()))
    return { value: null, error: "Use whole numbers only" };
  const value = Number(text.trim());
  if (value < 1) return { value, error: `At least 1 ${unit}` };
  if (value > max) return { value, error: `At most ${max} ${unit}s` };
  return { value, error: null };
}
