import { type Anchor, insertNear, UNPLACED, UNPLACED_LANE } from "../../shared/order";
import type { Board } from "../../shared/types";

/** Where a dragged card would land: a lane, next to one of its cards or at its end. */
export interface Target {
  lane: string;
  at?: Anchor;
  /** The card's own gap: dropping there changes nothing. */
  home?: boolean;
}

const cardId = (el: Element | undefined) => (el as HTMLElement | undefined)?.dataset.id;

/** The lane under the pointer and the gap nearest to it. */
export function targetAt(x: number, y: number, id: string, closed: boolean): Target | null {
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
  const prev = self >= 0 ? cardId(all[self - 1]) : undefined,
    next = self >= 0 ? cardId(all[self + 1]) : undefined;
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
export function applyMove(board: Board, id: string, t: Target): Board | null {
  if (t.home) return null;
  const from = board.lanes.find((l) => l.ids.includes(id));
  const to = board.lanes.find((l) => l.key === t.lane);
  if (t.lane === UNPLACED_LANE) {
    if (from?.key === UNPLACED_LANE) return null;
    // Lane N may exist only during the drag: then the board gets it back, holding this task, as the server will show.
    const lanes = board.lanes.map((l) => (l === from ? { ...l, ids: l.ids.filter((x) => x !== id) } : l));
    const n = lanes.find((l) => l.key === UNPLACED_LANE);
    return {
      ...board,
      lanes: n ? lanes.map((l) => (l === n ? { ...l, ids: [...l.ids, id] } : l)) : [...lanes, { ...UNPLACED, ids: [id] }],
    };
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
export function mentions(warning: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w-])${escaped}($|[^\\w-])`).test(warning);
}
