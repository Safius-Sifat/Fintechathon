import readline from "node:readline";
import { MandateClient } from "@mandate/sdk";
import { MCP_TOOLS, handleToolCall } from "./tools.js";

const client = new MandateClient({
  baseUrl: process.env.MANDATE_API_URL || "https://api.mandate.example",
  token: process.env.MANDATE_AGENT_TOKEN || "",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    const { id, method, params } = req;

    if (method === "initialize") {
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mandate-mcp", version: "0.1.0" },
      });
      return;
    }

    if (method === "tools/list") {
      sendResponse(id, { tools: MCP_TOOLS });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments ?? {};
      const res = await handleToolCall(client, toolName, args);
      sendResponse(id, res);
      return;
    }

    sendError(id, -32601, `Method not found: ${method}`);
  } catch (err: any) {
    sendError(null, -32700, `Parse error: ${err.message}`);
  }
});

function sendResponse(id: any, result: any) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id: any, code: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}
