import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { hashStruct, type Address, type Hex } from "viem";
import {
  checkLoginRequest,
  LOGIN_TYPES,
  loginDomain,
  walletDomain,
} from "./core";
import { AGENT_ASSETS, API_ORIGIN } from "./config";
import { APPROVAL_TYPES, PERMIT_TYPES } from "./typed";
import {
  currentAccount,
  getWalletState,
  signerForCurrent,
  subscribeWallet,
  useWallet,
} from "./session";
import { deviceId } from "./vault";
import { readServiceReferences, updateServiceReferences } from "./local";
import { OwnerSessionGate, operationKey } from "./service-session";
import {
  canonicalJson,
  permitSigningMessage,
  validatePaymentApproval,
  validatePermitDraft,
  type PermitContext,
  type ApprovalPermitContext,
} from "./service-validation";
import {
  ApiErrorSchema,
  AgentTokenRequestSchema,
  ApprovalRequestSchema,
  AuthorityStateSchema,
  CreateTaskRequestSchema,
  IntentCompileRequestSchema,
  IntentDraftSchema,
  OwnerApprovalSchema,
  PermitDraftRequestSchema,
  TaskViewSchema,
  WalletViewSchema,
  type ApprovalRequest,
  type OwnerApproval,
  type TaskView,
  type Terms,
  type WalletView,
} from "./service-dto/api";
import { ActivityPageSchema } from "./service-dto/activity";
import { Hex32Schema, UuidSchema, Uint64 } from "./service-dto/primitives";
import { readProofBytes } from "./service-proof";
import { permitStateAbi } from "./chain-abi";
import { LoginDomainSchema } from "./service-dto/domains";

export type {
  Terms,
  OwnerApproval,
  TaskView,
  WalletView,
} from "./service-dto/api";
export type PaymentApproval = ApprovalRequest;
export interface ApiSession {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
  owner: Address;
}
export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected" }
  | { status: "error"; error: string };
let session: ApiSession | null = null;
let connection: ConnectionState = { status: "disconnected" };
const gate = new OwnerSessionGate();
const listeners = new Set<() => void>();
const signedSubmissions = new Map<string, Hex>();
let loginPending: Promise<void> | null = null;
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useApiSession = () =>
  useSyncExternalStore(subscribe, () => session);
export const useApiConnection = () =>
  useSyncExternalStore(subscribe, () => connection);
export const serviceSignedIn = () =>
  session !== null &&
  BigInt(session.expiresAt) > BigInt(Math.floor(Date.now() / 1000));
function ownerNow() {
  const account = currentAccount();
  return getWalletState().status === "unlocked" && account
    ? account.address
    : null;
}
let observedOwner = ownerNow();
gate.update(observedOwner);
subscribeWallet(() => {
  const owner = ownerNow();
  if (owner?.toLowerCase() !== observedOwner?.toLowerCase()) {
    observedOwner = owner;
    gate.update(owner);
    session = null;
    loginPending = null;
    signedSubmissions.clear();
    connection = { status: "disconnected" };
    emit();
  }
});
export function useAutomaticSignIn() {
  const wallet = useWallet();
  const owner =
    wallet.status === "unlocked"
      ? wallet.profile?.accounts.find(
          (a) => a.index === wallet.profile?.current,
        )?.address
      : null;
  useEffect(() => {
    if (owner) void signIn().catch(() => undefined);
  }, [owner]);
}
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly refusal: z.infer<typeof ApiErrorSchema> | null,
  ) {
    super(
      refusal?.message ??
        (status === 501
          ? "This service feature is not implemented."
          : status === 503
            ? "The Mandate service is unavailable. Try again later."
            : status === 401
              ? "Your service session ended. Sign in again in Settings."
              : `The Mandate service refused the request (${status}).`),
    );
  }
}
function origin() {
  if (
    !API_ORIGIN ||
    new URL(API_ORIGIN).protocol !== "https:" ||
    new URL(API_ORIGIN).origin !== API_ORIGIN
  )
    throw new Error("The Mandate service needs a configured HTTPS origin.");
  return API_ORIGIN;
}
async function response(
  path: string,
  init: RequestInit,
  ticket: ReturnType<OwnerSessionGate["ticket"]>,
) {
  gate.assert(ticket);
  let res: Response;
  try {
    res = await fetch(`${origin()}${path}`, init);
  } catch {
    gate.assert(ticket);
    throw new Error(
      "Could not reach the Mandate service. Check your connection and try again.",
    );
  }
  gate.assert(ticket);
  if (!res.ok) {
    const refusal = ApiErrorSchema.safeParse(
      await res.json().catch(() => null),
    );
    gate.assert(ticket);
    if (res.status === 401) {
      gate.invalidate();
      session = null;
      loginPending = null;
      signedSubmissions.clear();
      connection = {
        status: "error",
        error: "Your service session ended. Sign in again in Settings.",
      };
      emit();
    }
    throw new ServiceError(res.status, refusal.success ? refusal.data : null);
  }
  return res;
}
async function jsonResponse<T>(
  res: Response,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ticket: ReturnType<OwnerSessionGate["ticket"]>,
) {
  const value: unknown = await res.json();
  gate.assert(ticket);
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error("The Mandate service returned an invalid response.");
  return parsed.data;
}
const loginMessage = z
  .object({
    origin: z.string().url(),
    nonce: Hex32Schema,
    deviceId: Hex32Schema,
    issuedAt: Uint64,
    expiresAt: Uint64,
  })
  .strict();
const challengeSchema = z
  .object({
    challengeId: UuidSchema,
    typedData: z
      .object({
        domain: LoginDomainSchema,
        primaryType: z.literal("Login"),
        types: z.record(
          z.array(z.object({ name: z.string(), type: z.string() }).strict()),
        ),
        message: loginMessage,
      })
      .strict(),
  })
  .strict();
const authSchema = z
  .object({
    accessToken: z.string().min(32).max(4096),
    expiresAt: Uint64,
    sessionId: UuidSchema,
    refreshToken: z.string().min(32).max(4096),
    refreshExpiresAt: Uint64,
  })
  .strict();
async function login() {
  const ticket = gate.ticket();
  const account = currentAccount();
  if (!account) throw new Error("Unlock the wallet first.");
  connection = { status: "connecting" };
  emit();
  try {
    const device = await deviceId();
    gate.assert(ticket);
    const init = (body: unknown): RequestInit => ({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const challenge = await jsonResponse(
      await response(
        "/v1/auth/challenge",
        init({ ownerAddress: account.address, deviceId: device }),
        ticket,
      ),
      challengeSchema,
      ticket,
    );
    const expectedTypes = {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Login: LOGIN_TYPES.Login,
    };
    if (
      canonicalJson(challenge.typedData.types) !== canonicalJson(expectedTypes)
    )
      throw new Error("Unexpected sign-in fields.");
    const checked = checkLoginRequest(challenge.typedData, {
      origin: origin(),
      deviceId: device,
      nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
    });
    if (!checked.ok) throw new Error(checked.error);
    const signer = await signerForCurrent("Sign in to Mandate");
    gate.assert(ticket);
    if (signer.address.toLowerCase() !== ticket.owner)
      throw new Error("The account changed. Nothing was signed.");
    const signature = await signer.signTypedData({
      domain: loginDomain,
      types: LOGIN_TYPES,
      primaryType: "Login",
      message: checked.value,
    });
    gate.assert(ticket);
    const verified = await jsonResponse(
      await response(
        "/v1/auth/verify",
        init({ challengeId: challenge.challengeId, signature }),
        ticket,
      ),
      authSchema,
      ticket,
    );
    if (BigInt(verified.expiresAt) <= BigInt(Math.floor(Date.now() / 1000)))
      throw new Error("The service returned an expired session.");
    session = {
      accessToken: verified.accessToken,
      expiresAt: verified.expiresAt,
      sessionId: verified.sessionId,
      owner: account.address,
    };
    connection = { status: "connected" };
    emit();
  } catch (error) {
    try {
      gate.assert(ticket);
      connection = {
        status: "error",
        error: error instanceof Error ? error.message : "Could not sign in.",
      };
      emit();
    } catch {
      /* Previous account's result is discarded. */
    }
    throw error;
  }
}
export function signIn(): Promise<void> {
  if (
    session &&
    BigInt(session.expiresAt) > BigInt(Math.floor(Date.now() / 1000))
  )
    return Promise.resolve();
  if (loginPending) return loginPending;
  const pending = login();
  loginPending = pending;
  void pending
    .finally(() => {
      if (loginPending === pending) loginPending = null;
    })
    .catch(() => undefined);
  return pending;
}
export async function signOut() {
  const current = session;
  gate.invalidate();
  session = null;
  loginPending = null;
  signedSubmissions.clear();
  connection = { status: "disconnected" };
  emit();
  if (current)
    await fetch(`${origin()}/v1/auth/logout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${current.accessToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    }).catch(() => undefined);
}
function authorized() {
  const ticket = gate.ticket();
  if (
    !session ||
    session.owner.toLowerCase() !== ticket.owner ||
    BigInt(session.expiresAt) <= BigInt(Math.floor(Date.now() / 1000))
  ) {
    session = null;
    connection = {
      status: "error",
      error: "Sign in to the Mandate service in Settings.",
    };
    emit();
    throw new Error("Sign in to the Mandate service in Settings.");
  }
  return { ticket, session };
}
export async function get<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  const auth = authorized();
  return jsonResponse(
    await response(
      path,
      { headers: { authorization: `Bearer ${auth.session.accessToken}` } },
      auth.ticket,
    ),
    schema,
    auth.ticket,
  );
}
export async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  const auth = authorized();
  let idempotencyKey = "";
  await updateServiceReferences(auth.session.owner, (value) => {
    const key = operationKey(value.pending, path, body);
    idempotencyKey = key.id;
    return {
      ...value,
      pending: { ...value.pending, [key.fingerprint]: key.id },
    };
  });
  gate.assert(auth.ticket);
  const res = await response(
    path,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${auth.session.accessToken}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    },
    auth.ticket,
  );
  const value = await jsonResponse(res, schema, auth.ticket);
  gate.assert(auth.ticket);
  return value;
}
function ownWallet(wallet: WalletView) {
  if (wallet.owner.toLowerCase() !== authorized().ticket.owner)
    throw new Error("The service wallet belongs to another account.");
  return wallet;
}
export async function createServiceWallet() {
  const wallet = ownWallet(await post("/v1/wallets", {}, WalletViewSchema));
  await updateServiceReferences(wallet.owner, (refs) => ({
    ...refs,
    walletId: wallet.walletId,
  }));
  return wallet;
}
export async function getServiceWallet(walletId: string) {
  UuidSchema.parse(walletId);
  const wallet = ownWallet(
    await get(`/v1/wallets/${walletId}`, WalletViewSchema),
  );
  if (wallet.walletId !== walletId)
    throw new Error("The service returned another wallet.");
  return wallet;
}
export async function registeredServiceWallet() {
  const auth = authorized();
  const refs = await readServiceReferences(auth.session.owner);
  gate.assert(auth.ticket);
  return refs.walletId ? getServiceWallet(refs.walletId) : null;
}
export async function createTask(
  input: z.infer<typeof CreateTaskRequestSchema>,
) {
  const body = CreateTaskRequestSchema.parse(input);
  await getServiceWallet(body.walletId);
  const auth = authorized();
  const task = await post("/v1/tasks", body, TaskViewSchema);
  if (task.walletId !== body.walletId || task.runbookId !== body.runbookId)
    throw new Error("The service returned another task.");
  await updateServiceReferences(auth.session.owner, (refs) => ({
    ...refs,
    tasks: [
      {
        taskId: task.taskId,
        walletId: task.walletId,
        goal: body.goal,
        input: body.input,
      },
      ...refs.tasks.filter((t) => t.taskId !== task.taskId),
    ].slice(0, 100),
  }));
  gate.assert(auth.ticket);
  return task;
}
export async function getTask(taskId: string) {
  UuidSchema.parse(taskId);
  const task = await get(`/v1/tasks/${taskId}`, TaskViewSchema);
  if (task.taskId !== taskId)
    throw new Error("The service returned another task.");
  return task;
}
export async function serviceTaskReferences() {
  const auth = authorized();
  const refs = await readServiceReferences(auth.session.owner);
  gate.assert(auth.ticket);
  return refs.tasks;
}
export async function draftPermit(taskId: string, terms: Terms) {
  return post(
    "/v1/permits/draft",
    PermitDraftRequestSchema.parse({ taskId, terms }),
    OwnerApprovalSchema,
  );
}
export async function permitContext(
  taskId: string,
  terms?: Terms,
): Promise<PermitContext> {
  const auth = authorized();
  const task = await getTask(taskId);
  const wallet = await getServiceWallet(task.walletId);
  const { agentWallet } = await import("./chain");
  const chainWallet = await agentWallet(auth.session.owner);
  gate.assert(auth.ticket);
  if (
    !chainWallet ||
    !wallet.address ||
    chainWallet.address.toLowerCase() !== wallet.address.toLowerCase() ||
    !wallet.executorAddress
  )
    throw new Error(
      "The service wallet does not match this account's on-chain wallet.",
    );
  return {
    wallet,
    task,
    epoch: chainWallet.epoch,
    nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
    agentAssets: AGENT_ASSETS.map((t) => t.address!),
    executor: wallet.executorAddress,
    ...(terms ? { terms } : {}),
  };
}
const activationSchema = z
  .object({
    permitId: Hex32Schema,
    activationTxHash: Hex32Schema.nullable(),
    authorityState: AuthorityStateSchema,
  })
  .strict();
export async function activatePermit(
  draft: OwnerApproval,
  taskId: string,
  terms?: Terms,
) {
  const auth = authorized();
  const context = await permitContext(taskId, terms);
  gate.assert(auth.ticket);
  const checked = validatePermitDraft(draft, context);
  const cacheKey = `${auth.ticket.owner}:${checked.draftId}:${checked.digest}`;
  let ownerSignature = signedSubmissions.get(cacheKey);
  if (!ownerSignature) {
    const signer = await signerForCurrent("Approve this task");
    gate.assert(auth.ticket);
    if (signer.address.toLowerCase() !== auth.ticket.owner)
      throw new Error("The account changed. Nothing was signed.");
    const refreshed = await permitContext(taskId, terms);
    gate.assert(auth.ticket);
    validatePermitDraft(checked, refreshed);
    ownerSignature = await signer.signTypedData({
      domain: walletDomain(context.wallet.address!),
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: permitSigningMessage(checked.typedData.message),
    });
    gate.assert(auth.ticket);
    signedSubmissions.set(cacheKey, ownerSignature);
  }
  const result = await post(
    "/v1/permits/activate",
    { draftId: checked.draftId, ownerSignature },
    activationSchema,
  );
  gate.assert(auth.ticket);
  const permitId = hashStruct({
    data: permitSigningMessage(checked.typedData.message),
    primaryType: "Permit",
    types: PERMIT_TYPES,
  });
  if (result.permitId !== permitId)
    throw new Error("The service activated a different permission.");
  signedSubmissions.delete(cacheKey);
  return result;
}
export async function issueAgentToken(input: {
  walletId: string;
  taskId: string;
  scopes: ("read" | "run" | "evidence")[];
  expiresAt: string;
}) {
  const body = AgentTokenRequestSchema.parse(input);
  const task = await getTask(input.taskId);
  if (
    task.walletId !== input.walletId ||
    !input.scopes.includes("read") ||
    !input.scopes.includes("run") ||
    BigInt(body.expiresAt) <= BigInt(Math.floor(Date.now() / 1000)) ||
    BigInt(body.expiresAt) > BigInt(Math.floor(Date.now() / 1000) + 86400)
  )
    throw new Error(
      "Use a task token with read and run access that expires within 24 hours.",
    );
  return post(
    "/v1/agent-tokens",
    body,
    z.object({ id: UuidSchema, token: z.string().min(32).max(4096) }).strict(),
  );
}
export async function runTask(taskId: string) {
  UuidSchema.parse(taskId);
  const result = await post(`/v1/tasks/${taskId}/run`, {}, TaskViewSchema);
  if (result.taskId !== taskId)
    throw new Error("The service returned another task.");
  return result;
}
export async function compileIntent(walletId: string, goal: string) {
  await getServiceWallet(walletId);
  return post(
    "/v1/intents/compile",
    IntentCompileRequestSchema.parse({ walletId, goal }),
    IntentDraftSchema,
  );
}
export async function getActivity(cursor?: string) {
  const auth = authorized();
  if (cursor && cursor.length > 512)
    throw new Error("Invalid activity cursor.");
  const page = await get(
    `/v1/accounts/${auth.session.owner}/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ActivityPageSchema,
  );
  if (
    page.items.some(
      (item) => item.ownerAddress.toLowerCase() !== auth.ticket.owner,
    )
  )
    throw new Error("The service returned another account's activity.");
  return page;
}
export async function downloadProof(taskId: string): Promise<Uint8Array> {
  UuidSchema.parse(taskId);
  const auth = authorized();
  const res = await response(
    `/v1/tasks/${taskId}/evidence`,
    { headers: { authorization: `Bearer ${auth.session.accessToken}` } },
    auth.ticket,
  );
  return readProofBytes(res, () => gate.assert(auth.ticket));
}
async function approvalPermit(
  approval: PaymentApproval,
  wallet: WalletView,
): Promise<ApprovalPermitContext> {
  const auth = authorized();
  const { agentWallet, client } = await import("./chain");
  const chainWallet = await agentWallet(auth.session.owner);
  gate.assert(auth.ticket);
  if (
    !chainWallet ||
    !wallet.address ||
    chainWallet.address.toLowerCase() !== wallet.address.toLowerCase()
  )
    throw new Error(
      "The payment wallet does not match this account's on-chain wallet.",
    );
  if (chainWallet.paused || chainWallet.frozen)
    throw new Error(
      "The payment wallet is paused or frozen. Nothing was signed.",
    );
  const state = await client.readContract({
    address: wallet.address,
    abi: permitStateAbi,
    functionName: "getPermit",
    args: [approval.action.permitId],
  });
  gate.assert(auth.ticket);
  const permitId = hashStruct({
    data: state.permit,
    primaryType: "Permit",
    types: PERMIT_TYPES,
  });
  if (permitId !== approval.action.permitId)
    throw new Error("The payment's Permit could not be verified on chain.");
  return {
    permitId,
    taskId: state.permit.taskId,
    asset: state.permit.asset,
    epoch: state.permit.epoch,
    currentEpoch: chainWallet.epoch,
    activated: state.activated,
    closed: state.closed,
    revoked: state.revoked,
    startsAt: state.permit.startsAt,
    expiresAt: state.permit.expiresAt,
  };
}
export async function listApprovals(): Promise<PaymentApproval[]> {
  const result = await get(
    "/v1/approvals",
    z.object({ items: z.array(ApprovalRequestSchema) }).strict(),
  );
  return Promise.all(
    result.items
      .filter(
        (approval) =>
          approval.state === "PENDING" &&
          BigInt(approval.expiresAt) > BigInt(Math.floor(Date.now() / 1000)),
      )
      .map(async (approval) => {
        const wallet = await getServiceWallet(approval.walletId);
        const task = await getTask(approval.taskId);
        const permit = await approvalPermit(approval, wallet);
        return validatePaymentApproval(
          approval,
          wallet,
          task,
          BigInt(Math.floor(Date.now() / 1000)),
          permit,
        );
      }),
  );
}
export async function decideApproval(
  approval: PaymentApproval,
  agentWallet: Address,
  approve: boolean,
): Promise<void> {
  const auth = authorized();
  const current = await get(
    `/v1/approvals/${UuidSchema.parse(approval.approvalId)}`,
    ApprovalRequestSchema,
  );
  const wallet = await getServiceWallet(current.walletId);
  const task = await getTask(current.taskId);
  gate.assert(auth.ticket);
  if (
    wallet.address?.toLowerCase() !== agentWallet.toLowerCase() ||
    current.digest !== approval.digest
  )
    throw new Error("The payment approval changed. Review it again.");
  const permit = await approvalPermit(current, wallet);
  const checked = validatePaymentApproval(
    current,
    wallet,
    task,
    BigInt(Math.floor(Date.now() / 1000)),
    permit,
  );
  if (!approve) {
    await post(
      `/v1/approvals/${checked.approvalId}/reject`,
      {},
      z.object({ state: z.literal("REJECTED") }).strict(),
    );
    return;
  }
  const signer = await signerForCurrent("Approve the agent's payment");
  gate.assert(auth.ticket);
  if (signer.address.toLowerCase() !== auth.ticket.owner)
    throw new Error("The account changed. Nothing was signed.");
  const refreshedPermit = await approvalPermit(checked, wallet);
  validatePaymentApproval(
    checked,
    wallet,
    task,
    BigInt(Math.floor(Date.now() / 1000)),
    refreshedPermit,
  );
  gate.assert(auth.ticket);
  const ownerSignature = await signer.signTypedData({
    domain: walletDomain(agentWallet),
    types: APPROVAL_TYPES,
    primaryType: "Approval",
    message: {
      actionDigest: checked.typedData.message.actionDigest,
      expiresAt: BigInt(checked.expiresAt),
    },
  });
  gate.assert(auth.ticket);
  await post(
    `/v1/approvals/${checked.approvalId}/sign`,
    { ownerSignature },
    z.object({ state: z.literal("APPROVED") }).strict(),
  );
}
