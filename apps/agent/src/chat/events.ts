// Events the chat agent streams to the Mandate API, one JSON object per line.
// Money facts in them (prices, task IDs) come from the shop and the API,
// never from model text.

export type Product = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  colors: string[];
  sizes: string[];
  price: string;
  description: string;
  image: string;
};

export type ChatEvent =
  | { type: "text_delta"; text: string }
  | {
      type: "step";
      id: string;
      label: string;
      state: "started" | "done" | "failed";
      detail?: string;
    }
  | { type: "products"; note: string; products: Product[] }
  | { type: "question"; question: string; options: string[] }
  | {
      type: "purchase";
      taskId: string;
      product: Product;
      size: string | null;
      amount: string;
    }
  | {
      type: "task";
      taskId: string;
      runbookId: string;
      label: string;
      // The task's input, which the owner's phone needs to propose limits.
      input: Record<string, unknown>;
    }
  | { type: "agent"; text: string }
  | { type: "error"; message: string };

export type Emit = (event: ChatEvent) => void;

// 6-decimal token units as a short amount: "450000" → "0.45".
export function usdc(units: string): string {
  const v = BigInt(units);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${frac.padEnd(2, "0")}`;
}

// "0.45" → "450000"; null for anything that is not a plain amount.
export function units(amount: string): string | null {
  const m = /^(\d{1,6})(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!m) return null;
  return (
    BigInt(m[1]!) * 1_000_000n +
    BigInt((m[2] ?? "").padEnd(6, "0"))
  ).toString();
}
