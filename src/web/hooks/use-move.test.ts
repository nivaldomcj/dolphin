import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/preact";
import { useState } from "preact/hooks";
import type { Board } from "../../shared/types";
import { board, lane } from "../test-board";
import { useDom } from "../test-dom";
import { useMove } from "./use-move";

useDom();

const ids = (b: Board) => b.lanes.map((l) => [l.key, l.ids]);
const start = () => board([lane("A", ["T1", "T2"]), lane("B", ["T3"])]);

/** The hook with a real board state behind it, as the page holds it. */
function setup(initial: Board = start()) {
  return renderHook(() => {
    const [b, setB] = useState<Board>(initial);
    return { board: b, ...useMove(b, setB, { current: null }) };
  });
}

/**
 * Lane elements for `targetAt` to find: cards are 100px wide side by side. The pointer is "over" whatever `over`
 * names, through a stubbed elementFromPoint.
 */
function lanesInDom(b: Board) {
  for (const l of b.lanes) {
    const el = document.createElement("div");
    el.className = "lane";
    el.dataset.lane = l.key;
    el.innerHTML = `<div class="cards"></div>`;
    l.ids.forEach((id, i) => {
      const a = document.createElement("a");
      a.className = "card";
      a.dataset.id = id;
      a.getBoundingClientRect = () => ({
        left: i * 100,
        width: 100,
        right: i * 100 + 100,
        top: 0,
        bottom: 20,
        height: 20,
        x: i * 100,
        y: 0,
        toJSON() {},
      });
      el.querySelector(".cards")!.appendChild(a);
    });
    document.body.appendChild(el);
  }
}
let over = "";
beforeEach(() => {
  over = "";
  spyOn(document, "elementFromPoint").mockImplementation(() => document.querySelector(`.lane[data-lane="${over}"] .cards`));
});
afterEach(() => {
  (document.elementFromPoint as unknown as { mockRestore: () => void }).mockRestore();
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** An Alt + press on a card, as the card's onPointerDown hands it to the hook. */
const press = (over: Partial<PointerEvent> = {}) =>
  ({
    altKey: true,
    button: 0,
    clientX: 0,
    clientY: 5,
    preventDefault() {},
    currentTarget: document.createElement("a"),
    ...over,
  }) as unknown as PointerEvent;
const pointer = (type: string, x: number, buttons = 1) =>
  act(() => void dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 5, buttons })));

/** Alt-drags `id` over lane `to` at x, and drops it there. */
async function dragTo(r: ReturnType<typeof setup>, id: string, to: string, x: number) {
  act(() => r.result.current.onGrab(id, press()));
  over = to;
  pointer("pointermove", x);
  pointer("pointerup", x, 0);
}

type Call = [string, RequestInit | undefined];
const moves = (f: { mock: { calls: unknown[][] } }) =>
  (f.mock.calls as Call[]).filter(([url]) => url === "/api/move").map(([, init]) => JSON.parse(String(init?.body)));

describe("clicks and native drags", () => {
  test("a press without Alt does nothing", () => {
    const r = setup();
    act(() => r.result.current.onGrab("T1", press({ altKey: false })));
    pointer("pointermove", 300);
    expect(r.result.current.drag).toBeNull();
  });

  test("an Alt click does not open the card's link, a plain click does", () => {
    const r = setup();
    const click = (altKey: boolean) => {
      const e = new MouseEvent("click", { altKey, cancelable: true });
      r.result.current.onCardClick(e);
      return e.defaultPrevented;
    };
    expect(click(true)).toBe(true);
    expect(click(false)).toBe(false);
  });

  test("an Alt drag blocks the browser's own link drag", () => {
    const r = setup();
    // happy-dom's DragEvent drops `altKey`, so the event is a plain stand-in.
    let prevented = false;
    r.result.current.onCardDragStart({ altKey: true, preventDefault: () => (prevented = true) } as unknown as DragEvent);
    expect(prevented).toBe(true);
  });
});

describe("dragging", () => {
  test("the drag follows the pointer once it moves past the slop, with the target under it", () => {
    lanesInDom(start());
    const r = setup();

    act(() => r.result.current.onGrab("T1", press()));
    over = "B";
    pointer("pointermove", 2);
    expect(r.result.current.drag).toBeNull();

    pointer("pointermove", 150);
    expect(r.result.current.drag).toMatchObject({ id: "T1", x: 150, target: { lane: "B", at: { id: "T3", side: "after" } } });
    expect(r.result.current.shown).toEqual({ lane: "B", at: { id: "T3", side: "after" } });
    expect(document.body.classList.contains("moving")).toBe(true);
  });

  test("Esc cancels the drag and sends nothing", () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch");
    const r = setup();

    act(() => r.result.current.onGrab("T1", press()));
    over = "B";
    pointer("pointermove", 150);
    act(() => void dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    pointer("pointerup", 150, 0);

    expect(r.result.current.drag).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.body.classList.contains("moving")).toBe(false);
  });

  test("a pointer the browser cancels ends the drag without a move", () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch");
    const r = setup();

    act(() => r.result.current.onGrab("T1", press()));
    over = "B";
    pointer("pointermove", 150);
    pointer("pointercancel", 150, 0);

    expect(r.result.current.drag).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("a button released outside the page cancels the drag", () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch");
    const r = setup();

    act(() => r.result.current.onGrab("T1", press()));
    over = "B";
    pointer("pointermove", 150);
    // The next move arrives with no button down: the release happened where the page could not hear it.
    pointer("pointermove", 160, 0);

    expect(r.result.current.drag).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("dropping", () => {
  test("shows the move at once, sends it, then takes the server's board", async () => {
    lanesInDom(start());
    const server = board([lane("A", ["T2"]), lane("B", ["T3", "T1"]), lane("C", [])]);
    let reply!: (r: Response) => void;
    const fetch = spyOn(globalThis, "fetch").mockImplementation(
      (() => new Promise<Response>((resolve) => (reply = resolve))) as unknown as typeof globalThis.fetch,
    );
    const r = setup();

    await dragTo(r, "T1", "B", 150);

    expect(ids(r.result.current.board)).toEqual([
      ["A", ["T2"]],
      ["B", ["T3", "T1"]],
    ]);
    await waitFor(() => expect(moves(fetch)).toEqual([{ id: "T1", lane: "B", at: { id: "T3", side: "after" } }]));

    await act(async () => reply(Response.json({ result: { done: "T1 is now B#2.", warnings: [] }, board: server })));
    await waitFor(() => expect(r.result.current.board.lanes.map((l) => l.key)).toEqual(["A", "B", "C"]));
    expect(r.result.current.notice).toBeNull();
  });

  test("a warning about the moved task shows in a notice; warnings about other tasks do not", async () => {
    lanesInDom(start());
    spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        result: { done: "T1 is now B#2.", warnings: ["T1 is a release in lane B, not lane A.", "T10 is elsewhere."] },
        board: start(),
      }),
    );
    const r = setup();

    await dragTo(r, "T1", "B", 150);

    await waitFor(() =>
      expect(r.result.current.notice).toEqual({
        failed: false,
        title: "T1 is now B#2.",
        lines: ["T1 is a release in lane B, not lane A."],
      }),
    );
  });

  test("a refused move shows why and takes the server's board", async () => {
    lanesInDom(start());
    spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "T3 is not in that lane any more; reload the board.", board: start() }, { status: 400 }),
    );
    const r = setup();

    await dragTo(r, "T1", "B", 150);

    await waitFor(() =>
      expect(r.result.current.notice).toEqual({
        failed: true,
        title: "Could not move T1",
        lines: ["T3 is not in that lane any more; reload the board."],
      }),
    );
    expect(ids(r.result.current.board)).toEqual([
      ["A", ["T1", "T2"]],
      ["B", ["T3"]],
    ]);
  });

  test("a lost reply puts the old board back, says so, and asks the server again", async () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
      if (url === "/api/move") throw new Error("Network down");
      return Response.json(board([lane("A", ["T2"]), lane("B", ["T3", "T1"])]));
    }) as unknown as typeof globalThis.fetch);
    const r = setup();

    await dragTo(r, "T1", "B", 150);

    await waitFor(() => expect(r.result.current.notice).toEqual({ failed: true, title: "Could not move T1", lines: ["Network down"] }));
    await waitFor(() =>
      expect(ids(r.result.current.board)).toEqual([
        ["A", ["T2"]],
        ["B", ["T3", "T1"]],
      ]),
    );
    expect(fetch).toHaveBeenCalledWith("/api/board");
  });

  test("a drop that changes nothing sends no move, only reloads the board", async () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(start()));
    const r = setup();

    // T2 dropped right of every card in its own lane, where it already is.
    await dragTo(r, "T2", "A", 500);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/board"));
    expect(moves(fetch)).toEqual([]);
  });

  test("a failed reload keeps the board the page shows", async () => {
    lanesInDom(start());
    const fetch = spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network down"));
    const r = setup();

    // A drop that changes nothing only reloads the board; that reload fails.
    await dragTo(r, "T2", "A", 500);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/board"));
    expect(ids(r.result.current.board)).toEqual([
      ["A", ["T1", "T2"]],
      ["B", ["T3"]],
    ]);
    expect(r.result.current.notice).toBeNull();
  });

  test("moves are sent one at a time, and only the newest reply replaces the board", async () => {
    lanesInDom(start());
    const replies: ((r: Response) => void)[] = [];
    const fetch = spyOn(globalThis, "fetch").mockImplementation(
      (() => new Promise<Response>((resolve) => replies.push(resolve))) as unknown as typeof globalThis.fetch,
    );
    const r = setup();

    await dragTo(r, "T1", "B", 150);
    await dragTo(r, "T2", "B", 150);

    // The second move waits for the first reply before it is sent.
    await waitFor(() => expect(moves(fetch)).toHaveLength(1));
    const first = board([lane("A", ["T2"]), lane("B", ["T3", "T1"]), lane("OLD", [])]);
    await act(async () => replies[0]!(Response.json({ result: { done: "", warnings: [] }, board: first })));
    await waitFor(() => expect(moves(fetch)).toHaveLength(2));
    // The first reply is older than the second drop, so the page keeps showing the second drop.
    expect(r.result.current.board.lanes.map((l) => l.key)).not.toContain("OLD");

    const second = board([lane("A", []), lane("B", ["T3", "T1", "T2"]), lane("NEW", [])]);
    await act(async () => replies[1]!(Response.json({ result: { done: "", warnings: [] }, board: second })));
    await waitFor(() => expect(r.result.current.board.lanes.map((l) => l.key)).toContain("NEW"));
  });
});
