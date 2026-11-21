import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/preact";
import type { Board } from "../../types";
import { board, lane, task } from "../test-board";
import { useDom } from "../test-dom";
import { usePref, useStringPref } from "./prefs";
import { useBoard } from "./use-board";
import { useCollapsedLanes } from "./use-collapsed-lanes";
import { useDisplay } from "./use-display";
import { useSearch } from "./use-search";

useDom();

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

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

describe("useBoard", () => {
  test("loads the board and maps lanes and blockers both ways", async () => {
    const b = board(
      [lane("A", ["T1", "T2"]), lane("B", ["T3"])],
      [],
      [
        ["T1", "T3"],
        ["T2", "T3"],
      ],
    );
    const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(b));

    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.board).not.toBeNull());

    expect(fetch).toHaveBeenCalledWith("/api/board");
    const { laneOf, up, down } = result.current.graph;
    expect(laneOf.get("T3")).toBe("B");
    expect(up.get("T3")).toEqual(["T1", "T2"]);
    expect(down.get("T1")).toEqual(["T3"]);
    expect(result.current.error).toBeNull();
  });

  test("an HTTP failure becomes the error message", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 503 }));

    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.error).toBe("HTTP 503"));
    expect(result.current.board).toBeNull();
  });
});

describe("useSearch", () => {
  const b: Board = board(
    [lane("A", ["ENG-2", "ENG-1"]), lane("B", ["ENG-3", "OLD-1"])],
    [
      task("ENG-1", { title: "Fix login" }),
      task("ENG-2", { title: "Billing page", app: "billing" }),
      task("ENG-3", { title: "Other", short: "login rework" }),
      task("OLD-1", { title: "login, done", closed: true }),
    ],
  );

  test("matches id, title, summary and app, in board order", () => {
    const { result } = renderHook(() => useSearch(b));

    act(() => result.current.setQuery("  LOGIN "));
    expect(result.current.list).toEqual(["ENG-1", "ENG-3", "OLD-1"]);
    expect(result.current.current).toBe("ENG-1");

    act(() => result.current.setQuery("billing"));
    expect(result.current.list).toEqual(["ENG-2"]);
  });

  test("hidden tasks are not matches", () => {
    const { result } = renderHook(() => useSearch(b, { closed: true, otherCycles: false }));

    act(() => result.current.setQuery("login"));
    expect(result.current.list).toEqual(["ENG-1", "ENG-3"]);
  });

  test("an empty query means no search at all", () => {
    const { result } = renderHook(() => useSearch(b));

    act(() => result.current.setQuery("   "));
    expect(result.current.hits).toBeNull();
    expect(result.current.list).toEqual([]);
  });

  test("stepping wraps around both ways", () => {
    const { result } = renderHook(() => useSearch(b));
    act(() => result.current.setQuery("login"));

    act(() => result.current.step(-1));
    expect(result.current.current).toBe("OLD-1");
    act(() => result.current.step(1));
    expect(result.current.current).toBe("ENG-1");
    act(() => result.current.step(1));
    expect([result.current.current, result.current.index]).toEqual(["ENG-3", 1]);
  });

  test("closing clears the query; every step bumps seq even on one match", () => {
    const { result } = renderHook(() => useSearch(b));
    act(() => result.current.openSearch());
    act(() => result.current.setQuery("billing"));
    const seq = result.current.seq;

    act(() => result.current.step(1));
    expect(result.current.current).toBe("ENG-2");
    expect(result.current.seq).toBe(seq + 1);

    act(() => result.current.closeSearch());
    expect([result.current.open, result.current.query]).toEqual([false, ""]);
  });
});
