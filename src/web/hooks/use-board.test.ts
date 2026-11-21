import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/preact";
import { board, lane } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { useBoard } from "./use-board";

useDom();

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
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
