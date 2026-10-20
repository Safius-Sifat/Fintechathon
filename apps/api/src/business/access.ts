import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { AGENT_SCOPES } from "@mandate/schema";
import type { AuthService, OwnerContext } from "../auth/service.js";
import { AuthError } from "../auth/errors.js";

export type AgentScope = (typeof AGENT_SCOPES)[number];
export type Principal =
  | { kind: "owner"; owner: string; session: OwnerContext }
  | {
      kind: "agent";
      owner: string;
      tokenId: string;
      walletId: string;
      taskId: string | null;
      scopes: readonly AgentScope[];
    };

export const AGENT_TOKEN_PREFIX = "mat_";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const scopeDenied = (
  message = "Credential is outside this resource's scope.",
) => new AuthError(403, message, "AUTH_SCOPE");

export async function authenticate(
  database: Pool,
  auth: AuthService,
  authorization: string | undefined,
  now: number,
): Promise<Principal> {
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  if (!bearer?.startsWith(AGENT_TOKEN_PREFIX)) {
    const session = await auth.authenticate(authorization);
    return { kind: "owner", owner: session.ownerAddress, session };
  }
  if (!/^mat_[A-Za-z0-9_-]{43}$/.test(bearer))
    throw new AuthError(401, "Agent token is invalid.");
  const row = (
    await database.query<{
      id: string;
      owner_address: string;
      wallet_id: string;
      task_id: string | null;
      scopes: AgentScope[];
    }>(
      "SELECT t.id,t.owner_address,t.wallet_id,t.task_id,t.scopes FROM agent_tokens t JOIN wallets w ON w.id=t.wallet_id AND w.owner_address=t.owner_address WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>$2",
      [hashToken(bearer), now],
    )
  ).rows[0];
  if (!row)
    throw new AuthError(401, "Agent token is invalid, expired or revoked.");
  return {
    kind: "agent",
    owner: row.owner_address,
    tokenId: row.id,
    walletId: row.wallet_id,
    taskId: row.task_id,
    scopes: row.scopes,
  };
}

export function requireOwner(principal: Principal) {
  if (principal.kind !== "owner")
    throw scopeDenied("Agent tokens cannot use owner routes.");
  return principal;
}

// Tenant identity comes from the stored wallet row, never from the caller.
export function requireWalletAccess(
  principal: Principal,
  wallet: { id: string; owner_address: string } | undefined,
  scope: AgentScope,
) {
  if (!wallet || wallet.owner_address !== principal.owner) throw scopeDenied();
  if (principal.kind === "agent") {
    if (principal.walletId !== wallet.id || !principal.scopes.includes(scope))
      throw scopeDenied();
  }
  return wallet;
}

export function requireTaskAccess(
  principal: Principal,
  task: { id: string; wallet_id: string; owner_address: string } | undefined,
  scope: AgentScope,
) {
  if (!task) throw scopeDenied();
  requireWalletAccess(
    principal,
    { id: task.wallet_id, owner_address: task.owner_address },
    scope,
  );
  if (
    principal.kind === "agent" &&
    principal.taskId !== null &&
    principal.taskId !== task.id
  )
    throw scopeDenied();
  return task;
}
