import test from "node:test";
import assert from "node:assert/strict";
import { MCP_TOOLS, handleToolCall } from "../src/tools.js";
import { MandateClient } from "@mandate/sdk";

test("mcp: lists 5 scoped tools without raw signing bypass", () => {
  assert.equal(MCP_TOOLS.length, 5);
  const toolNames = MCP_TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes("mandate_get_wallet"));
  assert.ok(toolNames.includes("mandate_prepare_task"));
  assert.ok(toolNames.includes("mandate_get_task"));
  assert.ok(toolNames.includes("mandate_run_task"));
  assert.ok(toolNames.includes("mandate_get_evidence"));

  // Verify none of the tools allow raw signing or admin override
  assert.ok(!toolNames.includes("mandate_sign_raw"));
  assert.ok(!toolNames.includes("mandate_admin_override"));
});

test("mcp: handleToolCall executes tool and redacts secrets", async () => {
  const mockClient = {
    getTask: async (id: string) => ({
      taskId: id,
      status: "COMPLETED",
      token: "secret-token-to-redact",
      otherData: "public",
    }),
  } as unknown as MandateClient;

  const res = await handleToolCall(mockClient, "mandate_get_task", { taskId: "task-123" });
  assert.ok(res.content[0]?.text);
  assert.ok(res.content[0].text.includes("[REDACTED]"));
  assert.ok(!res.content[0].text.includes("secret-token-to-redact"));
  assert.ok(res.content[0].text.includes("public"));
});
