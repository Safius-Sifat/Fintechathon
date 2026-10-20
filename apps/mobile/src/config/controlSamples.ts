import type { ControlStep } from "./ownerControl";

// Development sample for the owner control screen, shown only in __DEV__
// builds and always labelled. A recovery is a sequence of separate
// transactions, each with its own state. No step is confirmed: this build
// never shows an agent as stopped or funds as recovered.

export interface SampleRecoveryStep {
  title: string;
  step: ControlStep | "remains";
  feePayer: string;
  note: string;
}

export const SAMPLE_RECOVERY_STEPS: readonly SampleRecoveryStep[] = [
  {
    title: "Pause agents",
    step: "submitted",
    feePayer: "Your personal account",
    note: "Agents are not stopped until this is confirmed.",
  },
  {
    title: "Recover liquid DemoUSD",
    step: "signed",
    feePayer: "Independent sender",
    note: "Exported for a sender you chose. Nothing has moved.",
  },
  {
    title: "Vault position",
    step: "remains",
    feePayer: "None",
    note: "The vault cannot redeem now. This position stays in the agent wallet.",
  },
];
