import { expect, test } from "bun:test";
import { task } from "./test-board";
import { isTheme } from "./theme";
import { toneFill } from "./status";
import { inOtherCycle, isHidden } from "./visibility";

test("only a task planned for a cycle other than the current one is in another cycle", () => {
  expect(inOtherCycle(task("T", { cycle: null }))).toBe(false);
  expect(inOtherCycle(task("T", { cycle: { number: 4, state: "current" } }))).toBe(false);
  expect(inOtherCycle(task("T", { cycle: { number: 5, state: "next" } }))).toBe(true);
  expect(inOtherCycle(task("T", { cycle: { number: 3, state: "past" } }))).toBe(true);
});

test("a task is hidden only by a setting that applies to it", () => {
  const closed = task("C", { closed: true });
  const later = task("L", { cycle: { number: 5, state: "future" } });
  const plain = task("P");

  expect(isHidden(closed, { closed: true, otherCycles: false })).toBe(true);
  expect(isHidden(closed, { closed: false, otherCycles: true })).toBe(false);
  expect(isHidden(later, { closed: false, otherCycles: true })).toBe(true);
  expect(isHidden(later, { closed: true, otherCycles: false })).toBe(false);
  expect(isHidden(plain, { closed: true, otherCycles: true })).toBe(false);
});

test("isTheme accepts the menu's themes and nothing else", () => {
  expect(["system", "light", "dark"].every(isTheme)).toBe(true);
  expect(isTheme("solarized")).toBe(false);
  expect(isTheme("")).toBe(false);
});

test("a tone's fill is its CSS variable", () => {
  expect(toneFill("blocked")).toBe("var(--s-blocked)");
});
