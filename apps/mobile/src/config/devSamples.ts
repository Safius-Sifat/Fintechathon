import type { TxState } from "./txStatus";

// DEVELOPMENT SAMPLES. Placeholder records that let the detail layouts be
// reviewed before any real history or token data exists. Screens show them
// only when __DEV__ is true, and always with a "Development sample" label.
// They are not transactions, balances or verified token metadata: addresses
// and hashes are words, not hex, so they cannot pass for real values.

export interface SampleActivity {
  id: string;
  source: "personal" | "agent";
  title: string;
  direction: "sent" | "received";
  state: TxState;
  asset: "ETH" | "DemoUSD";
  amount: string;
  fee: string;
  feePayer: string;
  from: string;
  to: string;
  nonce: string;
  replaces: string | null;
  dataSource: string;
}

export const SAMPLE_ACTIVITY: readonly SampleActivity[] = [
  {
    id: "sample-1",
    source: "personal",
    title: "Sent ETH",
    direction: "sent",
    state: "SUBMITTED",
    asset: "ETH",
    amount: "1.00",
    fee: "0.0001 ETH",
    feePayer: "Personal account, in ETH",
    from: "Sample personal account",
    to: "Sample recipient address",
    nonce: "Sample nonce 4",
    replaces: null,
    dataSource: "Local transaction journal (sample)",
  },
  {
    id: "sample-2",
    source: "personal",
    title: "Received DemoUSD",
    direction: "received",
    state: "FINALIZED",
    asset: "DemoUSD",
    amount: "25.00",
    fee: "Paid by the sender",
    feePayer: "Sender",
    from: "Sample sender address",
    to: "Sample personal account",
    nonce: "Not applicable (received)",
    replaces: null,
    dataSource: "Chain RPC, verified (sample)",
  },
  {
    id: "sample-3",
    source: "personal",
    title: "Sent ETH",
    direction: "sent",
    state: "REPLACED",
    asset: "ETH",
    amount: "0.50",
    fee: "0.0001 ETH",
    feePayer: "Personal account, in ETH",
    from: "Sample personal account",
    to: "Sample recipient address",
    nonce: "Sample nonce 3",
    replaces: "Replaced by a faster sample version",
    dataSource: "Local transaction journal (sample)",
  },
  {
    id: "sample-4",
    source: "agent",
    title: "Owner transfer",
    direction: "sent",
    state: "REVERTED",
    asset: "DemoUSD",
    amount: "10.00",
    fee: "0.0002 ETH",
    feePayer: "Personal account, in ETH",
    from: "Sample agent wallet",
    to: "Sample personal account",
    nonce: "Sample owner-transfer nonce 1",
    replaces: null,
    dataSource: "Chain RPC, verified (sample)",
  },
  {
    id: "sample-5",
    source: "agent",
    title: "Agent payment",
    direction: "sent",
    state: "UNKNOWN",
    asset: "DemoUSD",
    amount: "2.00",
    fee: "Not known yet",
    feePayer: "Agent executor, in ETH",
    from: "Sample agent wallet",
    to: "Sample service provider",
    nonce: "Sample executor nonce 9",
    replaces: null,
    dataSource: "Indexer assertion, not verified (sample)",
  },
];

export function findSample(id: string): SampleActivity | undefined {
  return SAMPLE_ACTIVITY.find((sample) => sample.id === id);
}
