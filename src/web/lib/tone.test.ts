import { expect, test } from "bun:test";
import { toneFill } from "./tone";

test("a tone's fill is its CSS variable", () => {
  expect(toneFill("blocked")).toBe("var(--s-blocked)");
});
