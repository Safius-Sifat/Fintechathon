import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { Hex32Schema, UuidSchema } from "@mandate/schema";
import type { Clock } from "@mandate/platform";
import { AuthError } from "../auth/errors.js";
import {
  AGENT_TOKEN_PREFIX,
  hashToken,
  requireOwner,
  requireWalletAccess,
  scopeDenied,
  type Principal,
} from "./access.js";

// Events the chat agent service streams (apps/agent/src/chat/events.ts).
const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text_delta"), text: z.string().max(8000) }),
  z.object({
    type: z.literal("step"),
    id: z.string().max(64),
    label: z.string().max(120),
    state: z.enum(["started", "done", "failed"]),
    detail: z.string().max(400).optional(),
  }),
  z.object({
    type: z.literal("products"),
    note: z.string().max(400),
    products: z.array(z.record(z.unknown())).max(6),
  }),
  z.object({
    type: z.literal("question"),
    question: z.string().max(400),
    options: z.array(z.string().max(40)).max(6),
  }),
  z.object({
    type: z.literal("purchase"),
    taskId: UuidSchema,
    product: z.record(z.unknown()),
    size: z.string().max(8).nullable(),
    amount: z.string().regex(/^[0-9]+$/),
  }),
  z.object({
    type: z.literal("task"),
    taskId: UuidSchema,
    runbookId: z.string().max(40),
    label: z.string().max(200),
  }),
  z.object({ type: z.literal("agent"), text: z.string().max(8000) }),
  z.object({ type: z.literal("error"), message: z.string().max(400) }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// The chat agent service: one streamed reply per call.
export interface AgentClient {
  reply(
    request: {
      conversationId: string;
      walletId: string;
      token: string;
      deliveryHash: string | null;
      history: { role: "user" | "assistant"; text: string }[];
    },
    onEvent: (event: unknown) => void,
  ): Promise<void>;
}

// Reads the service's newline-delimited JSON stream.
export function httpAgentClient(url: string, token: string): AgentClient {
  return {
    async reply(request, onEvent) {
      const res = await fetch(`${url}/v1/reply`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok || !res.body)
        throw new Error(`Agent service refused (${res.status})`);
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) onEvent(JSON.parse(line));
        }
      }
    },
  };
}

export const MessageRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    deliveryHash: Hex32Schema.nullable(),
  })
  .strict();
const CreateRequestSchema = z.object({ walletId: UuidSchema }).strict();
const PatchRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    pinned: z.boolean().optional(),
  })
  .strict();

export type StoredEvent = {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
};
export type ConversationUpdate = StoredEvent | { live: AgentEvent };
type Listener = (event: ConversationUpdate) => void;

const REPLY_TOKEN_SECONDS = 15 * 60;
const HISTORY_EVENTS = 40;

// Chats with the agent (plan 05). Events are stored in order; text as it is
// written is only relayed live. The agent acts with a fresh read/prepare
// token per reply, revoked when the reply ends.
export class ConversationService {
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    readonly database: Pool,
    readonly clock: Clock,
    readonly agent: AgentClient | null,
  ) {}

  private async owned(principal: Principal, id: string) {
    const owner = requireOwner(principal);
    UuidSchema.parse(id);
    const row = (
      await this.database.query<{
        id: string;
        wallet_id: string;
        title: string | null;
        replying: boolean;
      }>(
        "SELECT id,wallet_id,title,replying FROM conversations WHERE id=$1 AND owner_address=$2 AND hidden_at IS NULL",
        [id, owner.owner],
      )
    ).rows[0];
    if (!row) throw scopeDenied();
    return { owner, row };
  }

  async create(principal: Principal, input: unknown) {
    const owner = requireOwner(principal);
    const { walletId } = CreateRequestSchema.parse(input);
    const wallet = (
      await this.database.query<{ id: string; owner_address: string }>(
        "SELECT id,owner_address FROM wallets WHERE id=$1",
        [walletId],
      )
    ).rows[0];
    requireWalletAccess(owner, wallet, "read");
    const id = randomUUID();
    const now = this.clock();
    await this.database.query(
      "INSERT INTO conversations(id,owner_address,wallet_id,created_at,updated_at) VALUES($1,$2,$3,$4,$4)",
      [id, owner.owner, walletId, now],
    );
    return { conversationId: id, title: null, pinned: false, status: "idle" };
  }

  // Most recent first; pinned chats lead. Status comes from the chat's tasks.
  async list(principal: Principal) {
    const owner = requireOwner(principal);
    const rows = await this.database.query<{
      id: string;
      title: string | null;
      pinned: boolean;
      replying: boolean;
      updated_at: string;
      awaiting: string;
      working: string;
      completed: string;
      approvals: string;
    }>(
      `SELECT c.id,c.title,c.pinned,c.replying,c.updated_at::text,
        count(t.id) FILTER (WHERE t.outcome_state='AWAITING_OWNER')::text AS awaiting,
        count(t.id) FILTER (WHERE t.outcome_state IN ('READY','RUNNING','AWAITING_AGENT'))::text AS working,
        count(t.id) FILTER (WHERE t.outcome_state='COMPLETED')::text AS completed,
        (SELECT count(*) FROM approval_requests q JOIN actions a ON a.id=q.action_id
           JOIN conversation_tasks x ON x.task_id=a.task_id
           WHERE x.conversation_id=c.id AND q.state='PENDING')::text AS approvals
       FROM conversations c
       LEFT JOIN conversation_tasks ct ON ct.conversation_id=c.id
       LEFT JOIN tasks t ON t.id=ct.task_id
       WHERE c.owner_address=$1 AND c.hidden_at IS NULL
       GROUP BY c.id ORDER BY c.pinned DESC, c.updated_at DESC LIMIT 100`,
      [owner.owner],
    );
    return {
      conversations: rows.rows.map((r) => ({
        conversationId: r.id,
        title: r.title,
        pinned: r.pinned,
        updatedAt: Number(r.updated_at),
        status:
          Number(r.awaiting) + Number(r.approvals) > 0
            ? "needs_you"
            : r.replying || Number(r.working) > 0
              ? "working"
              : Number(r.completed) > 0
                ? "done"
                : "idle",
      })),
    };
  }

  async events(principal: Principal, id: string, after = 0) {
    await this.owned(principal, id);
    const rows = await this.database.query<{
      seq: string;
      type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>(
      "SELECT seq::text,type,payload,created_at::text FROM conversation_events WHERE conversation_id=$1 AND seq>$2 ORDER BY seq LIMIT 500",
      [id, after],
    );
    return rows.rows.map((r) => ({
      seq: Number(r.seq),
      type: r.type,
      payload: r.payload,
      createdAt: Number(r.created_at),
    }));
  }

  // Whether the agent is writing a reply in this chat now.
  async replying(principal: Principal, id: string) {
    return (await this.owned(principal, id)).row.replying;
  }

  async patch(principal: Principal, id: string, input: unknown) {
    await this.owned(principal, id);
    const body = PatchRequestSchema.parse(input);
    await this.database.query(
      "UPDATE conversations SET title=COALESCE($2,title),pinned=COALESCE($3,pinned),updated_at=updated_at WHERE id=$1",
      [id, body.title ?? null, body.pinned ?? null],
    );
    return { ok: true };
  }

  // Hides the chat. Work it started is not stopped by deleting a chat, so a
  // chat whose task can still spend must be stopped first.
  async hide(principal: Principal, id: string) {
    await this.owned(principal, id);
    const live = await this.database.query(
      "SELECT 1 FROM conversation_tasks x JOIN tasks t ON t.id=x.task_id WHERE x.conversation_id=$1 AND t.authority_state='ACTIVE' AND t.outcome_state NOT IN ('COMPLETED','CANCELLED','DELIVERY_FAILED')",
      [id],
    );
    if (live.rowCount)
      throw new AuthError(
        409,
        "This chat has an order or check that can still spend. Stop it first.",
        "PERMIT_INACTIVE",
      );
    await this.database.query(
      "UPDATE conversations SET hidden_at=$2 WHERE id=$1",
      [id, this.clock()],
    );
    return { ok: true };
  }

  subscribe(id: string, listener: Listener) {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (!set!.size) this.listeners.delete(id);
    };
  }

  private publish(id: string, event: StoredEvent | { live: AgentEvent }) {
    for (const l of this.listeners.get(id) ?? []) l(event);
  }

  private async append(
    id: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<StoredEvent> {
    const now = this.clock();
    const row = (
      await this.database.query<{ seq: string }>(
        "INSERT INTO conversation_events(conversation_id,seq,type,payload,created_at) SELECT $1,COALESCE(max(seq),0)+1,$2,$3,$4 FROM conversation_events WHERE conversation_id=$1 RETURNING seq::text",
        [id, type, payload, now],
      )
    ).rows[0]!;
    await this.database.query(
      "UPDATE conversations SET updated_at=$2 WHERE id=$1",
      [id, now],
    );
    const event = { seq: Number(row.seq), type, payload, createdAt: now };
    this.publish(id, event);
    return event;
  }

  // Stores the owner's message and starts the agent's reply in the background.
  async post(principal: Principal, id: string, input: unknown) {
    const { owner, row } = await this.owned(principal, id);
    const body = MessageRequestSchema.parse(input);
    if (!this.agent)
      throw new AuthError(
        503,
        "The agent is not configured on this server.",
        "NOT_IMPLEMENTED",
      );
    const claimed = await this.database.query(
      "UPDATE conversations SET replying=true,title=COALESCE(title,$2) WHERE id=$1 AND replying=false",
      [id, body.text.slice(0, 60)],
    );
    if (!claimed.rowCount)
      throw new AuthError(
        409,
        "The agent is still replying.",
        "DUPLICATE_REQUEST",
      );
    const event = await this.append(id, "user", { text: body.text });
    void this.runReply(owner.owner, id, row.wallet_id, body.deliveryHash);
    return { seq: event.seq };
  }

  private async runReply(
    owner: string,
    id: string,
    walletId: string,
    deliveryHash: string | null,
  ) {
    const tokenId = randomUUID();
    const token = AGENT_TOKEN_PREFIX + randomBytes(32).toString("base64url");
    const now = this.clock();
    let text = "";
    try {
      await this.database.query(
        "INSERT INTO agent_tokens(id,token_hash,owner_address,wallet_id,task_id,scopes,expires_at,created_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$7)",
        [
          tokenId,
          hashToken(token),
          owner,
          walletId,
          ["read", "prepare"],
          now + REPLY_TOKEN_SECONDS,
          now,
        ],
      );
      const history = (
        await this.database.query<{
          type: string;
          payload: { text?: string };
        }>(
          "SELECT type,payload FROM (SELECT seq,type,payload FROM conversation_events WHERE conversation_id=$1 AND type IN ('user','agent') ORDER BY seq DESC LIMIT $2) h ORDER BY seq",
          [id, HISTORY_EVENTS],
        )
      ).rows
        .filter((e) => e.payload.text)
        .map((e) => ({
          role: (e.type === "user" ? "user" : "assistant") as
            | "user"
            | "assistant",
          text: e.payload.text!,
        }));
      // Appended one at a time, in the order the agent produced them.
      let queue: Promise<unknown> = Promise.resolve();
      await this.agent!.reply(
        { conversationId: id, walletId, token, deliveryHash, history },
        (raw) => {
          const parsed = AgentEventSchema.safeParse(raw);
          if (!parsed.success) return;
          const e = parsed.data;
          if (e.type === "text_delta") {
            text += e.text;
            this.publish(id, { live: e });
            return;
          }
          if (e.type === "agent") {
            text = e.text;
            return;
          }
          const { type, ...payload } = e;
          queue = queue.then(async () => {
            if (type === "purchase" || type === "task")
              await this.database.query(
                "INSERT INTO conversation_tasks(conversation_id,task_id,created_at) SELECT $1,$2,$3 FROM tasks WHERE id=$2 ON CONFLICT DO NOTHING",
                [id, (e as { taskId: string }).taskId, this.clock()],
              );
            await this.append(id, type, payload);
          });
        },
      );
      await queue;
      if (text.trim()) await this.append(id, "agent", { text: text.trim() });
    } catch {
      await this.append(id, "error", {
        message: "The agent could not reply. Try again.",
      });
    } finally {
      await this.database.query(
        "UPDATE agent_tokens SET revoked_at=$2 WHERE id=$1",
        [tokenId, this.clock()],
      );
      await this.database.query(
        "UPDATE conversations SET replying=false WHERE id=$1",
        [id],
      );
      this.publish(id, {
        seq: -1,
        type: "idle",
        payload: {},
        createdAt: this.clock(),
      });
    }
  }
}
