import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { applyMove, mentions, targetAt } from "./move";
import { board, lane } from "../../../test/board";
import { laneInDom, useDom } from "../../../test/dom";

useDom();

const ids = (b: ReturnType<typeof board> | null) => b?.lanes.map((l) => [l.key, l.ids]);

describe("applyMove", () => {
  const start = board([lane("A", ["T1", "T2", "T3"]), lane("B", ["T4"])]);

  test("moves a card across lanes, next to the anchor", () => {
    expect(ids(applyMove(start, "T1", { lane: "B", at: { id: "T4", side: "before" } }))).toEqual([
      ["A", ["T2", "T3"]],
      ["B", ["T1", "T4"]],
    ]);
  });

  test("moves a card inside its lane", () => {
    expect(ids(applyMove(start, "T3", { lane: "A", at: { id: "T1", side: "before" } }))).toEqual([
      ["A", ["T3", "T1", "T2"]],
      ["B", ["T4"]],
    ]);
  });

  test("dropping on the card's own gap, or where it already is, changes nothing", () => {
    expect(applyMove(start, "T2", { lane: "A", at: { id: "T3", side: "before" }, home: true })).toBeNull();
    expect(applyMove(start, "T2", { lane: "A", at: { id: "T1", side: "after" } })).toBeNull();
    expect(applyMove(start, "T3", { lane: "A" })).toBeNull();
  });

  test("an anchor that left the lane, or an unknown lane, gives no move", () => {
    expect(applyMove(start, "T1", { lane: "B", at: { id: "GONE", side: "after" } })).toBeNull();
    expect(applyMove(start, "T1", { lane: "Z" })).toBeNull();
  });

  test("dropping in lane N unplaces the card, adding lane N when the board has none", () => {
    expect(ids(applyMove(start, "T4", { lane: "N" }))).toEqual([
      ["A", ["T1", "T2", "T3"]],
      ["B", []],
      ["N", ["T4"]],
    ]);
  });

  test("dropping in an existing lane N adds the card at its end", () => {
    const withN = board([lane("A", ["T1"]), lane("N", ["NEW"])]);
    expect(ids(applyMove(withN, "T1", { lane: "N" }))).toEqual([
      ["A", []],
      ["N", ["NEW", "T1"]],
    ]);
  });

  test("a card already in lane N dropped on lane N changes nothing", () => {
    expect(applyMove(board([lane("N", ["NEW"])]), "NEW", { lane: "N" })).toBeNull();
  });

  test("placing the last card of lane N removes lane N", () => {
    const withN = board([lane("A", ["T1"]), lane("N", ["NEW"])]);
    expect(ids(applyMove(withN, "NEW", { lane: "A" }))).toEqual([["A", ["T1", "NEW"]]]);
  });

  test("does not change the board it is given", () => {
    applyMove(start, "T1", { lane: "B" });
    expect(ids(start)).toEqual([
      ["A", ["T1", "T2", "T3"]],
      ["B", ["T4"]],
    ]);
  });
});

test("mentions matches a whole task id only", () => {
  expect(mentions("T1 is a release in lane B, not lane A.", "T1")).toBe(true);
  expect(mentions("Blocked by T1.", "T1")).toBe(true);
  expect(mentions("T10 is a release in lane B.", "T1")).toBe(false);
  expect(mentions("ENG-1 waits for ENG-12.", "ENG-1")).toBe(true);
  expect(mentions("ENG-12 waits.", "ENG-1")).toBe(false);
  // Regex characters in an id are taken literally.
  expect(mentions("A.B moved.", "A.B")).toBe(true);
  expect(mentions("AxB moved.", "A.B")).toBe(false);
});

describe("targetAt", () => {
  afterEach(() => {
    (document.elementFromPoint as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  const pointAt = (el: Element | null) => spyOn(document, "elementFromPoint").mockReturnValue(el);

  test("outside every lane there is no target", () => {
    pointAt(document.body);
    expect(targetAt(0, 0, "X", false)).toBeNull();
  });

  test("lane N takes an open card at its end, and refuses a closed one", () => {
    pointAt(laneInDom("N", ["NEW"]).querySelector(".cards"));
    expect(targetAt(0, 0, "X", false)).toEqual({ lane: "N" });
    expect(targetAt(0, 0, "X", true)).toBeNull();
  });

  test("lands before the first card whose middle is right of the pointer", () => {
    pointAt(laneInDom("A", ["T1", "T2", "T3"]).querySelector(".cards"));
    expect(targetAt(120, 5, "X", false)).toEqual({ lane: "A", at: { id: "T2", side: "before" } });
    expect(targetAt(10, 5, "X", false)).toEqual({ lane: "A", at: { id: "T1", side: "before" } });
  });

  test("right of every card it lands after the last one", () => {
    pointAt(laneInDom("A", ["T1", "T2"]).querySelector(".cards"));
    expect(targetAt(500, 5, "X", false)).toEqual({ lane: "A", at: { id: "T2", side: "after" } });
  });

  test("an empty lane takes the card at its end", () => {
    pointAt(laneInDom("A", []).querySelector(".cards"));
    expect(targetAt(5, 5, "X", false)).toEqual({ lane: "A" });
  });

  test("a lane header or a collapsed lane means the end of the lane", () => {
    pointAt(laneInDom("A", ["T1"]).querySelector(".lane-head"));
    expect(targetAt(0, 0, "X", false)).toEqual({ lane: "A" });
    pointAt(laneInDom("B", ["T2"], { collapsed: true }));
    expect(targetAt(0, 0, "X", false)).toEqual({ lane: "B" });
  });

  test("the card's own gap is marked home, so the drop changes nothing", () => {
    pointAt(laneInDom("A", ["T1", "T2", "T3"]).querySelector(".cards"));
    // Over T2 itself: the next card after skipping T2 is T3, which is T2's own next neighbor.
    expect(targetAt(150, 5, "T2", false)).toEqual({ lane: "A", at: { id: "T3", side: "before" }, home: true });
    expect(targetAt(10, 5, "T2", false)).toEqual({ lane: "A", at: { id: "T1", side: "before" } });
  });

  test("the last card dropped past the end is home too", () => {
    pointAt(laneInDom("A", ["T1", "T2"]).querySelector(".cards"));
    expect(targetAt(500, 5, "T2", false)).toEqual({ lane: "A", at: { id: "T1", side: "after" }, home: true });
  });
});
