import { beforeEach, describe, expect, test } from "bun:test";
import { resetDb } from "../../test/db";
import { readBoard } from "./board";
import { BoardNotEmptyError, importSnapshot, PALETTE, type Snapshot, trackerOf } from "./import-snapshot";

beforeEach(resetDb);

describe("trackerOf", () => {
  test("the url's host decides first", () => {
    expect(trackerOf("ANY", "https://github.com/org/repo/issues/1")).toBe("github");
    expect(trackerOf("SITE-1", "https://linear.app/acme/issue/SITE-1")).toBe("linear");
  });

  test("without a telling url, the configured GitHub prefix, then Linear's id shape", () => {
    // The example config's GitHub prefix is SITE.
    expect(trackerOf("SITE-7", undefined)).toBe("github");
    expect(trackerOf("ENG-12", "not a url")).toBe("linear");
    expect(trackerOf("A1B-3", "https://example.com/x")).toBe("linear");
  });

  test("anything else stops the import instead of guessing", () => {
    expect(() => trackerOf("task-12", undefined)).toThrow(
      'task-12: cannot tell its tracker; add "source": "linear" or "github" to it in the snapshot',
    );
    expect(() => trackerOf("ENG12", undefined)).toThrow("cannot tell its tracker");
  });
});

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  lanes: [
    { key: "A", name: "First", ids: ["ENG-1", "ENG-2"], bg: "#111111", head: "#222222" },
    { key: "B", name: "Second", ids: ["SITE-3"] },
  ],
  tasks: {
    "ENG-1": { title: "one", status: "Todo", note: "keep" },
    "ENG-2": { title: "two", status: "Done", closed: true, url: "https://linear.app/acme/issue/ENG-2" },
    "SITE-3": { title: "three", status: "Doing", url: "https://github.com/org/docs/issues/3" },
  },
  edges: [["ENG-1", "SITE-3"]],
  ...over,
});

describe("importSnapshot", () => {
  test("writes the lanes, tasks, placements and edges, and counts them", async () => {
    expect(await importSnapshot(snapshot())).toEqual({ lanes: 2, tasks: 3, placements: 3, edges: 1 });

    const board = await readBoard();
    expect(board.lanes.map((l) => [l.key, l.name, l.ids])).toEqual([
      ["A", "First", ["ENG-1", "ENG-2"]],
      ["B", "Second", ["SITE-3"]],
    ]);
    expect(board.tasks["ENG-1"]).toMatchObject({ source: "linear", url: "", note: "keep", closed: false });
    expect(board.tasks["ENG-2"]).toMatchObject({ closed: true });
    expect(board.tasks["SITE-3"]).toMatchObject({ source: "github" });
    expect(board.edges).toEqual([["ENG-1", "SITE-3"]]);
  });

  test("a lane without colors gets the palette's color for its place; one with colors keeps them", async () => {
    await importSnapshot(snapshot());

    const lanes = (await readBoard()).lanes;
    expect([lanes[0]?.bg, lanes[0]?.head]).toEqual(["#111111", "#222222"]);
    expect([lanes[1]?.bg, lanes[1]?.head]).toEqual(PALETTE[1]!);
  });

  test("lane N in the snapshot is not stored: its tasks stay unplaced", async () => {
    const snap = snapshot();
    snap.lanes.push({ key: "N", name: "New", ids: ["ENG-9"] });
    snap.tasks["ENG-9"] = { title: "nine", status: "Todo" };

    expect((await importSnapshot(snap)).lanes).toBe(2);
    expect((await readBoard()).lanes.find((l) => l.key === "N")?.ids).toEqual(["ENG-9"]);
  });

  test("a repeated edge is stored once", async () => {
    expect(
      (
        await importSnapshot(
          snapshot({
            edges: [
              ["ENG-1", "SITE-3"],
              ["ENG-1", "SITE-3"],
            ],
          }),
        )
      ).edges,
    ).toBe(1);
  });

  test("an explicit source wins over the id shape", async () => {
    await importSnapshot(
      snapshot({
        lanes: [],
        edges: [],
        tasks: { "ENG-5": { title: "t", status: "Todo", source: "github", url: "https://example.com/5" } },
      }),
    );

    expect((await readBoard()).tasks["ENG-5"]?.source).toBe("github");
  });

  test("refuses an unknown source", async () => {
    const tasks = { "ENG-5": { title: "t", status: "Todo", source: "jira" } } as unknown as Snapshot["tasks"];
    await expect(importSnapshot(snapshot({ lanes: [], edges: [], tasks }))).rejects.toThrow('ENG-5: unknown source "jira"');
  });

  test("refuses a GitHub task without a url", async () => {
    await expect(importSnapshot(snapshot({ lanes: [], edges: [], tasks: { "SITE-4": { title: "t", status: "Todo" } } }))).rejects.toThrow(
      "SITE-4: a GitHub task needs a url in the snapshot",
    );
  });

  test("refuses a board that already has lanes, unless forced", async () => {
    await importSnapshot(snapshot());

    const refused = importSnapshot(snapshot({ lanes: [{ key: "Z", name: "z", ids: [] }], tasks: {}, edges: [] }));
    await expect(refused).rejects.toBeInstanceOf(BoardNotEmptyError);
    await expect(refused).rejects.toThrow("The board already has 2 lanes.");
    expect((await readBoard()).lanes.map((l) => l.key)).toEqual(["A", "B"]);

    expect(await importSnapshot(snapshot({ lanes: [{ key: "Z", name: "z", ids: [] }], tasks: {}, edges: [] }), { force: true })).toEqual({
      lanes: 1,
      tasks: 0,
      placements: 0,
      edges: 0,
    });
  });

  test("a bad task midway leaves the old board as it was", async () => {
    await importSnapshot(snapshot());
    const bad = snapshot({ tasks: { ...snapshot().tasks, "who-knows": { title: "?", status: "Todo" } } });

    await expect(importSnapshot(bad, { force: true })).rejects.toThrow("who-knows: cannot tell its tracker");

    const board = await readBoard();
    expect(board.lanes.map((l) => [l.key, l.ids])).toEqual([
      ["A", ["ENG-1", "ENG-2"]],
      ["B", ["SITE-3"]],
    ]);
    expect(Object.keys(board.tasks).sort()).toEqual(["ENG-1", "ENG-2", "SITE-3"]);
  });
});
