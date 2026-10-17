import { test } from "node:test";
import assert from "node:assert/strict";
import { managedToken } from "../vm-identity.mjs";
import { commandSucceeded } from "../run-command-result.mjs";
test("Azure Run Command guest sentinel required even when provisioning succeeds", () => {
  const sha = "a".repeat(40);
  assert.equal(
    commandSucceeded(
      {
        value: [
          {
            code: "ProvisioningState/succeeded",
            message:
              "Enable succeeded: \n[stdout]\nMANDATE_DEPLOY_OK " +
              sha +
              "\n\n[stderr]\n",
          },
        ],
      },
      sha,
    ),
    true,
  );
  assert.equal(
    commandSucceeded(
      {
        value: [
          { code: "ProvisioningState/succeeded", message: "Script failed" },
        ],
      },
      sha,
    ),
    false,
  );
  assert.equal(
    commandSucceeded(
      { value: [{ message: "MANDATE_DEPLOY_OK " + sha }] },
      "b".repeat(40),
    ),
    false,
  );
});
test("VM token helper uses IMDS metadata header and bounded allowed audience", async () => {
  let called = false;
  const token = await managedToken(
    "https://vault.azure.net",
    async (url, options) => {
      called = true;
      assert.ok(
        url.startsWith(
          "http://169.254.169.254/metadata/identity/oauth2/token?",
        ),
      );
      assert.equal(options.headers.Metadata, "true");
      assert.equal(options.redirect, "error");
      return {
        ok: true,
        json: async () => ({ access_token: "test-only-token" }),
      };
    },
  );
  assert.equal(token, "test-only-token");
  assert.equal(called, true);
  await assert.rejects(
    managedToken("https://untrusted.example", async () => {
      throw Error("must not run");
    }),
    /DENIED/,
  );
  await assert.rejects(
    managedToken("https://vault.azure.net", async () => ({ ok: false })),
    /UNAVAILABLE/,
  );
});
