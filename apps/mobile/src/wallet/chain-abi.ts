import { parseAbi } from "viem";

// Fragments of the generated ABIs in packages/schema; tests check they match.
export const walletAbi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function frozen() view returns (bool)",
  "function adminNonce() view returns (uint256)",
  "function authorityEpoch() view returns (uint64)",
]);
export const applyAdminAbi = [
  {
    type: "function",
    name: "applyAdmin",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "a",
        type: "tuple",
        components: [
          { name: "command", type: "uint8" },
          { name: "permitId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "issuedAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
        ],
      },
      { name: "ownerSignature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
export const factoryAbi = parseAbi([
  "function walletForOwner(address) view returns (address)",
]);
