import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { type Anchor, insertNear, UNPLACED, UNPLACED_LANE } from "../../core/order";
import type { Board } from "../../types";
import { type Notice, useAutoHide } from "../components/toast";

/** Where a dragged card would land: a lane, next to one of its cards or at its end. */
export interface Target {
  lane: string;
  at?: Anchor;
  /** The card's own gap: dropping there changes nothing. */
  home?: boolean;
}

/** A card being moved with Alt + drag, and the pointer that carries it. */
export interface Drag {
  id: string;
  x: number;
  y: number;
  /** Null while the pointer is outside every lane, or over lane N with a closed card. */
  target: Target | null;
}

/** A press becomes a drag only after the pointer moves this far, so an Alt + click never moves a card. */
const SLOP = 4;
/** How close to the scroller's edge the pointer must be to scroll it, and how fast it then scrolls. */
const EDGE = 48;
const SPEED = 14;

const cardId = (el: Element | undefined) => (el as HTMLElement | undefined)?.dataset.id;

/** The lane under the pointer and the gap nearest to it. */
function targetAt(x: number, y: number, id: string, closed: boolean): Target | null {
  const hit = document.elementFromPoint(x, y);
  const laneEl = hit?.closest<HTMLElement>(".lane[data-lane]");
  const lane = laneEl?.dataset.lane;
  if (!laneEl || !lane) return null;
  // Lane N lists open unplaced tasks only: a closed card dropped there would leave the board.
  if (lane === UNPLACED_LANE) return closed ? null : { lane };
  const all = [...laneEl.querySelectorAll<HTMLElement>(".card[data-id]")];
  const self = all.findIndex((c) => c.dataset.id === id);
  // Hidden (completed) cards are not in `all`, so the card's own gap is judged by its visible neighbors only:
  // otherwise dropping a card where it already is could move it past a hidden card.
  const prev = self >= 0 ? cardId(all[self - 1]) : undefined, next = self >= 0 ? cardId(all[self + 1]) : undefined;
  const home = (t: Target): Target => {
    if (self < 0) return t;
    const stays = t.at ? t.at.id === (t.at.side === "before" ? next : prev) : next === undefined;
    return stays ? { ...t, home: true } : t;
  };
  // A lane header or a collapsed lane shows no cards to aim at: the end of the lane.
  if (laneEl.classList.contains("collapsed") || hit?.closest(".lane-head")) return home({ lane });
  const cards = all.filter((c) => c.dataset.id !== id);
  const after = cards.find((c) => {
    const r = c.getBoundingClientRect();
    return r.left + r.width / 2 > x;
  });
  if (after) return home({ lane, at: { id: after.dataset.id!, side: "before" } });
  const last = cards.at(-1);
  return home(last ? { lane, at: { id: last.dataset.id!, side: "after" } } : { lane });
}

/** The board after the move, or null when the move changes nothing. */
function applyMove(board: Board, id: string, t: Target): Board | null {
  if (t.home) return null;
  const from = board.lanes.find((l) => l.ids.includes(id));
  const to = board.lanes.find((l) => l.key === t.lane);
  if (t.lane === UNPLACED_LANE) {
    if (from?.key === UNPLACED_LANE) return null;
    // Lane N may exist only during the drag: then the board gets it back, holding this task, as the server will show.
    const lanes = board.lanes.map((l) => (l === from ? { ...l, ids: l.ids.filter((x) => x !== id) } : l));
    const n = lanes.find((l) => l.key === UNPLACED_LANE);
    return { ...board, lanes: n ? lanes.map((l) => (l === n ? { ...l, ids: [...l.ids, id] } : l)) : [...lanes, { ...UNPLACED, ids: [id] }] };
  }
  if (!to) return null;
  let ids: string[];
  try {
    ids = insertNear(to.ids, id, t.at);
  } catch {
    return null; // the anchor left the lane; the next board from the server redraws the targets
  }
  if (from === to && ids.every((x, i) => x === to.ids[i])) return null;
  const lanes = board.lanes
    .map((l) => (l === to ? { ...l, ids } : l === from ? { ...l, ids: l.ids.filter((x) => x !== id) } : l))
    .filter((l) => l.key !== UNPLACED_LANE || l.ids.length > 0);
  return { ...board, lanes };
}

/** True when a warning names the task, as a whole id (T1 does not match T10). */
function mentions(warning: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w-])${escaped}($|[^\\w-])`).test(warning);
}

/**
 * Alt + drag on a card moves it: to another lane, before or after another card, or into lane N to unplace it.
 * The page shows the move at once, then takes the server's board. Esc cancels a drag.
 */
export function useMove(board: Board | null, setBoard: (b: Board) => void, scroller: RefObject<HTMLElement | null>) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const boardRef = useRef(board);
  boardRef.current = board;
  /** The click that ends an Alt-press must not open (or, on macOS, download) the link. */
  const swallowClick = useRef(false);
  /** Removes the listeners of the press in progress. */
  const stop = useRef<(() => void) | null>(null);
  /** Only the newest move's reply may replace the board. */
  const seq = useRef(0);
  /** Moves are sent one at a time, so the server saves them in the order they were dropped. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const update = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  /** Takes the server's board, e.g. after a drop that changed nothing on a page that may be out of date. */
  const reload = async () => {
    const mine = ++seq.current;
    try {
      const res = await fetch("/api/board");
      if (res.ok && mine === seq.current) setBoard((await res.json()) as Board);
    } catch {
      // The page keeps what it shows; the next move or refresh tries again.
    }
  };

  const drop = async (d: Drag) => {
    const before = boardRef.current;
    if (!before || !d.target) return;
    const after = applyMove(before, d.id, d.target);
    if (!after) return void reload();
    setBoard(after);
    const mine = ++seq.current;
    try {
      const send = queue.current.then(() =>
        fetch("/api/move", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: d.id, lane: d.target!.lane, at: d.target!.at }),
        }),
      );
      queue.current = send.catch(() => {});
      const res = await send;
      const data = (await res.json()) as { result?: { done: string; warnings: string[] }; error?: string; board?: Board };
      if (mine !== seq.current) return;
      if (data.board) setBoard(data.board);
      if (!res.ok) {
        setNotice({ failed: true, title: `Could not move ${d.id}`, lines: [data.error ?? `HTTP ${res.status}`] });
        return;
      }
      const lines = (data.result?.warnings ?? []).filter((w) => mentions(w, d.id));
      setNotice(lines.length > 0 ? { failed: false, title: data.result?.done ?? "", lines } : null);
    } catch (e) {
      if (mine !== seq.current) return;
      setBoard(before);
      setNotice({ failed: true, title: `Could not move ${d.id}`, lines: [e instanceof Error ? e.message : String(e)] });
      // The move may have been saved and only its reply lost: ask the server what the board is now.
      void reload();
    }
  };

  useAutoHide(notice, () => setNotice(null));

  // A press that is still in progress when the page goes away must not leave its listeners behind.
  useEffect(() => () => stop.current?.(), []);

  /**
   * Alt + press on a card arms a drag. Without Alt the card stays a plain link. The listeners are added here, not in an
   * effect: an effect runs a frame later, and a quick tap's pointerup would arrive before them.
   */
  const onGrab = (id: string, e: PointerEvent) => {
    if (!e.altKey || e.button !== 0 || stop.current) return;
    e.preventDefault();
    swallowClick.current = true;
    const closed = (e.currentTarget as HTMLElement | null)?.classList.contains("closed") ?? false;
    const x0 = e.clientX, y0 = e.clientY;
    let last = { x: x0, y: y0 };
    let frame = 0;

    const retarget = (x: number, y: number) => {
      last = { x, y };
      if (dragRef.current) update({ ...dragRef.current, x, y, target: targetAt(x, y, id, closed) });
    };
    const scroll = () => {
      const el = scroller.current, d = dragRef.current;
      if (el && d) {
        const r = el.getBoundingClientRect();
        const dx = d.x < r.left + EDGE ? -SPEED : d.x > r.right - EDGE ? SPEED : 0;
        const dy = d.y < r.top + EDGE ? -SPEED : d.y > r.bottom - EDGE ? SPEED : 0;
        if (dx || dy) el.scrollBy(dx, dy);
      }
      frame = requestAnimationFrame(scroll);
    };
    // The click that follows the release comes after pointerup, so let it through only on the next task.
    const release = () => setTimeout(() => (swallowClick.current = false));
    const end = (commit: boolean, x = last.x, y = last.y) => {
      const d = dragRef.current;
      teardown();
      if (d && commit) {
        const final = { ...d, x, y, target: targetAt(x, y, id, closed) };
        update(null);
        void drop(final);
      } else {
        update(null);
      }
    };
    const onMove = (ev: PointerEvent) => {
      // The button came up somewhere this page did not hear (another app, a dialog): where is unknown, so cancel.
      if (ev.buttons === 0) return end(false), release();
      if (!dragRef.current) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < SLOP) return;
        update({ id, x: ev.clientX, y: ev.clientY, target: null });
        document.body.classList.add("moving");
        frame = requestAnimationFrame(scroll);
      }
      retarget(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      end(true, ev.clientX, ev.clientY);
      release();
    };
    const onCancel = () => {
      end(false);
      release();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      // Before the search box's own Esc handler, which would also clear the search.
      ev.preventDefault();
      ev.stopPropagation();
      end(false);
      // The button is still down: keep swallowing until it comes up, so the release over the card does not open it.
      addEventListener("pointerup", release, { once: true });
    };
    // A wheel, a trackpad or the edge scroll moves the cards under a still pointer.
    const onScroll = () => dragRef.current && retarget(last.x, last.y);
    const el = scroller.current;
    const teardown = () => {
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onCancel);
      removeEventListener("keydown", onKey, true);
      el?.removeEventListener("scroll", onScroll);
      document.body.classList.remove("moving");
      stop.current = null;
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onCancel);
    addEventListener("keydown", onKey, true);
    el?.addEventListener("scroll", onScroll);
    stop.current = teardown;
  };

  const onCardClick = (e: MouseEvent) => {
    if (e.altKey || swallowClick.current) e.preventDefault();
  };

  /** The native link drag would take the pointer away from an Alt drag. */
  const onCardDragStart = (e: DragEvent) => {
    if (e.altKey || stop.current) e.preventDefault();
  };

  /** The drop target to draw, or null when the drop would change nothing. */
  const shown = drag?.target && board && applyMove(board, drag.id, drag.target) ? drag.target : null;

  return { drag, shown, notice, closeNotice: () => setNotice(null), onGrab, onCardClick, onCardDragStart };
}
