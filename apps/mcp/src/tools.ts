import { MandateClient } from "@mandate/sdk";

export const MCP_TOOLS = [
  {
    name: "mandate_get_wallet",
    description: "Query status, spending balance, and limits of a Mandate managed wallet",
    inputSchema: {
      type: "object",
      properties: {
        walletId: { type: "string", description: "UUID of the wallet to inspect" },
      },
      required: ["walletId"],
    },
  },
  {
    name: "mandate_prepare_task",
    description: "Prepare a bounded task proposal (browser-check, liquidity-keeper, scheduled-pay) for owner approval",
    inputSchema: {
      type: "object",
      properties: {
        runbookId: { type: "string", enum: ["browser-check", "liquidity-keeper", "scheduled-pay"] },
        goal: { type: "string", description: "Human-readable description of the task goal" },
        input: { type: "object", description: "Typed parameters matching the runbook requirement" },
      },
      required: ["runbookId", "input"],
    },
  },
  {
    name: "mandate_get_task",
    description: "Query the status and execution state of an existing task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "UUID of the task" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "mandate_run_task",
    description: "Request the execution of an approved task under active permit boundaries",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "UUID of the task to run" },
        idempotencyKey: { type: "string", description: "Optional idempotency key" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "mandate_get_evidence",
    description: "Retrieve signed execution evidence and audit bundle for a completed task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "UUID of the task" },
      },
      required: ["taskId"],
    },
  },
];

export async function handleToolCall(
  client: MandateClient,
  toolName: string,
  args: any,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  let result: unknown;

  switch (toolName) {
    case "mandate_get_wallet":
      result = await client.getWallet(args.walletId);
      break;
    case "mandate_prepare_task":
      result = await client.prepareTask(args);
      break;
    case "mandate_get_task":
      result = await client.getTask(args.taskId);
      break;
    case "mandate_run_task":
      result = await client.runTask(args.taskId, args.idempotencyKey);
      break;
    case "mandate_get_evidence":
      result = await client.getEvidence(args.taskId);
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  // Sanitize result: never return authorization tokens or credentials in tool output
  const text = JSON.stringify(result, (key, value) => {
    if (key === "token" || key === "jwt" || key === "apiKey" || key === "secret") {
      return "[REDACTED]";
    }
    return value;
  }, 2);

  return {
    content: [{ type: "text", text }],
  };
}
