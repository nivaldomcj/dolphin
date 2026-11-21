import { expect, test } from "bun:test";
import { db } from "../db";
import { checkRules } from "../core/arrange";
import { readBoard } from "../core/board";
import { seedDemo } from "./demo";
import { readRules } from "../core/rules";

test("writes five lanes, nineteen tasks, and leaves ENG-160 waiting in lane N", async () => {
  expect(await seedDemo()).toEqual({ lanes: 5, tasks: 19 });

  const board = await readBoard();
  expect(board.lanes.map((l) => l.key)).toEqual(["A", "B", "C", "D", "X", "N"]);
  expect(board.lanes.find((l) => l.key === "N")?.ids).toEqual(["ENG-160"]);
  expect(board.edges).toHaveLength(5);
  expect(board.tasks["SITE-12"]).toMatchObject({ source: "github", url: "https://github.com/example-org/docs/issues/12" });
  expect(board.tasks["ENG-101"]).toMatchObject({ source: "linear", closed: true });
});

test("the demo board follows its own rules", async () => {
  await seedDemo();

  expect((await readRules()).pins).toEqual([{ lane: "A", kind: "release", app: "mobile", label: "app store release" }]);
  expect(await checkRules()).toEqual([]);
});

test("seeding again replaces the board instead of adding to it", async () => {
  await db.insertInto("lane").values({ key: "Q", name: "old", bg: "", head: "", ord: 9 }).execute();

  await seedDemo();
  await seedDemo();

  expect((await readBoard()).lanes.map((l) => l.key)).toEqual(["A", "B", "C", "D", "X", "N"]);
});
