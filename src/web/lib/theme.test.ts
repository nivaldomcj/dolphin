import { expect, test } from "bun:test";
import { isTheme } from "./theme";

test("isTheme accepts the menu's themes and nothing else", () => {
  expect(["system", "light", "dark"].every(isTheme)).toBe(true);
  expect(isTheme("solarized")).toBe(false);
  expect(isTheme("")).toBe(false);
});
