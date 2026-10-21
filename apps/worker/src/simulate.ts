import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { x402Signature, type Action } from "@mandate/schema";

const usdcAbi = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
]);

export type SimulationOutcome =
  | { ok: true; block: string }
  | {
      ok: false;
      code:
        | "SIMULATION_REVERT"
        | "SIMULATION_MISMATCH"
        | "SIMULATION_UNAVAILABLE";
      reason: string;
    };

type SimulatedCall = {
  status: string;
  returnData: Hex;
  error?: { message?: string };
};

// S9.11: one eth_simulateV1 request at `latest` runs the exact `execute`
// registration and then the USDC settlement the facilitator will send, between
// balance and nonce reads. Every call must succeed, the wallet must lose and
// the payee gain exactly the Action amount, and the nonce must be consumed.
export async function simulateX402(
  client: Pick<PublicClient, "request">,
  input: {
    sender: Address;
    wallet: Address;
    asset: Address;
    execute: { to: Address; data: Hex };
    action: Action;
  },
): Promise<SimulationOutcome> {
  const { wallet, asset, action } = input;
  const balance = (who: Address) => ({
    to: asset,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [who],
    }),
  });
  const nonceUsed = {
    to: asset,
    data: encodeFunctionData({
      abi: usdcAbi,
      functionName: "authorizationState",
      args: [wallet, action.requestId],
    }),
  };
  const settle = {
    from: input.sender,
    to: asset,
    data: encodeFunctionData({
      abi: usdcAbi,
      functionName: "transferWithAuthorization",
      args: [
        wallet,
        action.target,
        BigInt(action.amount),
        0n,
        BigInt(action.deadline),
        action.requestId,
        x402Signature(action.requestId, action.permitId),
      ],
    }),
  };
  const calls = [
    balance(wallet),
    balance(action.target),
    { from: input.sender, ...input.execute },
    settle,
    balance(wallet),
    balance(action.target),
    nonceUsed,
  ];
  let result: { number?: Hex; calls: SimulatedCall[] }[];
  try {
    result = (await client.request({
      method: "eth_simulateV1" as never,
      params: [
        { blockStateCalls: [{ calls }], validation: false },
        "latest",
      ] as never,
    })) as typeof result;
  } catch (error) {
    return {
      ok: false,
      code: "SIMULATION_UNAVAILABLE",
      reason: error instanceof Error ? error.message : "eth_simulateV1 failed",
    };
  }
  const out = result?.[0]?.calls;
  if (!Array.isArray(out) || out.length !== calls.length)
    return {
      ok: false,
      code: "SIMULATION_MISMATCH",
      reason: "Malformed eth_simulateV1 response",
    };
  const failed = out.findIndex((c) => c.status !== "0x1");
  if (failed >= 0)
    return {
      ok: false,
      code: "SIMULATION_REVERT",
      reason: `${failed === 2 ? "Registration" : failed === 3 ? "Settlement" : "A read"} reverted: ${out[failed]!.error?.message ?? "no reason"}`,
    };
  try {
    const uint = (i: number) =>
      decodeFunctionResult({
        abi: erc20Abi,
        functionName: "balanceOf",
        data: out[i]!.returnData,
      });
    const [walletBefore, payeeBefore, walletAfter, payeeAfter] = [
      uint(0),
      uint(1),
      uint(4),
      uint(5),
    ];
    const used = decodeFunctionResult({
      abi: usdcAbi,
      functionName: "authorizationState",
      data: out[6]!.returnData,
    });
    const amount = BigInt(action.amount);
    if (
      walletBefore - walletAfter !== amount ||
      payeeAfter - payeeBefore !== amount ||
      used !== true
    )
      return {
        ok: false,
        code: "SIMULATION_MISMATCH",
        reason:
          "The simulated settlement did not move exactly the Action amount",
      };
  } catch {
    return {
      ok: false,
      code: "SIMULATION_MISMATCH",
      reason: "Unreadable simulated balances",
    };
  }
  return { ok: true, block: String(result[0]!.number ?? "latest") };
}
