import {
  decodeEventLog,
  erc20Abi,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
} from "viem";

// The parts of a public client this check needs, so tests can pass a fake.
export interface ChainReader {
  getTransactionReceipt(args: { hash: Hash }): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[];
  }>;
  getBlockNumber(): Promise<bigint>;
}

export interface PaidInvoice {
  invoiceId: Hex;
  wallet: Address;
  asset: Address;
  recipient: Address;
  amount: string;
  inputHash: Hex;
}

export type PaymentCheck =
  | { state: "PAID"; blockNumber: bigint }
  | { state: "PENDING"; reason: string }
  | { state: "INVALID"; reason: string };

const actionEvent = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const REQUIRED_CONFIRMATIONS = 3n;

// A payment counts only when the wallet's PAY for exactly this invoice and the
// matching token transfer are in a successful transaction with three
// confirmations (P4-02). A hash alone, or an unrelated transfer, is not enough.
export async function checkPayment(
  chain: ChainReader,
  invoice: PaidInvoice,
  requestId: Hex,
  txHash: Hash,
): Promise<PaymentCheck> {
  const receipt = await chain
    .getTransactionReceipt({ hash: txHash })
    .catch(() => null);
  if (!receipt)
    return { state: "PENDING", reason: "The payment is not in a block yet" };
  if (receipt.status !== "success")
    return { state: "INVALID", reason: "The payment reverted" };

  let paid = false;
  let transferred = false;
  for (const log of receipt.logs) {
    if (same(log.address, invoice.wallet)) {
      try {
        const ev = decodeEventLog({
          abi: actionEvent,
          data: log.data,
          topics: log.topics as never,
        });
        const a = ev.args;
        if (
          a.requestId.toLowerCase() === requestId.toLowerCase() &&
          a.operation === 0 &&
          same(a.asset, invoice.asset) &&
          same(a.target, invoice.recipient) &&
          a.assets === BigInt(invoice.amount) &&
          a.invoiceId.toLowerCase() === invoice.invoiceId.toLowerCase() &&
          a.inputHash.toLowerCase() === invoice.inputHash.toLowerCase()
        )
          paid = true;
      } catch {
        // Not an ActionExecuted log.
      }
    }
    if (same(log.address, invoice.asset)) {
      try {
        const ev = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics as never,
        });
        if (
          ev.eventName === "Transfer" &&
          same(ev.args.from, invoice.wallet) &&
          same(ev.args.to, invoice.recipient) &&
          ev.args.value === BigInt(invoice.amount)
        )
          transferred = true;
      } catch {
        // Not a Transfer log.
      }
    }
  }
  if (!paid || !transferred)
    return {
      state: "INVALID",
      reason: "The transaction does not pay this invoice",
    };
  const depth = (await chain.getBlockNumber()) - receipt.blockNumber + 1n;
  if (depth < REQUIRED_CONFIRMATIONS)
    return {
      state: "PENDING",
      reason: `${depth} of ${REQUIRED_CONFIRMATIONS} confirmations`,
    };
  return { state: "PAID", blockNumber: receipt.blockNumber };
}
