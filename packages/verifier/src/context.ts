import { OrderDeliverySchema, type EvidenceBundle } from "@mandate/schema";
import {
  createPublicClient,
  decodeEventLog,
  http,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

export interface ReceiptFact {
  status: "success" | "reverted";
  blockNumber: bigint;
  to: Address | null;
  logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[];
}

// Facts read from Base Sepolia through the caller's own RPC, never from the
// bundle or the Mandate service.
export interface ChainFacts {
  latestBlock: bigint;
  walletOwner: Address | null;
  receipts: Map<string, ReceiptFact | null>;
  anchorReceipt: ReceiptFact | null;
}

export interface VerifyContext {
  // Ed25519 evidence key from the separately trusted deployment manifest.
  trustedEvidenceKey: Hex | null;
  chain: ChainFacts | null;
}

export interface ChainReader {
  getBlockNumber(): Promise<bigint>;
  getTransactionReceipt(args: { hash: Hash }): Promise<ReceiptFact>;
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: "owner";
  }): Promise<unknown>;
}

const ownerAbi = parseAbi(["function owner() view returns (address)"]);

export function rpcReader(url: string): ChainReader {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(url),
  }) as unknown as ChainReader;
}

export async function readChainFacts(
  bundle: EvidenceBundle,
  chain: ChainReader,
): Promise<ChainFacts> {
  const receipt = (hash: string) =>
    chain.getTransactionReceipt({ hash: hash as Hash }).catch(() => null);
  // The wallet's own transactions, plus the x402 settlements that shop
  // orders name, which a facilitator submits outside the wallet.
  const hashes = [
    ...new Set(
      [
        ...bundle.transactions.map((t) => (t as { txHash?: string }).txHash),
        ...orderDeliveries(bundle).map((o) => o.receipt.paymentTxHash),
      ]
        .filter((h): h is string => typeof h === "string")
        .map((h) => h.toLowerCase()),
    ),
  ];
  const [latestBlock, walletOwner, anchorReceipt, ...receipts] =
    await Promise.all([
      chain.getBlockNumber(),
      chain
        .readContract({
          address: bundle.manifest.wallet,
          abi: ownerAbi,
          functionName: "owner",
        })
        .then((o) => o as Address)
        .catch(() => null),
      bundle.manifest.anchorTxHash
        ? receipt(bundle.manifest.anchorTxHash)
        : Promise.resolve(null),
      ...hashes.map(receipt),
    ]);
  return {
    latestBlock: latestBlock as bigint,
    walletOwner: walletOwner as Address | null,
    anchorReceipt: anchorReceipt as ReceiptFact | null,
    receipts: new Map(
      hashes.map((h, i) => [
        h.toLowerCase(),
        receipts[i] as ReceiptFact | null,
      ]),
    ),
  };
}

export const REQUIRED_CONFIRMATIONS = 3n;

// A recorded delivery sits in its event's payload, or under `delivery`.
export const deliveryPayloads = (bundle: EvidenceBundle) =>
  bundle.events.map(
    (e) => (e.payload as { delivery?: unknown }).delivery ?? e.payload,
  );

export const orderDeliveries = (bundle: EvidenceBundle) =>
  deliveryPayloads(bundle).flatMap((p) => {
    const order = OrderDeliverySchema.safeParse(p);
    return order.success ? [order.data] : [];
  });

const actionAbi = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
]);

export interface ExecutedAction {
  requestId: Hex;
  operation: number;
  asset: Address;
  target: Address;
  assets: bigint;
  invoiceId: Hex;
  inputHash: Hex;
}

// The wallet's ActionExecuted events inside one receipt.
export function executedActions(
  receipt: ReceiptFact,
  wallet: Address,
): ExecutedAction[] {
  const out: ExecutedAction[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== wallet.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({
        abi: actionAbi,
        data: log.data,
        topics: log.topics as never,
      });
      out.push({
        requestId: ev.args.requestId,
        operation: ev.args.operation,
        asset: ev.args.asset,
        target: ev.args.target,
        assets: ev.args.assets,
        invoiceId: ev.args.invoiceId,
        inputHash: ev.args.inputHash,
      });
    } catch {
      // Another event.
    }
  }
  return out;
}
