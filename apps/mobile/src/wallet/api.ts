// Signed login to the Mandate service (POST /v1/auth/challenge and /verify).
// The phone checks every request before it signs. The access token lives in
// memory only. Without a configured service origin this fails explicitly.
import { useSyncExternalStore } from "react";
import {
  checkLoginRequest,
  LOGIN_TYPES,
  loginDomain,
  walletDomain,
  type LoginTypedData,
} from "./core";
import type { Address, Hex } from "viem";
import { checkApproval } from "./approvals";
import { API_ORIGIN } from "./config";
import { APPROVAL_TYPES } from "./typed";
import { currentAccount, signerForCurrent } from "./session";
import { deviceId } from "./vault";

export interface ApiSession {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
}

let session: ApiSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useApiSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
  );
}

async function post<T>(
  path: string,
  body: unknown,
  token?: string,
  idempotencyKey?: string,
): Promise<T> {
  if (!API_ORIGIN)
    throw new Error("The Mandate service is not configured in this build.");
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`The Mandate service refused the request (${res.status}).`);
  return (await res.json()) as T;
}

export async function signIn() {
  const account = currentAccount();
  if (!account) throw new Error("Unlock the wallet first.");
  const device = await deviceId();
  const { challengeId, typedData } = await post<{
    challengeId: string;
    typedData: LoginTypedData;
  }>("/v1/auth/challenge", { ownerAddress: account.address, deviceId: device });
  const checked = checkLoginRequest(typedData, {
    origin: API_ORIGIN!,
    deviceId: device,
    nowSeconds: BigInt(Math.floor(Date.now() / 1000)),
  });
  if (!checked.ok) throw new Error(checked.error);
  const signer = await signerForCurrent("Sign in to Mandate");
  const signature = await signer.signTypedData({
    domain: loginDomain,
    types: LOGIN_TYPES,
    primaryType: "Login",
    message: checked.value,
  });
  const verified = await post<ApiSession>("/v1/auth/verify", {
    challengeId,
    signature,
  });
  session = verified;
  emit();
}

export async function signOut() {
  const current = session;
  session = null;
  emit();
  if (current)
    await post("/v1/auth/logout", {}, current.accessToken).catch(
      () => undefined,
    );
}

async function get<T>(path: string): Promise<T> {
  if (!API_ORIGIN)
    throw new Error("The Mandate service is not configured in this build.");
  if (!session) throw new Error("Sign in to the Mandate service first.");
  const res = await fetch(`${API_ORIGIN}${path}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  if (!res.ok)
    throw new Error(`The Mandate service refused the request (${res.status}).`);
  return (await res.json()) as T;
}

// A payment the agent wants to make above the review threshold (S9.5).
export interface PaymentApproval {
  approvalId: string;
  walletId: string;
  taskId: string;
  action: { target: Address; amount: string; operation: number };
  invoice: { recipient: Address; amount: string; asset: Address } | null;
  typedData: {
    domain: {
      verifyingContract: Address;
      chainId: number;
      name: string;
      version: string;
    };
    message: { actionDigest: Hex; expiresAt: string };
  };
  rationale: string | null;
  expiresAt: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
}

export async function listApprovals(): Promise<PaymentApproval[]> {
  const data = await get<{ items?: PaymentApproval[] } | PaymentApproval[]>(
    "/v1/approvals",
  );
  return Array.isArray(data) ? data : (data.items ?? []);
}

// Signs one payment approval after checking it is for this account's agent
// wallet, uses the MandateWallet v5 domain and lasts at most 15 minutes.
export async function decideApproval(
  approval: PaymentApproval,
  agentWallet: Address,
  approve: boolean,
): Promise<void> {
  if (!session) throw new Error("Sign in to the Mandate service first.");
  const key = `${approval.approvalId}:${approve ? "sign" : "reject"}`;
  if (!approve) {
    await post(
      `/v1/approvals/${approval.approvalId}/reject`,
      {},
      session.accessToken,
      key,
    );
    return;
  }
  const d = approval.typedData.domain;
  const expected = walletDomain(agentWallet);
  if (
    d.verifyingContract.toLowerCase() !== agentWallet.toLowerCase() ||
    d.name !== expected.name ||
    d.version !== expected.version ||
    Number(d.chainId) !== expected.chainId
  )
    throw new Error(
      "This approval is not for your agent wallet. Nothing was signed.",
    );
  const checked = checkApproval(
    approval.typedData.message,
    BigInt(Math.floor(Date.now() / 1000)),
  );
  if (!checked.ok) throw new Error(checked.error);
  const signer = await signerForCurrent("Approve the agent's payment");
  const ownerSignature = await signer.signTypedData({
    domain: expected,
    types: APPROVAL_TYPES,
    primaryType: "Approval",
    message: checked.value,
  });
  await post(
    `/v1/approvals/${approval.approvalId}/sign`,
    { ownerSignature },
    session.accessToken,
    key,
  );
}
