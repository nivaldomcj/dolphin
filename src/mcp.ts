import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { readBoard } from "./db";
import { refresh } from "./refresh";
import { RULES } from "./rules";

function buildServer(): McpServer {
  const mcp = new McpServer({ name: "dolphin", version: "0.1.0" });

  mcp.registerTool(
    "get_board",
    { description: "Read the lane rules, then every lane with its tasks in order, and the manual dependency edges." },
    async () => ({ content: [{ type: "text", text: JSON.stringify({ rules: RULES, ...readBoard() }) }] }),
  );

  mcp.registerTool(
    "refresh",
    { description: "Pull task statuses from Linear and GitHub. Returns the status changes, new unplaced tasks and per-source errors." },
    async () => ({ content: [{ type: "text", text: JSON.stringify(await refresh()) }] }),
  );

  return mcp;
}

/** Stateless MCP over HTTP: one server and transport per request is enough for one local client. */
export async function handleMcp(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await buildServer().connect(transport);
  return transport.handleRequest(req);
}
