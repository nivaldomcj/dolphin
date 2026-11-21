import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { usePref, useStringPref } from "./prefs";

useDom();

describe("prefs", () => {
  test("a boolean pref starts at its default, then remembers the last value as 1 or 0", () => {
    const { result } = renderHook(() => usePref("titles", true));
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem("dolphin.titles")).toBe("0");
  });

  test("a stored value wins over the default", () => {
    localStorage.setItem("dolphin.legend", "1");
    localStorage.setItem("dolphin.theme", "dark");

    expect(renderHook(() => usePref("legend", false)).result.current[0]).toBe(true);
    expect(renderHook(() => useStringPref("theme", "system")).result.current[0]).toBe("dark");
  });

  test("blocked storage falls back to the default and still updates the value", () => {
    // A stored value that differs from the default, so the test can tell a fallback from a read.
    localStorage.setItem("dolphin.privacy", "1");
    const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")!;
    // A browser with site data blocked throws on the localStorage accessor itself.
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      const { result } = renderHook(() => usePref("privacy", false));
      expect(result.current[0]).toBe(false);
      act(() => result.current[1](true));
      expect(result.current[0]).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", saved);
    }
  });
});
