import { expect, test } from "bun:test";
import { escapeRegExp } from "./escape-regexp";

test("every metacharacter is matched literally", () => {
  const raw = "a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o";
  expect(new RegExp(`^${escapeRegExp(raw)}$`).test(raw)).toBe(true);
  expect(new RegExp(escapeRegExp("a.b")).test("axb")).toBe(false);
});
