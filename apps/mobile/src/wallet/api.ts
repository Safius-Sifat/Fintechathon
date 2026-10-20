// Signed login to the Mandate service (POST /v1/auth/challenge and /verify).
// The phone checks every request before it signs. The access token lives in
// memory only. Without a configured service origin this fails explicitly.
import { useSyncExternalStore } from "react";
import {
  checkLoginRequest,
  LOGIN_TYPES,
  loginDomain,
  type LoginTypedData,
} from "./core";
import { API_ORIGIN } from "./config";
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
): Promise<T> {
  if (!API_ORIGIN)
    throw new Error("The Mandate service is not configured in this build.");
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
