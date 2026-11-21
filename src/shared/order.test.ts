import { expect, test } from "bun:test";
import { insertNear } from "./order";

test("without an anchor the task goes to the end, leaving its old place", () => {
  expect(insertNear(["A", "B", "C"], "A")).toEqual(["B", "C", "A"]);
  expect(insertNear(["A", "B"], "X")).toEqual(["A", "B", "X"]);
});

test("lands before or after the anchor card", () => {
  expect(insertNear(["A", "B", "C"], "X", { id: "B", side: "before" })).toEqual(["A", "X", "B", "C"]);
  expect(insertNear(["A", "B", "C"], "X", { id: "B", side: "after" })).toEqual(["A", "B", "X", "C"]);
});

test("moves a task already in the lane next to the anchor", () => {
  expect(insertNear(["A", "B", "C"], "C", { id: "A", side: "after" })).toEqual(["A", "C", "B"]);
  expect(insertNear(["A", "B", "C"], "A", { id: "C", side: "after" })).toEqual(["B", "C", "A"]);
});

test("a task anchored on itself stays where it is", () => {
  expect(insertNear(["A", "B", "C"], "B", { id: "B", side: "before" })).toEqual(["A", "B", "C"]);
});

test("a task anchored on itself in another lane is a missing anchor", () => {
  expect(() => insertNear(["A", "B"], "X", { id: "X", side: "after" })).toThrow("X is not in that lane any more; reload the board.");
});

test("an anchor that left the lane throws", () => {
  expect(() => insertNear(["A", "B"], "X", { id: "Z", side: "before" })).toThrow("Z is not in that lane any more; reload the board.");
});

test("does not change the list it is given", () => {
  const ids = ["A", "B"];
  insertNear(ids, "A");
  expect(ids).toEqual(["A", "B"]);
});
