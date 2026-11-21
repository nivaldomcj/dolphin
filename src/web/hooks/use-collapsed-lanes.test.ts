import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { useCollapsedLanes } from "./use-collapsed-lanes";

useDom();

test("useCollapsedLanes toggles lanes and keeps them as a comma list", () => {
  const { result } = renderHook(() => useCollapsedLanes());

  act(() => result.current.toggle("A"));
  act(() => result.current.toggle("X"));
  expect([...result.current.collapsed]).toEqual(["A", "X"]);
  expect(localStorage.getItem("dolphin.collapsed")).toBe("A,X");

  act(() => result.current.toggle("A"));
  expect(result.current.key).toBe("X");
  act(() => result.current.setCollapsed("X", true));
  expect(result.current.key).toBe("X");
});
