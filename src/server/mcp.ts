import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { addEdge, checkRules, placeTask, removeEdge, renameLane, reorderLane, setNote, unplaceTask, type ArrangeResult } from "../core/arrange";
import { readBoard } from "../core/board";
import { refresh } from "../core/refresh";
import { readRules, writeRules } from "../core/rules";

type ToolReply = { content: { type: "text"; text: string }[]; isError?: boolean };

const reply = (value: unknown): ToolReply => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

/** Runs a write and reports a thrown error as a tool error, so Claude can read it and correct the call. */
async function write(fn: () => Promise<ArrangeResult>): Promise<ToolReply> {
  try {
    return reply(await fn());
  } catch (e) {
    return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
  }
}

const taskId = z.string().describe("Task id, e.g. ENG-123");

const pin = z
  .object({
    lane: z.string().describe("The lane matching tasks belong in"),
    kind: z.string().min(1).optional().describe("Match tasks whose meta.kind is exactly this"),
    app: z.string().min(1).optional().describe("Match tasks whose meta.app contains this, any case"),
    label: z.string().min(1).describe('How a warning names the task, e.g. "release run"'),
  })
  .refine((p) => p.kind !== undefined || p.app !== undefined, "A pin needs `kind`, `app` or both.");
const laneKey = z.string().describe("Lane key, e.g. A");

/** One MCP server with every dolphin tool. Exported for tests, which connect a client to it in memory. */
export function buildServer(): McpServer {
  const mcp = new McpServer({ name: "dolphin", version: "0.3.0" });

  mcp.registerTool(
    "get_board",
    { description: "Read the lane rules, every lane with its tasks in order, the dependency edges, and the current rule warnings. Call it before arranging." },
    async () => reply({ rules: await readRules(), warnings: await checkRules(), ...(await readBoard()) }),
  );

  mcp.registerTool(
    "get_rules",
    { description: "Read the lane rules: the free text Claude follows when arranging, and the pins the warnings check." },
    async () => reply(await readRules()),
  );

  mcp.registerTool(
    "set_rules",
    {
      description: "Replace the rules text, the pins, or both. A part left out stays as it is. Returns the rules and the warnings they now give.",
      inputSchema: { text: z.string().optional(), pins: z.array(pin).optional() },
    },
    async ({ text, pins }) => {
      const rules = await writeRules({ text, pins });
      return reply({ ...rules, warnings: await checkRules() });
    },
  );

  mcp.registerTool(
    "refresh",
    { description: "Pull task statuses from Linear and GitHub. Returns the status changes, new unplaced tasks (lane N) and per-source errors." },
    async () => reply(await refresh()),
  );

  mcp.registerTool(
    "place_task",
    {
      description: "Move a task to a lane at a 1-based position (default: the end). Use it for unplaced tasks and for moves inside a lane.",
      inputSchema: { id: taskId, lane: laneKey, position: z.number().int().min(1).optional() },
    },
    async ({ id, lane, position }) => write(() => placeTask(id, lane, position)),
  );

  mcp.registerTool(
    "reorder_lane",
    {
      description: "Set the full order of one lane. The list must hold exactly the lane's current tasks, each once.",
      inputSchema: { lane: laneKey, ids: z.array(taskId) },
    },
    async ({ lane, ids }) => write(() => reorderLane(lane, ids)),
  );

  mcp.registerTool(
    "unplace_task",
    { description: "Take a task out of its lane. An open task then shows in lane N.", inputSchema: { id: taskId } },
    async ({ id }) => write(() => unplaceTask(id)),
  );

  mcp.registerTool(
    "add_edge",
    {
      description: "Record that `blocker` must finish before `blocked` starts. Rejects loops.",
      inputSchema: { blocker: taskId, blocked: taskId },
    },
    async ({ blocker, blocked }) => write(() => addEdge(blocker, blocked)),
  );

  mcp.registerTool(
    "remove_edge",
    { description: "Delete a dependency edge.", inputSchema: { blocker: taskId, blocked: taskId } },
    async ({ blocker, blocked }) => write(() => removeEdge(blocker, blocked)),
  );

  mcp.registerTool(
    "rename_lane",
    { description: "Change a lane's name, for example at a new cycle.", inputSchema: { lane: laneKey, name: z.string().min(1) } },
    async ({ lane, name }) => write(() => renameLane(lane, name)),
  );

  mcp.registerTool(
    "set_note",
    { description: "Set the note shown in a card's tooltip. An empty string removes it.", inputSchema: { id: taskId, note: z.string() } },
    async ({ id, note }) => write(() => setNote(id, note)),
  );

  return mcp;
}

/** Stateless MCP over HTTP: one server and transport per request is enough for one local client. */
export async function handleMcp(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await buildServer().connect(transport);
  return transport.handleRequest(req);
}
