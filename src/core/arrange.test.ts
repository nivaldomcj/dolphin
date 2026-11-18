import { beforeEach, describe, expect, test } from "bun:test";
import { addEdge, placeTask, removeEdge, renameLane, reorderLane, setNote, unplaceTask } from "./arrange";
import { readBoard } from "./board";
import { db } from "../db";

const lane = async (key: string) => (await readBoard()).lanes.find((l) => l.key === key)?.ids ?? [];

beforeEach(async () => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await db.deleteFrom(table).execute();
  const task = (id: string, meta = {}) => ({ id, source: "linear" as const, title: id, status: "Todo", url: "", meta: JSON.stringify(meta) });
  await db.insertInto("task").values([task("T1"), task("T2"), task("T3"), task("T4"), task("RUN", { kind: "release", app: "billing" }), task("NEW")]).execute();
  await db.insertInto("lane").values([{ key: "A", name: "a", bg: "", head: "", ord: 0 }, { key: "B", name: "b", bg: "", head: "", ord: 1 }]).execute();
  const place = (key: string, ids: string[]) => ids.map((task_id, pos) => ({ task_id, lane_key: key, pos }));
  await db.insertInto("placement").values([...place("A", ["RUN", "T1", "T2"]), ...place("B", ["T3", "T4"])]).execute();
});

describe("placeTask", () => {
  test("moves a task inside its lane", async () => {
    await placeTask("T2", "A", 1);
    expect(await lane("A")).toEqual(["T2", "RUN", "T1"]);
  });

  test("moves a task across lanes and closes the gap", async () => {
    expect((await placeTask("T1", "B", 2)).done).toBe("T1 is now B#2.");
    expect(await lane("A")).toEqual(["RUN", "T2"]);
    expect(await lane("B")).toEqual(["T3", "T1", "T4"]);
  });

  test("places an unplaced task at the end by default", async () => {
    await placeTask("NEW", "B");
    expect(await lane("B")).toEqual(["T3", "T4", "NEW"]);
    expect(await lane("N")).toEqual([]);
  });

  test("warns when a release leaves lane A", async () => {
    expect((await placeTask("RUN", "B")).warnings).toEqual(["RUN is a release in lane B, not lane A."]);
  });

  test("rejects an unknown lane", async () => {
    expect(placeTask("T1", "Z")).rejects.toThrow("Unknown lane Z");
  });
});

describe("reorderLane", () => {
  test("sets the full order", async () => {
    await reorderLane("A", ["T2", "T1", "RUN"]);
    expect(await lane("A")).toEqual(["T2", "T1", "RUN"]);
  });

  test("rejects a list that drops or adds tasks", async () => {
    expect(reorderLane("A", ["T2", "T1", "T3"])).rejects.toThrow("Missing: RUN. Not in lane: T3.");
  });
});

test("unplaceTask sends an open task to lane N", async () => {
  await unplaceTask("T3");
  expect(await lane("B")).toEqual(["T4"]);
  expect(await lane("N")).toContain("T3");
});

describe("edges", () => {
  test("warns when a blocker comes after the task it blocks", async () => {
    expect((await addEdge("T2", "T1")).warnings).toEqual(["T2 (A#3) blocks T1 (A#2) but comes after it."]);
    expect((await removeEdge("T2", "T1")).warnings).toEqual([]);
  });

  test("warns when a cross-lane blocker is not earlier", async () => {
    expect((await addEdge("T2", "T3")).warnings).toEqual(["T2 (A#3) blocks T3 (B#1) in another lane; lane B may wait."]);
  });

  test("rejects a loop", async () => {
    await addEdge("T1", "T2");
    expect(addEdge("T2", "T1")).rejects.toThrow("makes a loop");
  });
});

test("renameLane and setNote", async () => {
  await renameLane("B", "Sprint 2");
  await setNote("T1", "waits for review");
  const board = await readBoard();
  expect(board.lanes.find((l) => l.key === "B")?.name).toBe("Sprint 2");
  expect(board.tasks.T1?.note).toBe("waits for review");
  await setNote("T1", "");
  expect((await readBoard()).tasks.T1?.note).toBeUndefined();
});

describe("parallel calls", () => {
  test("a reorder racing a move never puts the moved task back", async () => {
    // Either call may reach the database first; whichever order, the move must stick.
    const [move] = await Promise.allSettled([placeTask("T1", "B"), reorderLane("A", ["T2", "T1", "RUN"])]);

    expect(move.status).toBe("fulfilled");
    expect(await lane("A")).not.toContain("T1");
    expect(await lane("B")).toContain("T1");
  });

  test("a reorder that starts after a move sees the move and is rejected", async () => {
    await placeTask("T1", "B");
    expect(reorderLane("A", ["T2", "T1", "RUN"])).rejects.toThrow("Missing: none. Not in lane: T1.");
  });

  test("two edges that would form a loop cannot both be added", async () => {
    const results = await Promise.allSettled([addEdge("T1", "T2"), addEdge("T2", "T1")]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await readBoard()).edges).toHaveLength(1);
  });
});
