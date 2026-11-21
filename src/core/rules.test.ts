import { expect, test } from "bun:test";
import { pinMatches } from "./rules";

test("a pin with neither kind nor app matches nothing", () => {
  expect(pinMatches({ lane: "A", label: "x" }, "release", "billing")).toBe(false);
  expect(pinMatches({ lane: "A", kind: "", app: "", label: "x" }, "release", "billing")).toBe(false);
});

test("kind matches exactly", () => {
  const pin = { lane: "A", kind: "release", label: "x" };
  expect(pinMatches(pin, "release", null)).toBe(true);
  expect(pinMatches(pin, "Release", null)).toBe(false);
  expect(pinMatches(pin, null, null)).toBe(false);
});

test("app matches as a substring, in any case", () => {
  const pin = { lane: "A", app: "BILL", label: "x" };
  expect(pinMatches(pin, null, "Billing web")).toBe(true);
  expect(pinMatches(pin, null, "auth")).toBe(false);
  expect(pinMatches(pin, null, null)).toBe(false);
});

test("a pin with both needs both to match", () => {
  const pin = { lane: "A", kind: "release", app: "billing", label: "x" };
  expect(pinMatches(pin, "release", "billing")).toBe(true);
  expect(pinMatches(pin, "release", "auth")).toBe(false);
  expect(pinMatches(pin, "bug", "billing")).toBe(false);
});
