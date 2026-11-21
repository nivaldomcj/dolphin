import { afterEach, beforeEach, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { OFFLINE, withConfig } from "../../test/config";
import { laneRow, placements, resetDb, taskRow } from "../../test/db";
import { db } from "../db";
import { writeRules } from "../core/rules";
import { buildServer, handleMcp } from "./mcp";

let client: Client;

beforeEach(async () => {
  await resetDb();
  await writeRules({ text: "", pins: [] });
  await db
    .insertInto("lane")
    .values([laneRow("A", 0), laneRow("B", 1)])
    .execute();
  await db
    .insertInto("task")
    .values([taskRow("T1"), taskRow("T2")])
    .execute();
  await db
    .insertInto("placement")
    .values(placements("A", ["T1", "T2"]))
    .execute();

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await buildServer().connect(serverSide);
  client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
});

afterEach(() => client.close());

type Reply = { content: { type: string; text: string }[]; isError?: boolean };
const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as Reply;
const json = (r: Reply) => JSON.parse(r.content[0]!.text);

test("lists every tool", async () => {
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  expect(names).toEqual([
    "add_edge",
    "get_board",
    "get_rules",
    "place_task",
    "refresh",
    "remove_edge",
    "rename_lane",
    "reorder_lane",
    "set_note",
    "set_rules",
    "unplace_task",
  ]);
});

test("get_board returns the rules, the warnings and the lanes in one reply", async () => {
  const board = json(await call("get_board"));

  expect(board.rules).toEqual({ text: "", pins: [] });
  expect(board.warnings).toEqual([]);
  expect(board.lanes.map((l: { key: string; ids: string[] }) => [l.key, l.ids])).toEqual([
    ["A", ["T1", "T2"]],
    ["B", []],
  ]);
});

test("place_task moves the task and reports it", async () => {
  const result = json(await call("place_task", { id: "T2", lane: "B" }));

  expect(result).toEqual({ done: "T2 is now B#1.", warnings: [] });
  expect(json(await call("get_board")).lanes[1].ids).toEqual(["T2"]);
});

test("an arrange error comes back as a tool error Claude can read", async () => {
  const reply = await call("place_task", { id: "T1", lane: "Z" });

  expect(reply.isError).toBe(true);
  expect(reply.content[0]!.text).toBe("Unknown lane Z");
});

test("set_rules rejects a pin with neither kind nor app, and keeps the old pins", async () => {
  const reply = await call("set_rules", { pins: [{ lane: "A", label: "everything" }] });

  expect(reply.isError).toBe(true);
  expect(reply.content[0]!.text).toContain("A pin needs `kind`, `app` or both.");
  expect(json(await call("get_rules")).pins).toEqual([]);
});

test("set_rules writes a part and returns the warnings it gives", async () => {
  const reply = json(await call("set_rules", { pins: [{ lane: "B", app: "x", label: "x task" }] }));

  expect(reply).toEqual({ text: "", pins: [{ lane: "B", app: "x", label: "x task" }], warnings: [] });
});

test("add_edge, set_note and rename_lane write through the tools", async () => {
  await call("add_edge", { blocker: "T1", blocked: "T2" });
  await call("set_note", { id: "T1", note: "hello" });
  await call("rename_lane", { lane: "B", name: "Next" });

  const board = json(await call("get_board"));
  expect(board.edges).toEqual([["T1", "T2"]]);
  expect(board.tasks.T1.note).toBe("hello");
  expect(board.lanes[1].name).toBe("Next");
});

test("the HTTP endpoint answers a stateless JSON-RPC call", async () => {
  const res = await handleMcp(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
      }),
    }),
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { id: number; result: { serverInfo: { name: string } } };
  expect(body.id).toBe(1);
  expect(body.result.serverInfo.name).toBe("dolphin");
});

test("reorder_lane sets the full order of a lane", async () => {
  expect(json(await call("reorder_lane", { lane: "A", ids: ["T2", "T1"] }))).toEqual({ done: "Lane A reordered (2 tasks).", warnings: [] });
  expect(json(await call("get_board")).lanes[0].ids).toEqual(["T2", "T1"]);
});

test("unplace_task takes a task out of its lane, into lane N", async () => {
  expect(json(await call("unplace_task", { id: "T1" }))).toEqual({ done: "T1 removed from lane A.", warnings: [] });
  const lanes = json(await call("get_board")).lanes.map((l: { key: string; ids: string[] }) => [l.key, l.ids]);
  expect(lanes).toEqual([
    ["A", ["T2"]],
    ["B", []],
    ["N", ["T1"]],
  ]);
});

test("remove_edge deletes a dependency, and says when there was none", async () => {
  await call("add_edge", { blocker: "T1", blocked: "T2" });

  expect(json(await call("remove_edge", { blocker: "T1", blocked: "T2" })).done).toBe("T1 no longer blocks T2.");
  expect(json(await call("remove_edge", { blocker: "T1", blocked: "T2" })).done).toBe("There was no edge T1 → T2.");
  expect(json(await call("get_board")).edges).toEqual([]);
});

test("refresh reports what the trackers changed", async () => {
  // No tracker and no backup, so the tool reaches neither the network nor the backup folder.
  await withConfig(OFFLINE, async () => {
    expect(json(await call("refresh"))).toEqual({ changes: [], added: [], errors: {} });
  });
});
