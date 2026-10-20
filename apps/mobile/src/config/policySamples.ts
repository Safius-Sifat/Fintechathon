import type { CompiledIntent } from "../state/intentDraft";
import type {
  OutstandingAuthorization,
  PolicySnapshot,
} from "../state/policyDraft";

// Development samples for the wallet policy and intent screens, shown only
// in __DEV__ builds and always labelled. They are not a policy, an
// authorization or a compiler result. Providers are named, never given an
// address.

export const SAMPLE_POLICY_VERSION = 3;

export const SAMPLE_CURRENT_POLICY: PolicySnapshot = {
  caps: {
    DemoUSD: { perTx: 500_000n, daily: 10_000_000n, weekly: 25_000_000n },
    USDC: { perTx: 500_000n, daily: 5_000_000n, weekly: 20_000_000n },
  },
  allowlist: ["a", "b"],
  blocklist: [],
  reviewThreshold: 300_000n,
};

// x402 payments authorized but not yet settled. The first was above the
// review threshold and approved by the owner.
export const SAMPLE_AUTHORIZATIONS: readonly OutstandingAuthorization[] = [
  {
    id: "sample-x402-1",
    recipient: "a",
    asset: "USDC",
    amount: 400_000n,
    ownerApproved: true,
  },
  {
    id: "sample-x402-2",
    recipient: "b",
    asset: "USDC",
    amount: 200_000n,
    ownerApproved: false,
  },
];

export const SAMPLE_INTENT: CompiledIntent = {
  label: "Development sample",
  goal: "Check that the staging checkout loads and shows the right title. Spend at most 1 DemoUSD.",
  runbookId: "browser-check",
  input: { targetId: "checkout-healthy", checks: ["pageLoad", "title"] },
  explanation:
    "A browser check of the healthy staging checkout: the page loads and its title matches. Up to two paid attempts, at most 1.00 DemoUSD in total.",
  warnings: [
    "Your goal did not name a provider. The draft allows Provider A only.",
    "Your goal did not mention approvals. Payments above 0.25 DemoUSD would wait for you.",
  ],
  terms: {
    asset: "DemoUSD",
    lifetimeMinutes: "60",
    maxActions: "3",
    maxPayments: "2",
    maxPayment: "0.50",
    spendCap: "1.00",
    liquidFloor: "3.00",
    reviewThreshold: "0.25",
    providerIds: ["a"],
  },
};
