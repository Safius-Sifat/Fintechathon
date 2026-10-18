import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

test("release API trusts only the configured loopback Caddy ingress", async () => {
  const caddy = await readFile("infra/azure/configure-app-host.sh", "utf8");
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:3000/);
  for (const file of ["compose.foundation.yaml", "compose.wallet.yaml"]) {
    const compose = parse(await readFile("infra/release/" + file, "utf8"));
    assert.equal(compose.services.api.network_mode, "host");
    assert.equal(compose.services.api.environment.API_HOST, "127.0.0.1");
    assert.equal(
      compose.services.api.environment.API_TRUSTED_PROXY_ADDRESSES,
      "127.0.0.1",
    );
  }
});
