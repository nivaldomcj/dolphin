import { expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { Legend } from "./legend";

useDom();

test("the legend names the colors and lines", () => {
  const text = render(<Legend />).container.textContent ?? "";
  for (const part of ["In Progress", "Blocked", "Umbrella", "Next in lane", "Blocker"]) expect(text).toContain(part);
});
