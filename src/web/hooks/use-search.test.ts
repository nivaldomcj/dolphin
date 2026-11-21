import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/preact";
import type { Board } from "../../shared/types";
import { board, lane, task } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { useSearch } from "./use-search";

useDom();

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
