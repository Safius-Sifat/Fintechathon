# Owner API sessions — M0/W0

The API consumes Person1's shared Login2/session schemas. This implements server authentication and session storage. Native HTTPS exchange, Android signing/device storage, financial provisioning and MPC acceptance still need their owners' integration evidence. `/readyz` remains 503.

## Configuration and database

Run the existing migration target before enabling auth. `0002_auth_sessions.sql` is a forward-only expansion with owners, one-use challenges, session/family/token history, bounded rate windows and owner mutation idempotency. The migrator owns DDL; the runtime role needs SELECT/INSERT/UPDATE/DELETE in its configured schema. Existing verified TLS and `mandate_runtime` role requirements apply. Production's `mandate` search path continues to select the schema; no table is pinned to `public`.

Set `AUTH_ORIGIN` to the exact HTTPS API origin without a trailing slash or path. The shared LoginSchema requires HTTPS, including the logical origin in local tests. Set `AUTH_JWT_SECRET_FILE` to a server-only mounted file containing canonical unpadded base64url encoding of at least 32 cryptographically random bytes. Do not commit this file or send its content to clients. The issuer is `AUTH_ORIGIN`, the audience is `mandate-owner-api`, and access tokens use jose with fixed HS256 and `owner+jwt` type. Use a distinct signing key per environment. Replacing the key invalidates existing access tokens; refresh tokens remain governed by their database sessions. Missing/invalid auth settings leave health available and make auth routes return 503; no default signing key exists.

The challenge/verify/refresh endpoints share database-backed limits: 1,000 requests per server minute globally and 60 per resolved client IP; challenge issuance additionally allows 10 per owner address. Proxy trust is disabled by default. Production release Compose explicitly sets `API_TRUSTED_PROXY_ADDRESSES=127.0.0.1` for the host-network API bound to loopback, matching Caddy's `reverse_proxy 127.0.0.1:3000`. This comma-separated setting accepts at most 16 exact IP addresses; hostnames, network ranges and unconditional trust are rejected. Fastify resolves forwarding chains from the socket peer through trusted addresses and stops at the nearest untrusted client. Untrusted direct peers cannot choose a rate bucket through `X-Forwarded-For`, and a caller's extra forwarding prefix cannot override that nearest client. Configure only ingress addresses controlled by the deployment; other host-local processes share the trusted host boundary. Provider/policy services keep proxy trust disabled. An ingress may enforce additional limits. Authentication bodies are limited to 8 KiB. Expired challenges are removed after a five-minute post-expiry retention window on challenge issuance; rate rows retain at most the current/prior minute during traffic. Session, token-history and idempotency records remain durable. Retain used token hashes for the entire family lifetime; deleting them early would disable replay detection. A later operational retention job may prune expired families and their dependent rows together.

## Native exchange

1. `POST /v1/auth/challenge {ownerAddress,deviceId}` returns `{challengeId,typedData}`. `deviceId` is 32-byte installation identity, not hardware attestation. Native must check the selected owner, configured origin, exact Login2 domain, device and five-minute bounds before signing. The server uses its own origin/domain and stored challenge; caller supplied typed data is rejected.
2. `POST /v1/auth/verify {challengeId,signature}` consumes the exact challenge once and returns the shared `AuthTokens` shape: `{accessToken,expiresAt,sessionId,refreshToken,refreshExpiresAt}`. All times are decimal Unix-second strings. Every signed login creates a distinct session, even for the same owner/device.
3. `POST /v1/auth/refresh {sessionId,refreshToken}` atomically replaces the opaque 32-byte credential and returns the same shape. Access tokens last 15 minutes. Refresh allows seven days of idle time, capped at 30 days from the signed login. `auth_time` never advances through refresh. The database stores only SHA-256 refresh hashes.

Only NativeSession's protected HTTPS exchange should receive/store refresh credentials. It returns access token/session metadata to React Native. Never persist refresh tokens in AsyncStorage, analytics, crash reports or logs. Native must single-flight refresh for each account. A consumed-token replay revokes the entire family and its session, including JWTs issued by the winning concurrent refresh. A lost refresh response requires a fresh signed login. A random invalid token does not revoke a family. Failure never changes seed/address.

## Owner routes

Use `Authorization: Bearer <accessToken>`. Each request checks JWT signature, algorithm, type, issuer, audience, expiry and the live database session's owner/device/original authentication time. Agent tokens cannot authenticate here. Database failure returns 503 and denies private access.

- `GET /v1/auth/sessions` returns `{items:SessionView[]}` for this owner only, including revoked sessions. `current` is relative to the calling session. The currently supported device label is an empty string. Last use records signed login/refresh; idle expiry measures refresh activity.
- `POST /v1/auth/logout {}` returns `{revoked:true}` and revokes the current API session/family only.
- `POST /v1/auth/sessions/revoke {sessionIds:["<uuid>"]}` or `{sessionIds:"ALL"}` returns `{revokedIds:[...]}`. This requires a signed login at most five minutes old. A list may contain at most 100 IDs; every ID must belong to the owner or the whole request fails 403.

Both owner POST routes require a UUID `Idempotency-Key`. The key is scoped to owner and route; the same canonical body returns its original response, a changed body returns 409. Current authorization and recent-login requirements run before idempotency lookup, so a revoked session cannot retrieve a cached success. A successful logout immediately makes retries with that session return 401. Use a new key for a new operation.

Logout and session administration have no on-chain effect and do not revoke agent tokens or Permits. Financial routes remain explicit `NOT_IMPLEMENTED` responses. Local keys and the independent RPC wallet path are outside this API session.

## Error examples for mobile

Every auth error matches shared `ApiError`: `{code,message,actionId:null,evidenceId:null,retryable}`. Existing shared codes are reused; no new schema codes were introduced.

| HTTP | Example message                                                                     | Code              | Client action                                                          |
| ---- | ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| 401  | Login challenge is invalid, expired or consumed.                                    | AUTH_SCOPE        | Obtain a new challenge and native signature.                           |
| 401  | Refresh credential expired, invalid or family revoked; complete a new signed login. | AUTH_SCOPE        | Clear stored API credentials and request signed login.                 |
| 401  | Owner session is invalid or expired.                                                | AUTH_SCOPE        | Try native single-flight refresh if available; otherwise signed login. |
| 401  | A recent owner-signed login is required.                                            | REAUTH_REQUIRED   | Obtain an actual new signed login before session administration.       |
| 403  | Session is outside this owner's scope.                                              | AUTH_SCOPE        | Check selected account/session IDs.                                    |
| 409  | Idempotency key was used with a different body.                                     | DUPLICATE_REQUEST | Use a new key for a different operation.                               |
| 415  | Authentication requests require application/json.                                   | AUTH_SCOPE        | Send JSON with the correct Content-Type.                               |
| 422  | Request does not match the shared API schema.                                       | AUTH_SCOPE        | Correct the request.                                                   |
| 429  | Authentication rate limit exceeded.                                                 | AUTH_SCOPE        | Back off until the next minute.                                        |
| 503  | Authentication backend unavailable.                                                 | AUTH_SCOPE        | Keep local wallet available, retry backend later.                      |

Only 429/503 set `retryable:true`. Responses use `Cache-Control: no-store`. Server logs redact authorization/cookie headers and do not log authentication bodies or token response contents.

## Executable acceptance

`pnpm --filter @mandate/api check` includes strict typechecking of source and tests plus configuration/health tests. `pnpm test:db` starts pinned disposable PostgreSQL 16.10 with verified TLS and runs both platform migration acceptance and API HTTP/database tests. CI invokes both commands. Fixtures use only public Anvil test keys and shared Login2 digests. These are server consumer tests; physical-device signing/NativeSession integration and complete-app acceptance remain pending.
