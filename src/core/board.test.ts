import { beforeEach, expect, test } from "bun:test";
import { laneRow, resetDb, taskRow } from "../../test/db";
import { db } from "../db";
import { readBoard } from "./board";

beforeEach(resetDb);

const task = (id: string, closed = 0, meta = {}) => taskRow(id, { closed, meta: JSON.stringify(meta) });

test("lanes come in their order and tasks by position, with meta fields merged in", async () => {
  await db
    .insertInto("lane")
    .values([laneRow("B", 1), laneRow("A", 0)])
    .execute();
  await db
    .insertInto("task")
    .values([task("T1", 0, { kind: "code", note: "n" }), task("T2"), task("T3")])
    .execute();
  await db
    .insertInto("placement")
    .values([
      { task_id: "T2", lane_key: "A", pos: 1 },
      { task_id: "T1", lane_key: "A", pos: 0 },
      { task_id: "T3", lane_key: "B", pos: 0 },
    ])
    .execute();
  await db.insertInto("edge").values({ a: "T1", b: "T3" }).execute();

  const board = await readBoard();

  expect(board.lanes.map((l) => [l.key, l.ids])).toEqual([
    ["A", ["T1", "T2"]],
    ["B", ["T3"]],
  ]);
  expect(board.tasks.T1).toMatchObject({ kind: "code", note: "n", closed: false });
  expect(board.edges).toEqual([["T1", "T3"]]);
});

test("open unplaced tasks show in lane N; closed unplaced tasks do not", async () => {
  await db.insertInto("lane").values(laneRow("A", 0)).execute();
  await db
    .insertInto("task")
    .values([task("OPEN"), task("DONE", 1)])
    .execute();

  const lanes = (await readBoard()).lanes;

  expect(lanes.map((l) => [l.key, l.ids])).toEqual([
    ["A", []],
    ["N", ["OPEN"]],
  ]);
});

test("there is no lane N when every open task is placed", async () => {
  await db.insertInto("lane").values(laneRow("A", 0)).execute();
  await db.insertInto("task").values(task("T1")).execute();
  await db.insertInto("placement").values({ task_id: "T1", lane_key: "A", pos: 0 }).execute();

  expect((await readBoard()).lanes.map((l) => l.key)).toEqual(["A"]);
});
