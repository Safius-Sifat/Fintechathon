import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { getAddress, type Address, type Hex, type PublicClient } from "viem";
import { z } from "zod";
import {
  AdminCommand,
  ApprovalRequestSchema,
  Hex32Schema,
  hashDigest,
  hashWalletPolicyLists,
  mandateWalletAbi,
  PolicyDraftRequestSchema,
  PolicyDraftSchema,
  PushRegisterRequestSchema,
  InhibitClearRequestSchema,
  recoverSigner,
  SignedSubmitSchema,
  typedDataJson,
  walletDomain,
  ZERO_HASH,
  type SignedType,
} from "@mandate/schema";
import type { Clock } from "@mandate/platform";
import { AuthError } from "../auth/errors.js";
import { requireOwner, scopeDenied, type Principal } from "./access.js";

const REAUTH_SECONDS = 300;
const COMMAND_SECONDS = 1800;

// Owner-only controls: approvals, policy and admin commands, push and inhibit.
// Agent tokens never reach these; signatures are always the owner's own.
export class ControlService {
  constructor(
    readonly database: Pool,
    readonly client: PublicClient | null,
    readonly clock: Clock,
  ) {}

  private chain() {
    if (!this.client)
      throw new AuthError(
        503,
        "Chain state is unavailable.",
        "SETTLEMENT_UNKNOWN",
      );
    return this.client;
  }

  private async wallet(principal: Principal, walletId: string) {
    const owner = requireOwner(principal);
    const row = (
      await this.database.query<{
        id: string;
        owner_address: string;
        wallet_address: string | null;
      }>("SELECT id,owner_address,wallet_address FROM wallets WHERE id=$1", [
        walletId,
      ])
    ).rows[0];
    if (!row || row.owner_address !== owner.owner) throw scopeDenied();
    if (!row.wallet_address)
      throw new AuthError(
        409,
        "Managed wallet is not deployed.",
        "PERMIT_INACTIVE",
      );
    return { owner, id: row.id, address: getAddress(row.wallet_address) };
  }

  private async recover<T extends SignedType>(
    type: T,
    message: unknown,
    wallet: Address,
    signature: string,
  ) {
    try {
      return (
        await recoverSigner(
          type,
          message,
          walletDomain(wallet),
          signature as Hex,
        )
      ).toLowerCase();
    } catch {
      throw new AuthError(422, "Owner signature is invalid.", "INTENT_INVALID");
    }
  }

  private async approvalRow(owner: string, approvalId: string) {
    const row = (
      await this.database.query<{
        approval_id: string;
        wallet_id: string;
        task_id: string;
        action: unknown;
        invoice: unknown;
        action_digest: string;
        expires_at: string;
        state: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
        rationale: string | null;
        wallet_address: string;
        owner_address: string;
      }>(
        "SELECT q.approval_id,q.wallet_id,a.task_id,a.action,a.invoice,q.action_digest,q.expires_at::text,q.state,q.rationale,w.wallet_address,w.owner_address FROM approval_requests q JOIN actions a ON a.id=q.action_id JOIN wallets w ON w.id=q.wallet_id WHERE q.approval_id=$1",
        [approvalId],
      )
    ).rows[0];
    if (!row || row.owner_address !== owner) throw scopeDenied();
    return row;
  }

  private view(row: Awaited<ReturnType<ControlService["approvalRow"]>>) {
    const message = {
      actionDigest: row.action_digest,
      expiresAt: row.expires_at,
    };
    const domain = walletDomain(getAddress(row.wallet_address));
    return ApprovalRequestSchema.parse({
      approvalId: row.approval_id,
      walletId: row.wallet_id,
      taskId: row.task_id,
      action: row.action,
      invoice: row.invoice,
      typedData: typedDataJson("Approval", message, domain),
      digest: hashDigest("Approval", message, domain),
      rationale: row.rationale,
      rationaleUntrusted: true,
      expiresAt: row.expires_at,
      state:
        row.state === "PENDING" && this.clock() >= Number(row.expires_at)
          ? "EXPIRED"
          : row.state,
    });
  }

  async approvals(principal: Principal) {
    const owner = requireOwner(principal);
    const ids = await this.database.query<{ approval_id: string }>(
      "SELECT q.approval_id FROM approval_requests q JOIN wallets w ON w.id=q.wallet_id WHERE w.owner_address=$1 AND q.state='PENDING' AND q.expires_at>$2 ORDER BY q.created_at",
      [owner.owner, this.clock()],
    );
    return {
      items: await Promise.all(
        ids.rows.map(async (r) =>
          this.view(await this.approvalRow(owner.owner, r.approval_id)),
        ),
      ),
    };
  }

  async approval(principal: Principal, approvalId: string) {
    return this.view(
      await this.approvalRow(requireOwner(principal).owner, approvalId),
    );
  }

  // The owner's co-signature over Approval(actionDigest, expiresAt) in domain 5.
  async decide(
    principal: Principal,
    approvalId: string,
    input: unknown,
    approve: boolean,
  ) {
    const owner = requireOwner(principal);
    const row = await this.approvalRow(owner.owner, approvalId);
    if (row.state !== "PENDING" || this.clock() >= Number(row.expires_at))
      throw new AuthError(
        409,
        "Approval is no longer pending.",
        "OWNER_REJECTED",
      );
    if (approve) {
      const { ownerSignature } = z
        .object({ ownerSignature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) })
        .strict()
        .parse(input);
      const signer = await this.recover(
        "Approval",
        { actionDigest: row.action_digest, expiresAt: row.expires_at },
        getAddress(row.wallet_address),
        ownerSignature,
      );
      if (signer !== owner.owner)
        throw new AuthError(
          422,
          "Signature is not the wallet owner's over this Action.",
          "INTENT_INVALID",
        );
      await this.database.query(
        "UPDATE approval_requests SET state='APPROVED',owner_signature=$2,decided_at=$3 WHERE approval_id=$1 AND state='PENDING'",
        [approvalId, ownerSignature.toLowerCase(), this.clock()],
      );
      return { state: "APPROVED" };
    }
    z.object({}).strict().parse(input);
    await this.database.query(
      "UPDATE approval_requests SET state='REJECTED',decided_at=$2 WHERE approval_id=$1 AND state='PENDING'",
      [approvalId, this.clock()],
    );
    return { state: "REJECTED" };
  }

  private async chainNow(client: PublicClient) {
    return Math.min(
      this.clock(),
      Number((await client.getBlock({ blockTag: "latest" })).timestamp),
    );
  }

  async policyDraft(principal: Principal, walletId: string, input: unknown) {
    const { id, address } = await this.wallet(principal, walletId);
    const body = PolicyDraftRequestSchema.parse(input);
    const client = this.chain();
    const [nonce, current] = await Promise.all([
      client.readContract({
        address,
        abi: mandateWalletAbi,
        functionName: "policyNonce",
      }),
      this.database.query<{ version: string; lists: { allowlist: string[] } }>(
        "SELECT version::text,lists FROM wallet_policies WHERE wallet_id=$1 ORDER BY version DESC LIMIT 1",
        [id],
      ),
    ]);
    const issuedAt = await this.chainNow(client);
    const message = {
      // policyNonce counts applied policies, so it covers relays outside this service.
      version: (
        (BigInt(current.rows[0]?.version ?? "0") > nonce
          ? BigInt(current.rows[0]!.version)
          : nonce) + 1n
      ).toString(),
      ...hashWalletPolicyLists(body.lists),
      reviewThreshold: body.policy.reviewThreshold,
      nonce: nonce.toString(),
      issuedAt: String(issuedAt),
      deadline: String(issuedAt + COMMAND_SECONDS),
    };
    const effects = [
      `Review threshold ${body.policy.reviewThreshold} units; lower Permit thresholds still apply.`,
      ...body.lists.assetCaps.map(
        (c) =>
          `Asset ${c.asset}: per transaction ${c.perTx}, daily ${c.daily}, weekly ${c.weekly}.`,
      ),
      `Blocklist ${body.lists.blocklist.length} entries; templates ${body.lists.templates.length}.`,
      body.lists.allowlist.length
        ? `Allowlist on with ${body.lists.allowlist.length} entries.`
        : current.rows[0]?.lists.allowlist.length
          ? "Warning: this empties the allowlist, which turns allowlist filtering off."
          : "Allowlist off.",
    ];
    return this.storeCommand(
      id,
      address,
      "POLICY",
      "WalletPolicy",
      message,
      body.lists,
      (draftId, typedData, digest) =>
        PolicyDraftSchema.parse({ draftId, typedData, digest, effects }),
    );
  }

  async adminDraft(principal: Principal, walletId: string, input: unknown) {
    const { id, address } = await this.wallet(principal, walletId);
    const body = z
      .object({
        command: z.number().int().min(0).max(6),
        permitId: Hex32Schema,
      })
      .strict()
      .parse(input);
    // Only REVOKE names a Permit; every other command must carry the zero ID.
    if (
      (body.command === AdminCommand.REVOKE) ===
      (body.permitId === ZERO_HASH)
    )
      throw new AuthError(
        422,
        "REVOKE needs a permitId; other commands need the zero permitId.",
        "INTENT_INVALID",
      );
    const client = this.chain();
    const nonce = await client.readContract({
      address,
      abi: mandateWalletAbi,
      functionName: "adminNonce",
    });
    const issuedAt = await this.chainNow(client);
    const message = {
      command: body.command,
      permitId: body.permitId,
      nonce: nonce.toString(),
      issuedAt: String(issuedAt),
      deadline: String(issuedAt + COMMAND_SECONDS),
    };
    // Stopping commands inhibit new agent work locally at once; the chain receipt confirms them.
    if (
      [AdminCommand.PAUSE, AdminCommand.REVOKE, AdminCommand.FREEZE].includes(
        body.command as 0 | 2 | 5,
      )
    )
      await this.database.query(
        "UPDATE wallets SET inhibited=true,updated_at=$2 WHERE id=$1",
        [id, this.clock()],
      );
    return this.storeCommand(
      id,
      address,
      "ADMIN",
      "Admin",
      message,
      null,
      (draftId, typedData, digest) => ({ draftId, typedData, digest }),
    );
  }

  private async storeCommand<R>(
    walletId: string,
    address: Address,
    kind: "POLICY" | "ADMIN",
    type: "WalletPolicy" | "Admin",
    message: Record<string, unknown>,
    lists: unknown,
    shape: (draftId: string, typedData: unknown, digest: Hex) => R,
  ): Promise<R> {
    const domain = walletDomain(address);
    const typedData = typedDataJson(type, message, domain);
    const digest = hashDigest(type, message, domain);
    const draftId = randomUUID();
    await this.database.query(
      "INSERT INTO owner_commands(draft_id,wallet_id,kind,message,lists,typed_data,digest,state,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9)",
      [
        draftId,
        walletId,
        kind,
        message,
        lists,
        typedData,
        digest,
        Number(message.deadline),
        this.clock(),
      ],
    );
    return shape(draftId, typedData, digest);
  }

  // Same signature returns the same operation; another signature on a submitted draft conflicts.
  async submitCommand(
    principal: Principal,
    walletId: string,
    kind: "POLICY" | "ADMIN",
    input: unknown,
  ) {
    const { owner, address } = await this.wallet(principal, walletId);
    const body = SignedSubmitSchema.parse(input);
    const row = (
      await this.database.query<{
        message: Record<string, unknown>;
        owner_signature: string | null;
        state: string;
        expires_at: string;
        tx_hash: string | null;
      }>(
        "SELECT c.message,c.owner_signature,c.state,c.expires_at::text,t.tx_hash FROM owner_commands c LEFT JOIN transactions t ON t.id=c.tx_id WHERE c.draft_id=$1 AND c.wallet_id=$2 AND c.kind=$3",
        [body.draftId, walletId, kind],
      )
    ).rows[0];
    if (!row) throw scopeDenied();
    const result = () => ({
      txHash: row.tx_hash,
      chainState: row.state,
      ...(kind === "POLICY" ? { version: String(row.message.version) } : {}),
    });
    if (row.owner_signature !== null) {
      if (row.owner_signature !== body.ownerSignature)
        throw new AuthError(
          409,
          "Draft was already submitted with another signature.",
          "DUPLICATE_REQUEST",
        );
      return result();
    }
    const signer = await this.recover(
      kind === "POLICY" ? "WalletPolicy" : "Admin",
      row.message,
      address,
      body.ownerSignature,
    );
    if (signer !== owner.owner)
      throw new AuthError(
        422,
        "Signature is not the wallet owner's.",
        "INTENT_INVALID",
      );
    if (this.clock() >= Number(row.expires_at))
      throw new AuthError(
        409,
        "Draft expired; prepare a new one.",
        "PERMIT_INACTIVE",
      );
    const now = this.clock();
    await this.database.query(
      "UPDATE owner_commands SET owner_signature=$2,state='SUBMITTED' WHERE draft_id=$1 AND state='DRAFT'",
      [body.draftId, body.ownerSignature],
    );
    await this.database.query(
      "INSERT INTO jobs(id,kind,dedupe_key,payload,state,run_at,max_attempts,created_at,updated_at) VALUES($1,'owner_command.relay',$2,$3,'READY',$4,20,$4,$4) ON CONFLICT DO NOTHING",
      [randomUUID(), body.draftId, { draftId: body.draftId }, now],
    );
    return {
      txHash: null,
      chainState: "SUBMITTED",
      ...(kind === "POLICY" ? { version: String(row.message.version) } : {}),
    };
  }

  // Bound to the caller's own session and device; replaces that device's token.
  async registerPush(principal: Principal, input: unknown) {
    const owner = requireOwner(principal);
    const body = PushRegisterRequestSchema.parse(input);
    if (body.deviceId !== owner.session.deviceId)
      throw scopeDenied("Push registration must use this session's device.");
    await this.database.query(
      "INSERT INTO push_devices(owner_address,device_id,session_id,platform,push_token,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_address,device_id) DO UPDATE SET session_id=EXCLUDED.session_id,platform=EXCLUDED.platform,push_token=EXCLUDED.push_token,created_at=EXCLUDED.created_at",
      [
        owner.owner,
        body.deviceId,
        owner.session.sessionId,
        body.platform,
        body.pushToken,
        this.clock(),
      ],
    );
    return { registered: true };
  }

  async clearInhibit(principal: Principal, walletId: string, input: unknown) {
    const owner = requireOwner(principal);
    if (this.clock() - owner.session.authTime > REAUTH_SECONDS)
      throw new AuthError(
        401,
        "A recent owner-signed login is required.",
        "REAUTH_REQUIRED",
      );
    const { alertId } = InhibitClearRequestSchema.parse(input);
    const wallet = (
      await this.database.query<{ owner_address: string }>(
        "SELECT owner_address FROM wallets WHERE id=$1",
        [walletId],
      )
    ).rows[0];
    if (!wallet || wallet.owner_address !== owner.owner) throw scopeDenied();
    const now = this.clock();
    const cleared = await this.database.query(
      "UPDATE financial_alerts SET cleared_at=COALESCE(cleared_at,$3) WHERE id=$1 AND wallet_id=$2",
      [alertId, walletId, now],
    );
    if (cleared.rowCount !== 1) throw scopeDenied();
    const open = await this.database.query(
      "SELECT 1 FROM financial_alerts WHERE wallet_id=$1 AND cleared_at IS NULL",
      [walletId],
    );
    if (!open.rowCount)
      await this.database.query(
        "UPDATE wallets SET inhibited=false,updated_at=$2 WHERE id=$1",
        [walletId, now],
      );
    return { inhibited: !!open.rowCount };
  }
}
