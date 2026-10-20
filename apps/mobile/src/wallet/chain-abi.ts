import { parseAbi } from "viem";
import {
  ASSET_CAP_COMPONENTS,
  CALL_TEMPLATE_COMPONENTS,
  OWNER_TRANSFER_TYPES,
  PERMIT_TYPES,
  WALLET_POLICY_TYPES,
} from "./typed";

// Fragments of the generated ABIs in packages/schema; tests check they match.
export const walletAbi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function frozen() view returns (bool)",
  "function adminNonce() view returns (uint256)",
  "function authorityEpoch() view returns (uint64)",
  "function ownerTransferNonce() view returns (uint256)",
  "function policyNonce() view returns (uint256)",
  "function assetCap(address asset) view returns (uint256 perTx, uint256 daily, uint256 weekly, bool set)",
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
  "function createWallet(address owner) returns (address wallet)",
]);

export const ownerAbi = [
  {
    type: "function",
    name: "applyOwnerTransfer",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "t",
        type: "tuple",
        components: OWNER_TRANSFER_TYPES.OwnerTransfer,
      },
      { name: "ownerSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "applyWalletPolicy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: WALLET_POLICY_TYPES.WalletPolicy,
      },
      { name: "caps", type: "tuple[]", components: ASSET_CAP_COMPONENTS },
      { name: "allowlist", type: "address[]" },
      { name: "blocklist", type: "address[]" },
      {
        name: "templates",
        type: "tuple[]",
        components: CALL_TEMPLATE_COMPONENTS,
      },
      { name: "ownerSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "walletPolicy",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "", type: "tuple", components: WALLET_POLICY_TYPES.WalletPolicy },
    ],
  },
] as const;

// Events read for the agent wallet's recent history.
export const walletEvents = parseAbi([
  "event ActionExecuted(bytes32 indexed permitId, bytes32 indexed requestId, uint8 operation, address asset, address target, uint256 assets, uint256 shares, bytes32 invoiceId, bytes32 inputHash, bytes32 actionDigest, bool ownerApproved)",
  "event OwnerTransferExecuted(bytes32 indexed transferId, address indexed asset, address indexed recipient, uint256 amount, uint64 newEpoch, bytes32 transferDigest)",
  "event WalletPaused(bool paused, uint64 epoch)",
  "event WalletFrozen(bool frozen)",
  "event WalletPolicyUpdated(uint64 version, bytes32 policyDigest)",
  "event PermitActivated(bytes32 indexed permitId, bytes32 indexed taskId, address executor, uint64 epoch)",
]);

// Read the activated asset from the Permit: Action itself carries no asset.
export const permitStateAbi = [
  {
    type: "function",
    name: "getPermit",
    stateMutability: "view",
    inputs: [{ name: "permitId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "permit", type: "tuple", components: PERMIT_TYPES.Permit },
          { name: "activated", type: "bool" },
          { name: "closed", type: "bool" },
          { name: "revoked", type: "bool" },
          { name: "grossSpend", type: "uint256" },
          { name: "paymentCount", type: "uint32" },
          { name: "actionCount", type: "uint32" },
          { name: "depositedAssets", type: "uint256" },
          { name: "withdrawnAssets", type: "uint256" },
        ],
      },
    ],
  },
] as const;
