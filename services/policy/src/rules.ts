import { getAddress, type Address, type Hex } from "viem";
import {
  ActionSchema,
  DeploymentManifestSchema,
  hashAction,
  hashPermit,
  hashRunbook,
  InvoiceSchema,
  invoiceDomain,
  Kind,
  Operation,
  PermitSchema,
  recoverSigner,
  ScopeSchema,
  walletDomain,
  type DeploymentManifest,
} from "@mandate/schema";
import type { ActionRecord } from "./load.js";

export const NETWORK = "eip155:84532";
export const MAX_SNAPSHOT_AGE_SECONDS = 15;
export const MAX_PROPOSALS_PER_MINUTE = 5;
// Actions without owner co-signature live at most 60s (S9.5); co-signed up to 900s.
export const MAX_UNAPPROVED_ACTION_SECONDS = 60n;

export type ChainSnapshot = {
  blockNumber: bigint;
  timestamp: bigint;
  paused: boolean;
  frozen: boolean;
  epoch: bigint;
  requestUsed: boolean;
};

export type RuleInput = {
  record: ActionRecord;
  attemptId: string;
  manifest: DeploymentManifest | null;
  chain: ChainSnapshot | null;
  recentProposals: number;
  now: bigint;
  // demo-screening-v1 addresses (lowercase) from the trusted manifest's list file.
  screening: ReadonlySet<string>;
};
// Co-signed Actions and their invoices may live up to 15 minutes (S9.5).
export const MAX_COSIGNED_ACTION_SECONDS = 900n;

// Evaluates every rule in a fixed order; the decision is the full list of
// failing rule IDs, so denials are deterministic and reproducible.
export async function evaluate(input: RuleInput): Promise<string[]> {
  const { record: r, now } = input;
  const denied: string[] = [];
  const deny = (id: string) => denied.push(id);

  if (!input.manifest) deny("MANIFEST_UNAVAILABLE");
  if (r.attempt_state !== "PENDING" || r.attempt_digest !== r.digest)
    deny("ATTEMPT_MISMATCH");
  if (r.action_state !== "SIGNING") deny("ACTION_STATE");
  if (
    r.provisioning_state !== "READY" ||
    !r.wallet_address ||
    !r.executor_address ||
    !r.mpc_wallet_id
  )
    deny("WALLET_NOT_READY");
  if (r.paused) deny("WALLET_PAUSED");
  if (r.frozen) deny("WALLET_FROZEN");
  if (r.inhibited) deny("WALLET_INHIBITED");
  if (r.reservation_state !== "RESERVED" || r.reservation_amount !== r.amount)
    deny("RESERVATION_MISSING");
  if (input.recentProposals > MAX_PROPOSALS_PER_MINUTE) deny("PROPOSAL_RATE");
  if (denied.includes("WALLET_NOT_READY")) return denied;

  const wallet = getAddress(r.wallet_address!);
  const domain = walletDomain(wallet);
  const permit = PermitSchema.safeParse(r.permit);
  const action = ActionSchema.safeParse(r.action);
  const scope = ScopeSchema.safeParse(r.scope);
  if (!permit.success || !action.success || !scope.success) {
    deny("RECORD_INVALID");
    return denied;
  }
  const p = permit.data;
  const a = action.data;

  if (hashPermit(p) !== r.permit_id) deny("PERMIT_ID");
  let owner: Address | null = null;
  try {
    owner = await recoverSigner("Permit", p, domain, r.owner_signature as Hex);
  } catch {
    owner = null;
  }
  if (!owner || owner.toLowerCase() !== r.owner_address)
    deny("PERMIT_SIGNATURE");
  if (r.authority_state !== "ACTIVE") deny("PERMIT_INACTIVE");
  if (now < BigInt(p.startsAt) || now >= BigInt(p.expiresAt))
    deny("PERMIT_WINDOW");
  if (getAddress(p.executor) !== getAddress(r.executor_address!))
    deny("EXECUTOR_MISMATCH");

  if (input.manifest) {
    const runbook = input.manifest.runbooks.find(
      (m) => m.runbookId === r.runbook_id,
    );
    if (!runbook || hashRunbook(runbook) !== p.runbookHash)
      deny("RUNBOOK_VERSION");
    if (!input.manifest.agentAssets.some((asset) => asset.address === p.asset))
      deny("ASSET_UNSUPPORTED");
  }

  if (hashAction(a, domain) !== r.digest) deny("DIGEST_MISMATCH");
  if (
    a.permitId !== r.permit_id ||
    a.requestId !== r.request_id ||
    a.operation !== r.operation ||
    a.amount !== r.amount
  )
    deny("ACTION_BINDING");
  if (now < BigInt(a.issuedAt) || now >= BigInt(a.deadline))
    deny("ACTION_WINDOW");
  // Effective threshold is the lower of the Permit's and the confirmed policy's.
  const permitThreshold = BigInt(p.reviewThreshold);
  const policyThreshold = r.wallet_policy
    ? BigInt(r.wallet_policy.reviewThreshold)
    : permitThreshold;
  const threshold =
    policyThreshold < permitThreshold ? policyThreshold : permitThreshold;
  let approved = false;
  if (BigInt(a.amount) > threshold) {
    if (
      r.approval_state === "APPROVED" &&
      r.approval_signature &&
      r.approval_expires_at &&
      r.approval_digest === r.digest
    ) {
      let approver: Address | null = null;
      try {
        approver = await recoverSigner(
          "Approval",
          { actionDigest: r.digest, expiresAt: r.approval_expires_at },
          domain,
          r.approval_signature as Hex,
        );
      } catch {
        approver = null;
      }
      approved =
        approver?.toLowerCase() === r.owner_address &&
        BigInt(r.approval_expires_at) <= BigInt(a.deadline) &&
        now < BigInt(r.approval_expires_at);
    }
    if (!approved) deny("REVIEW_REQUIRED");
  }
  const lifetime = approved
    ? MAX_COSIGNED_ACTION_SECONDS
    : MAX_UNAPPROVED_ACTION_SECONDS;
  if (BigInt(a.deadline) - BigInt(a.issuedAt) > lifetime)
    deny("ACTION_LIFETIME");
  // The current on-chain WalletPolicy applies to every request (most restrictive wins).
  const lists = r.wallet_lists;
  const target = a.target.toLowerCase();
  if (lists) {
    const cap = lists.assetCaps.find(
      (c) => c.asset.toLowerCase() === p.asset.toLowerCase(),
    );
    if (!cap || BigInt(a.amount) > BigInt(cap.perTx)) deny("POLICY_VIOLATION");
    if (
      lists.allowlist.length &&
      !lists.allowlist.some((x) => x.toLowerCase() === target)
    )
      deny("POLICY_VIOLATION");
  }
  if (
    lists?.blocklist.some((x) => x.toLowerCase() === target) ||
    input.screening.has(target)
  )
    deny("SCREENING_HIT");

  if (a.operation === Operation.PAY) {
    if (p.kind !== Kind.BROWSER && p.kind !== Kind.ALLOWANCE)
      deny("OPERATION_KIND");
    if (a.minOutput !== "0" || a.period !== 0 || a.amount === "0")
      deny("ACTION_FIELDS");
    if (BigInt(a.amount) > BigInt(p.maxPayment)) deny("PAYMENT_CAP");
    const invoice = InvoiceSchema.safeParse(r.invoice);
    if (!invoice.success) deny("INVOICE_INVALID");
    else {
      const i = invoice.data;
      if (
        i.invoiceId !== a.invoiceId ||
        i.taskId !== p.taskId ||
        i.wallet !== wallet ||
        i.asset !== p.asset ||
        i.recipient !== a.target ||
        i.amount !== a.amount ||
        i.inputHash !== a.inputHash
      )
        deny("INVOICE_MISMATCH");
      if (
        BigInt(i.expiresAt) - BigInt(i.issuedAt) > lifetime ||
        now < BigInt(i.issuedAt) ||
        now > BigInt(i.expiresAt)
      )
        deny("QUOTE_EXPIRED");
      let signer: Address | null = null;
      try {
        signer = await recoverSigner(
          "Invoice",
          i,
          invoiceDomain(wallet),
          r.provider_signature as Hex,
        );
      } catch {
        signer = null;
      }
      // The provider signer is the provider recipient (S6).
      if (signer !== i.recipient) deny("PROVIDER_SIGNATURE");
      const binding = scope.data.providerBindings.find(
        (b) => b.recipient === a.target,
      );
      const provider = input.manifest?.providers.find(
        (m) => m.providerId === binding?.providerId,
      );
      if (!binding || !provider || provider.recipient !== binding.recipient)
        deny("RECIPIENT_DENIED");
    }
  } else if (a.operation === Operation.DEPOSIT) {
    // Deposits need a fresh NORMAL risk signal; the sentinel is a Task 4 dependency.
    deny("STALE_SIGNAL");
  } else {
    deny("OPERATION_UNSUPPORTED");
  }

  const chain = input.chain;
  if (!chain || now - chain.timestamp > BigInt(MAX_SNAPSHOT_AGE_SECONDS))
    deny("CHAIN_SNAPSHOT_STALE");
  else {
    if (chain.paused) deny("WALLET_PAUSED");
    if (chain.frozen) deny("WALLET_FROZEN");
    if (chain.epoch !== BigInt(p.epoch)) deny("PERMIT_EPOCH");
    if (chain.requestUsed) deny("DUPLICATE_REQUEST");
  }
  return [...new Set(denied)];
}

export const parseManifest = (value: unknown) =>
  DeploymentManifestSchema.parse(value);
