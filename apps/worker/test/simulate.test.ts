import test from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, type Hex } from "viem";
import { BASE_SEPOLIA_USDC, type Action } from "@mandate/schema";
import { simulateX402 } from "../src/simulate.js";

const WALLET = "0x7777777777777777777777777777777777777777" as Hex;
const PAYEE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const action: Action = {
  permitId: ("0x" + "56".repeat(32)) as Hex,
  requestId: ("0x" + "34".repeat(32)) as Hex,
  operation: 6,
  target: PAYEE,
  amount: "200000",
  minOutput: "0",
  invoiceId: ("0x" + "12".repeat(32)) as Hex,
  inputHash: ("0x" + "0b".repeat(32)) as Hex,
  period: 0,
  issuedAt: "1700000000",
  deadline: "1700000050",
};
const word = (v: bigint) => encodeAbiParameters([{ type: "uint256" }], [v]);
const ok = (data: Hex) => ({ status: "0x1", returnData: data });

function client(calls: unknown[] | Error) {
  const seen: unknown[] = [];
  return {
    seen,
    request: async (args: unknown) => {
      seen.push(args);
      if (calls instanceof Error) throw calls;
      return [{ number: "0x64", calls }];
    },
  };
}

const input = {
  sender: "0x1111111111111111111111111111111111111111" as Hex,
  wallet: WALLET,
  asset: BASE_SEPOLIA_USDC,
  execute: { to: WALLET, data: "0xabcdef" as Hex },
  action,
};

const good = [
  ok(word(1_000_000n)),
  ok(word(0n)),
  ok("0x"),
  ok("0x"),
  ok(word(800_000n)),
  ok(word(200_000n)),
  ok(word(1n)),
];

test("simulate: registration plus settlement that moves exactly the amount passes", async () => {
  const c = client(good);
  const out = await simulateX402(c as never, input);
  assert.equal(out.ok, true);
  const params = (
    c.seen[0] as {
      params: [{ blockStateCalls: { calls: unknown[] }[] }, string];
    }
  ).params;
  assert.equal(params[1], "latest");
  assert.equal(params[0].blockStateCalls[0]!.calls.length, 7);
});

test("simulate: a reverted settlement, a wrong amount or an unused nonce fail", async () => {
  const reverted = [...good];
  reverted[3] = {
    status: "0x0",
    returnData: "0x",
    error: { message: "FiatTokenV2: invalid signature" },
  } as never;
  const r = await simulateX402(client(reverted) as never, input);
  assert.deepEqual(r.ok ? null : [r.code, r.reason.startsWith("Settlement")], [
    "SIMULATION_REVERT",
    true,
  ]);

  const short = [...good];
  short[5] = ok(word(100_000n));
  const m = await simulateX402(client(short) as never, input);
  assert.equal(m.ok ? null : m.code, "SIMULATION_MISMATCH");

  const unused = [...good];
  unused[6] = ok(word(0n));
  const u = await simulateX402(client(unused) as never, input);
  assert.equal(u.ok ? null : u.code, "SIMULATION_MISMATCH");
});

test("simulate: an RPC without eth_simulateV1 reports unavailable, never success", async () => {
  const out = await simulateX402(
    client(new Error("method not found")) as never,
    input,
  );
  assert.equal(out.ok ? null : out.code, "SIMULATION_UNAVAILABLE");
});
