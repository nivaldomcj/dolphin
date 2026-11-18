import { beforeEach, expect, mock, test } from "bun:test";
import { db } from "../db";
import type { Fact } from "../sources/types";

const fact = (id: string, status: string, closed = false): Fact => ({ id, source: "linear", title: `${id} title`, status, url: `https://x/${id}`, closed });

let linear: () => Promise<Fact[]> = async () => [];
let github: () => Promise<Fact[]> = async () => [];
mock.module("../sources/linear", () => ({ fetchLinear: () => linear() }));
mock.module("../sources/github", () => ({ fetchGithub: () => github() }));
// Imported after the mocks, so refresh.ts binds to them.
const { refresh } = await import("./refresh");
const { readBoard } = await import("./board");

beforeEach(async () => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await db.deleteFrom(table).execute();
  await db.insertInto("lane").values({ key: "A", name: "a", bg: "", head: "", ord: 0 }).execute();
  await db
    .insertInto("task")
    .values([
      { id: "L1", source: "linear", title: "L1 title", status: "Todo", url: "https://x/L1", meta: JSON.stringify({ note: "keep me" }) },
      { id: "G1", source: "github", title: "G1 title", status: "Backlog", url: "https://x/G1", meta: "{}" },
    ])
    .execute();
  await db.insertInto("placement").values([{ task_id: "L1", lane_key: "A", pos: 0 }, { task_id: "G1", lane_key: "A", pos: 1 }]).execute();
  linear = async () => [];
  github = async () => [];
});

test("writes status changes, adds new open tasks, skips new closed ones", async () => {
  linear = async () => [fact("L1", "Done", true), fact("L2", "Todo"), fact("L3", "Done", true)];

  const summary = await refresh();

  expect(summary).toEqual({ changes: [{ id: "L1", from: "Todo", to: "Done" }], added: ["L2"], errors: {} });
  const board = await readBoard();
  expect(board.tasks.L1).toMatchObject({ status: "Done", closed: true, note: "keep me" });
  expect(board.tasks.L3).toBeUndefined();
  expect(board.lanes.find((l) => l.key === "N")?.ids).toEqual(["L2"]);
  expect(board.lanes.find((l) => l.key === "A")?.ids).toEqual(["L1", "G1"]);
});

test("a failing source leaves its tasks untouched and the other source still applies", async () => {
  linear = async () => [fact("L1", "In Progress")];
  github = async () => {
    throw new Error("gh down");
  };

  const summary = await refresh();

  expect(summary.errors).toEqual({ github: "gh down" });
  expect(summary.changes).toEqual([{ id: "L1", from: "Todo", to: "In Progress" }]);
  expect((await readBoard()).tasks.G1?.status).toBe("Backlog");
});

test("a second refresh with the same facts changes nothing", async () => {
  linear = async () => [fact("L1", "In Progress")];
  await refresh();
  expect(await refresh()).toEqual({ changes: [], added: [], errors: {} });
});
