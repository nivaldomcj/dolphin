import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { useDisplay } from "./use-display";

useDom();

describe("useDisplay", () => {
  test("starts from the defaults", () => {
    const d = renderHook(() => useDisplay()).result.current;
    expect([d.theme, d.titles, d.positions, d.inLane, d.legend, d.completed, d.otherCycles, d.privacy]).toEqual([
      "system",
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
  });

  test("a chosen theme is set on the page, and system removes it", () => {
    const { result } = renderHook(() => useDisplay());

    act(() => result.current.onTheme("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => result.current.onTheme("system"));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  test("a stale stored theme reads as system", () => {
    localStorage.setItem("dolphin.theme", "solarized");
    expect(renderHook(() => useDisplay()).result.current.theme).toBe("system");
  });

  test("privacy mode toggles the body's private class", () => {
    const { result } = renderHook(() => useDisplay());

    act(() => result.current.onPrivacy(true));
    expect(document.body.classList.contains("private")).toBe(true);

    act(() => result.current.onPrivacy(false));
    expect(document.body.classList.contains("private")).toBe(false);
  });
});
