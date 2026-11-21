import { beforeEach, expect, test } from "bun:test";
import { db } from "../db";
import type { Fact } from "../sources/types";
import { readBoard } from "./board";
import { createRefresh, NOT_FOUND } from "./refresh";

const fact = (id: string, status: string, closed = false): Fact => ({ id, source: "linear", title: `${id} title`, status, url: `https://x/${id}`, closed });

let linear: () => Promise<{ facts: Fact[]; missing: string[]; error?: string }> = async () => ({ facts: [], missing: [] });
// Fakes for the two trackers; tests reassign them.
let github: () => Promise<Fact[]> = async () => [];
const refresh = createRefresh({ fetchLinear: () => linear(), fetchGithub: () => github() });

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
  linear = async () => ({ facts: [], missing: [] });
  github = async () => [];
});

test("writes status changes, adds new open tasks, skips new closed ones", async () => {
  linear = async () => ({ facts: [fact("L1", "Done", true), fact("L2", "Todo"), fact("L3", "Done", true)], missing: [] });

  const summary = await refresh();

  expect(summary).toEqual({ changes: [{ id: "L1", from: "Todo", to: "Done" }], added: ["L2"], errors: {} });
  const board = await readBoard();
  expect(board.tasks.L1).toMatchObject({ status: "Done", closed: true, note: "keep me" });
  expect(board.tasks.L3).toBeUndefined();
  expect(board.lanes.find((l) => l.key === "N")?.ids).toEqual(["L2"]);
  expect(board.lanes.find((l) => l.key === "A")?.ids).toEqual(["L1", "G1"]);
});

test("a failing source leaves its tasks untouched and the other source still applies", async () => {
  linear = async () => ({ facts: [fact("L1", "In Progress")], missing: [] });
  github = async () => {
    throw new Error("gh down");
  };

  const summary = await refresh();

  expect(summary.errors).toEqual({ github: "gh down" });
  expect(summary.changes).toEqual([{ id: "L1", from: "Todo", to: "In Progress" }]);
  expect((await readBoard()).tasks.G1?.status).toBe("Backlog");
});

test("writes the cycle without reporting it as a change, and keeps it when the tracker has no cycles", async () => {
  linear = async () => ({ facts: [{ ...fact("L1", "Todo"), cycle: { number: 43, state: "next" } }, { ...fact("L2", "Todo"), cycle: null }], missing: [] });
  github = async () => [{ ...fact("G1", "Backlog"), source: "github" }];

  expect(await refresh()).toEqual({ changes: [], added: ["L2"], errors: {} });
  let board = await readBoard();
  expect(board.tasks.L1?.cycle).toEqual({ number: 43, state: "next" });
  expect(board.tasks.L2?.cycle).toBeNull();
  expect(board.tasks.G1?.cycle).toBeNull();

  // The cycle becomes the current one, then the task leaves its cycle.
  linear = async () => ({ facts: [{ ...fact("L1", "Todo"), cycle: { number: 43, state: "current" } }], missing: [] });
  await refresh();
  expect((await readBoard()).tasks.L1?.cycle).toEqual({ number: 43, state: "current" });
  linear = async () => ({ facts: [{ ...fact("L1", "Todo"), cycle: null }], missing: [] });
  await refresh();
  board = await readBoard();
  expect(board.tasks.L1?.cycle).toBeNull();
});

test("a second refresh with the same facts changes nothing", async () => {
  linear = async () => ({ facts: [fact("L1", "In Progress")], missing: [] });
  await refresh();
  expect(await refresh()).toEqual({ changes: [], added: [], errors: {} });
});

test("a task Linear no longer returns is closed and marked not found, once", async () => {
  linear = async () => ({ facts: [], missing: ["L1"] });

  expect((await refresh()).changes).toEqual([{ id: "L1", from: "Todo", to: NOT_FOUND }]);
  expect((await readBoard()).tasks.L1).toMatchObject({ status: NOT_FOUND, closed: true });
  expect((await refresh()).changes).toEqual([]);
});

test("a refresh asked for during a run gets a later run, shared by everyone who asked meanwhile", async () => {
  let calls = 0;
  linear = async () => {
    calls += 1;
    return { facts: [fact("L1", calls === 1 ? "In Progress" : "Done", calls > 1)], missing: [] };
  };

  const [first, second, third] = await Promise.all([refresh(), refresh(), refresh()]);

  expect(calls).toBe(2);
  expect(second).toBe(third);
  expect(first.changes).toEqual([{ id: "L1", from: "Todo", to: "In Progress" }]);
  expect(second).toEqual({ changes: [{ id: "L1", from: "In Progress", to: "Done" }], added: [], errors: {} });
});

test("two refreshes that both see a new task add it once", async () => {
  linear = async () => ({ facts: [fact("L2", "Todo")], missing: [] });

  const [a, b] = await Promise.all([refresh(), refresh()]);

  expect([...a.added, ...b.added]).toEqual(["L2"]);
  expect([a.errors, b.errors]).toEqual([{}, {}]);
});

test("a source that throws before returning a promise does not stop the other", async () => {
  linear = () => {
    throw new Error("no key");
  };
  github = async () => [{ id: "G1", source: "github", title: "G1 title", status: "Doing", url: "https://x/G1", closed: false }];

  const summary = await refresh();

  expect(summary.errors).toEqual({ linear: "no key" });
  expect(summary.changes).toEqual([{ id: "G1", from: "Backlog", to: "Doing" }]);
});

test("a refresh after the previous one finished runs again", async () => {
  await refresh();
  linear = async () => ({ facts: [fact("L1", "Done", true)], missing: [] });
  expect((await refresh()).changes).toEqual([{ id: "L1", from: "Todo", to: "Done" }]);
});

test("a call landing between a run's end and the queued run's start joins the queued run", async () => {
  let calls = 0;
  linear = async () => {
    calls += 1;
    return { facts: [], missing: [] };
  };

  const first = refresh();
  const second = refresh();
  // Runs right after the first run settles, while the queued second run has not started yet.
  const third = first.then(() => refresh());

  expect(await third).toBe(await second);
  expect(calls).toBe(2);
});

test("a source that hangs past the deadline fails alone; the other still applies", async () => {
  const quick = createRefresh({ fetchLinear: () => new Promise(() => {}), fetchGithub: () => github() }, 20);
  github = async () => [{ id: "G1", source: "github", title: "G1 title", status: "Doing", url: "https://x/G1", closed: false }];

  const summary = await quick();

  expect(summary.errors).toEqual({ linear: "Linear timed out after 0.02 s" });
  expect(summary.changes).toEqual([{ id: "G1", from: "Backlog", to: "Doing" }]);
});

test("partial Linear results apply, with the error reported and nothing closed as missing", async () => {
  linear = async () => ({ facts: [fact("L1", "In Progress")], missing: [], error: "Linear API 502: no data" });

  const summary = await refresh();

  expect(summary).toEqual({ changes: [{ id: "L1", from: "Todo", to: "In Progress" }], added: [], errors: { linear: "Linear API 502: no data" } });
});
