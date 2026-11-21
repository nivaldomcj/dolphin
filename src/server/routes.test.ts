import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { config } from "../config";
import { db } from "../db";
import { makeGuard } from "./guard";
import { apiRoutes } from "./routes";

const routes = apiRoutes(makeGuard(() => 4747));
const host = { host: "localhost:4747" };

const saved = { linear: config.linear, github: config.github, backup: config.backup };
beforeAll(() => {
  // /api/refresh must not reach Linear, GitHub or the backup folder.
  Object.assign(config, { linear: false, github: undefined, backup: false });
});
afterAll(() => {
  Object.assign(config, saved);
});

beforeEach(async () => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await db.deleteFrom(table).execute();
  await db.insertInto("lane").values([{ key: "A", name: "a", bg: "", head: "", ord: 0 }, { key: "B", name: "b", bg: "", head: "", ord: 1 }]).execute();
  const task = (id: string) => ({ id, source: "linear" as const, title: id, status: "Todo", url: "", meta: "{}" });
  await db.insertInto("task").values([task("T1"), task("T2")]).execute();
  await db.insertInto("placement").values([{ task_id: "T1", lane_key: "A", pos: 0 }, { task_id: "T2", lane_key: "A", pos: 1 }]).execute();
});

const post = (body: unknown, headers: Record<string, string> = host) =>
  routes["/api/move"].POST(new Request("http://localhost/api/move", { method: "POST", headers, body: JSON.stringify(body) }));
type Lanes = { lanes: { key: string; ids: string[] }[] };
const ids = (board: Lanes, key: string) => board.lanes.find((l) => l.key === key)?.ids;

test("GET /api/board returns the board", async () => {
  const res = await routes["/api/board"](new Request("http://localhost/api/board", { headers: host }));

  expect(res.status).toBe(200);
  expect(ids((await res.json()) as Lanes, "A")).toEqual(["T1", "T2"]);
});

test("a move saves and replies with its result and the new board", async () => {
  const res = await post({ id: "T1", lane: "B" });

  expect(res.status).toBe(200);
  const body = (await res.json()) as { result: { done: string }; board: Lanes };
  expect(body.result.done).toBe("T1 is now B#1.");
  expect(ids(body.board, "B")).toEqual(["T1"]);
});

test("a move next to a card lands on that side", async () => {
  const res = await post({ id: "T2", lane: "A", at: { id: "T1", side: "before" } });

  expect(ids(((await res.json()) as { board: Lanes }).board, "A")).toEqual(["T2", "T1"]);
});

test("a malformed move is a 400 that still carries the board", async () => {
  const res = await post({ id: "T1", lane: "B", extra: true });

  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string; board: Lanes };
  expect(body.error).toBe("Bad move request.");
  expect(ids(body.board, "A")).toEqual(["T1", "T2"]);
});

test("a move the board refuses is a 400 with the reason", async () => {
  const res = await post({ id: "T1", lane: "Z" });

  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("Unknown lane Z");
});

test("a body that is not JSON is a 400, not a crash", async () => {
  const res = await routes["/api/move"].POST(new Request("http://localhost/api/move", { method: "POST", headers: host, body: "not json" }));

  expect(res.status).toBe(400);
});

test("a request from a foreign host is refused before it reaches the board", async () => {
  const res = await post({ id: "T1", lane: "B" }, { host: "evil.example:4747" });

  expect(res.status).toBe(403);
  const board = (await (await routes["/api/board"](new Request("http://localhost/api/board", { headers: host }))).json()) as Lanes;
  expect(ids(board, "A")).toEqual(["T1", "T2"]);
});

test("POST /api/refresh replies with the summary and the board", async () => {
  const res = await routes["/api/refresh"].POST(new Request("http://localhost/api/refresh", { method: "POST", headers: host }));

  expect(res.status).toBe(200);
  const body = (await res.json()) as { summary: unknown; board: Lanes };
  expect(body.summary).toEqual({ changes: [], added: [], errors: {} });
  expect(ids(body.board, "A")).toEqual(["T1", "T2"]);
});
