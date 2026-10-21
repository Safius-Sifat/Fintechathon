// Sends wallet limits and stop commands through the Mandate service relay,
// which pays the fee and records the policy it checks tasks against. The phone
// builds and signs the message itself; the service's draft must hash to it.
// Without a signed-in service wallet, the direct path in chain.ts is used.
import { z } from "zod";
import { hashTypedData, type Address, type Hash } from "viem";
import {
  post,
  registeredServiceWallet,
  serviceSignedIn,
  type WalletView,
} from "./api";
import {
  ADMIN_LABELS,
  applyAdmin as applyAdminDirect,
  applyPolicy as applyPolicyDirect,
  client,
  readPolicy,
} from "./chain";
import {
  ADMIN_COMMANDS,
  ADMIN_TYPES,
  MAX_ADMIN_SECONDS,
  walletDomain,
  type AdminCommandName,
} from "./core";
import { addSent, writeSignedLists } from "./local";
import { signerForCurrent } from "./session";
import { Hex32Schema, UuidSchema } from "./service-dto/primitives";
import {
  buildPolicy,
  canonicalLists,
  checkPolicy,
  MAX_POLICY_SECONDS,
  WALLET_POLICY_TYPES,
  type PolicyLists,
} from "./typed";
import { walletAbi } from "./chain-abi";

const CLOCK_SKEW = 300n;
const RELAY_WAIT_MS = 180_000;

const draftSchema = z
  .object({
    draftId: UuidSchema,
    digest: Hex32Schema,
    typedData: z
      .object({ message: z.record(z.union([z.string(), z.number()])) })
      .passthrough(),
  })
  .passthrough();
const submitSchema = z
  .object({
    txHash: Hex32Schema.nullable(),
    chainState: z.string(),
    version: z.string().optional(),
  })
  .strict();

const uint = (v: string | number | undefined) => {
  if (v === undefined || !/^\d+$/.test(String(v)))
    throw new Error("The service sent an invalid draft. Nothing was signed.");
  return BigInt(v);
};

function checkWindow(issuedAt: bigint, deadline: bigint, max: bigint) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (
    issuedAt > now + CLOCK_SKEW ||
    issuedAt + CLOCK_SKEW < now ||
    deadline <= issuedAt ||
    deadline - issuedAt > max
  )
    throw new Error(
      "The service draft has the wrong time window. Nothing was signed.",
    );
}

async function relayWallet(wallet: Address): Promise<WalletView | null> {
  if (!serviceSignedIn()) return null;
  const registered = await registeredServiceWallet();
  return registered?.address?.toLowerCase() === wallet.toLowerCase()
    ? registered
    : null;
}

// Submits the signature, then waits for the service to include the relayed
// transaction. Repeating the same submission returns its current state.
async function submitAndWait(
  path: string,
  body: { draftId: string; ownerSignature: string },
): Promise<Hash> {
  const until = Date.now() + RELAY_WAIT_MS;
  for (;;) {
    const r = await post(path, body, submitSchema);
    if (r.chainState === "REVERTED")
      throw new Error("The change was rejected on the chain. Nothing changed.");
    if (r.chainState === "INCLUDED" && r.txHash) return r.txHash as Hash;
    if (Date.now() > until)
      throw new Error(
        "Sent to the service, but not yet confirmed on the chain. Check the agent wallet again in a minute.",
      );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export async function applyPolicy(input: {
  wallet: Address;
  owner: Address;
  lists: PolicyLists;
  reviewThreshold: bigint;
}): Promise<Hash> {
  const service = await relayWallet(input.wallet);
  if (!service) return applyPolicyDirect(input);
  const problem = checkPolicy(input.lists, input.reviewThreshold);
  if (problem) throw new Error(problem);
  const lists = canonicalLists(input.lists);
  const draft = draftSchema.parse(
    await post(
      `/v1/wallets/${service.walletId}/policy/draft`,
      {
        policy: { reviewThreshold: input.reviewThreshold.toString() },
        lists: {
          assetCaps: lists.assetCaps.map((c) => ({
            asset: c.asset,
            perTx: c.perTx.toString(),
            daily: c.daily.toString(),
            weekly: c.weekly.toString(),
          })),
          allowlist: lists.allowlist,
          blocklist: lists.blocklist,
          templates: [],
        },
      },
      draftSchema,
    ),
  );
  const m = draft.typedData.message;
  const current = await readPolicy(input.wallet);
  const version = uint(m.version);
  const issuedAt = uint(m.issuedAt);
  if (uint(m.nonce) !== current.nonce || version <= current.version)
    throw new Error(
      "The service draft does not match the wallet. Nothing was signed.",
    );
  checkWindow(issuedAt, uint(m.deadline), MAX_POLICY_SECONDS);
  const { message } = buildPolicy(
    lists,
    input.reviewThreshold,
    version,
    current.nonce,
    issuedAt,
  );
  const typed = {
    domain: walletDomain(input.wallet),
    types: WALLET_POLICY_TYPES,
    primaryType: "WalletPolicy",
    message,
  } as const;
  if (hashTypedData(typed) !== draft.digest)
    throw new Error(
      "The service draft is not the limits you set. Nothing was signed.",
    );
  const account = await signerForCurrent("Sign new wallet limits");
  if (account.address !== input.owner)
    throw new Error("The account changed. Nothing was signed.");
  const ownerSignature = await account.signTypedData(typed);
  const hash = await submitAndWait(
    `/v1/wallets/${service.walletId}/policy/submit`,
    { draftId: draft.draftId, ownerSignature },
  );
  await writeSignedLists(input.wallet, {
    version: version.toString(),
    allowlist: lists.allowlist,
    blocklist: lists.blocklist,
  });
  await addSent({
    hash,
    from: input.owner,
    to: input.wallet,
    symbol: "",
    amount: "",
    kind: "owner",
    label: `Signed wallet limits v${version}`,
    createdAt: Date.now(),
  });
  return hash;
}

export async function applyAdmin(
  wallet: Address,
  command: AdminCommandName,
  owner: Address,
): Promise<Hash> {
  const service = await relayWallet(wallet);
  if (!service) return applyAdminDirect(wallet, command, owner);
  const zero = `0x${"00".repeat(32)}` as const;
  const draft = draftSchema.parse(
    await post(
      `/v1/wallets/${service.walletId}/admin/draft`,
      { command: ADMIN_COMMANDS[command], permitId: zero },
      draftSchema,
    ),
  );
  const m = draft.typedData.message;
  const nonce = await client.readContract({
    address: wallet,
    abi: walletAbi,
    functionName: "adminNonce",
  });
  const issuedAt = uint(m.issuedAt);
  const deadline = uint(m.deadline);
  if (uint(m.nonce) !== nonce)
    throw new Error(
      "The service draft does not match the wallet. Nothing was signed.",
    );
  checkWindow(issuedAt, deadline, MAX_ADMIN_SECONDS);
  const typed = {
    domain: walletDomain(wallet),
    types: ADMIN_TYPES,
    primaryType: "Admin",
    message: {
      command: ADMIN_COMMANDS[command],
      permitId: zero,
      nonce,
      issuedAt,
      deadline,
    },
  } as const;
  if (hashTypedData(typed) !== draft.digest)
    throw new Error(
      "The service draft is not the command you chose. Nothing was signed.",
    );
  const account = await signerForCurrent(ADMIN_LABELS[command]);
  if (account.address !== owner)
    throw new Error("The account changed. Nothing was signed.");
  const ownerSignature = await account.signTypedData(typed);
  const hash = await submitAndWait(
    `/v1/wallets/${service.walletId}/admin/submit`,
    { draftId: draft.draftId, ownerSignature },
  );
  await addSent({
    hash,
    from: owner,
    to: wallet,
    symbol: "",
    amount: "",
    kind: "admin",
    label: ADMIN_LABELS[command],
    createdAt: Date.now(),
  });
  return hash;
}
