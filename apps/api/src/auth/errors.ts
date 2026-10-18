import type { ApiError } from "@mandate/schema";

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: ApiError["code"] = "AUTH_SCOPE",
  ) {
    super(message);
  }
}
export function denied(
  message = "Owner session is invalid or expired.",
): never {
  throw new AuthError(401, message);
}
export function apiError(error: AuthError): ApiError {
  return {
    code: error.code,
    message: error.message,
    actionId: null,
    evidenceId: null,
    retryable: error.status === 503 || error.status === 429,
  };
}
