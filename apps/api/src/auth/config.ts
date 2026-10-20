import { readFile } from "node:fs/promises";

export type AuthConfig = {
  origin: string;
  signingKey: Uint8Array;
  issuer: string;
  audience: string;
};

export function validateAuthConfig(config: AuthConfig): AuthConfig {
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== config.origin ||
    origin.username ||
    origin.password ||
    config.signingKey.byteLength < 32 ||
    !config.issuer ||
    !config.audience
  )
    throw new Error("Invalid authentication configuration");
  return config;
}

export async function loadAuthConfig(
  env: NodeJS.ProcessEnv,
): Promise<AuthConfig | null> {
  // The key comes from a file or, in the release container, the runtime env file.
  if (!env.AUTH_ORIGIN || (!env.AUTH_JWT_SECRET_FILE && !env.AUTH_JWT_SECRET))
    return null;
  const encoded = env.AUTH_JWT_SECRET_FILE
    ? (await readFile(env.AUTH_JWT_SECRET_FILE, "utf8")).trim()
    : env.AUTH_JWT_SECRET!.trim();
  if (!/^[A-Za-z0-9_-]{43,}$/.test(encoded))
    throw new Error("Invalid authentication key encoding");
  const signingKey = Buffer.from(encoded, "base64url");
  if (signingKey.toString("base64url") !== encoded)
    throw new Error("Noncanonical authentication key");
  return validateAuthConfig({
    origin: env.AUTH_ORIGIN,
    issuer: env.AUTH_ORIGIN,
    audience: "mandate-owner-api",
    signingKey,
  });
}
