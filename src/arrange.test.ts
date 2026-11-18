import { beforeEach, describe, expect, test } from "bun:test";
import { addEdge, placeTask, removeEdge, renameLane, reorderLane, setNote, unplaceTask } from "./arrange";
import { db, readBoard } from "./db";

const lane = (key: string) => readBoard().lanes.find((l) => l.key === key)?.ids ?? [];

beforeEach(() => {
  db.run("DELETE FROM edge; DELETE FROM placement; DELETE FROM task; DELETE FROM lane;");
  const task = db.prepare("INSERT INTO task (id, source, title, status, url, meta) VALUES (?, 'linear', ?, 'Todo', '', ?)");
  for (const id of ["T1", "T2", "T3", "T4"]) task.run(id, id, "{}");
  task.run("RUN", "release", JSON.stringify({ kind: "release", app: "billing" }));
  task.run("NEW", "unplaced", "{}");
  db.run("INSERT INTO lane (key, name, bg, head, ord) VALUES ('A', 'a', '', '', 0), ('B', 'b', '', '', 1)");
  const place = db.prepare("INSERT INTO placement (task_id, lane_key, pos) VALUES (?, ?, ?)");
  ["RUN", "T1", "T2"].forEach((id, i) => place.run(id, "A", i));
  ["T3", "T4"].forEach((id, i) => place.run(id, "B", i));
});

describe("placeTask", () => {
  test("moves a task inside its lane", () => {
    placeTask("T2", "A", 1);
    expect(lane("A")).toEqual(["T2", "RUN", "T1"]);
  });

  test("moves a task across lanes and closes the gap", () => {
    expect(placeTask("T1", "B", 2).done).toBe("T1 is now B#2.");
    expect(lane("A")).toEqual(["RUN", "T2"]);
    expect(lane("B")).toEqual(["T3", "T1", "T4"]);
  });

  test("places an unplaced task at the end by default", () => {
    placeTask("NEW", "B");
    expect(lane("B")).toEqual(["T3", "T4", "NEW"]);
    expect(lane("N")).toEqual([]);
  });

  test("warns when a release leaves lane A", () => {
    expect(placeTask("RUN", "B").warnings).toEqual(["RUN is a release in lane B, not lane A."]);
  });

  test("rejects an unknown lane", () => {
    expect(() => placeTask("T1", "Z")).toThrow("Unknown lane Z");
  });
});

describe("reorderLane", () => {
  test("sets the full order", () => {
    reorderLane("A", ["T2", "T1", "RUN"]);
    expect(lane("A")).toEqual(["T2", "T1", "RUN"]);
  });

  test("rejects a list that drops or adds tasks", () => {
    expect(() => reorderLane("A", ["T2", "T1", "T3"])).toThrow("Missing: RUN. Not in lane: T3.");
  });
});

test("unplaceTask sends an open task to lane N", () => {
  unplaceTask("T3");
  expect(lane("B")).toEqual(["T4"]);
  expect(lane("N")).toContain("T3");
});

describe("edges", () => {
  test("warns when a blocker comes after the task it blocks", () => {
    expect(addEdge("T2", "T1").warnings).toEqual(["T2 (A#3) blocks T1 (A#2) but comes after it."]);
    expect(removeEdge("T2", "T1").warnings).toEqual([]);
  });

  test("warns when a cross-lane blocker is not earlier", () => {
    expect(addEdge("T2", "T3").warnings).toEqual(["T2 (A#3) blocks T3 (B#1) in another lane; lane B may wait."]);
  });

  test("rejects a loop", () => {
    addEdge("T1", "T2");
    expect(() => addEdge("T2", "T1")).toThrow("makes a loop");
  });
});

test("renameLane and setNote", () => {
  renameLane("B", "Sprint 2");
  setNote("T1", "waits for review");
  const board = readBoard();
  expect(board.lanes.find((l) => l.key === "B")?.name).toBe("Sprint 2");
  expect(board.tasks.T1?.note).toBe("waits for review");
  setNote("T1", "");
  expect(readBoard().tasks.T1?.note).toBeUndefined();
});
