// Only the app VM uses this helper. Tokens never leave this process or enter logs.
export async function managedToken(resource, request = fetch) {
  if (
    !["https://vault.azure.net", "https://storage.azure.com/"].includes(
      resource,
    )
  )
    throw Error("TOKEN_RESOURCE_DENIED");
  const query = new URLSearchParams({ "api-version": "2018-02-01", resource });
  const r = await request(
    "http://169.254.169.254/metadata/identity/oauth2/token?" + query,
    {
      headers: { Metadata: "true" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok) throw Error("MANAGED_IDENTITY_UNAVAILABLE");
  const result = await r.json();
  if (typeof result.access_token !== "string" || !result.access_token)
    throw Error("MANAGED_IDENTITY_TOKEN_INVALID");
  return result.access_token;
}
