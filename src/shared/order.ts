import type { Lane } from "./types";

/** The lane `readBoard` shows unplaced open tasks in. It is not stored, so moving a task there unplaces it. */
export const UNPLACED_LANE = "N";

/** Lane N's look. The page also shows it, empty, during a drag, so a card can be unplaced. */
export const UNPLACED: Omit<Lane, "ids"> = { key: UNPLACED_LANE, name: "New, not placed yet", bg: "#eeeeee", head: "#d6d6d6" };

/** Where a moved task lands: next to a card, or at the end of the lane when left out. */
export interface Anchor {
  id: string;
  side: "before" | "after";
}

/**
 * Returns `ids` with `id` moved next to the anchor (or to the end). `id` may or may not be in `ids` already.
 * Pure, with no database access, so the page can apply the same move before the server answers.
 */
export function insertNear(ids: string[], id: string, at?: Anchor): string[] {
  const missing = (anchor: string) => new Error(`${anchor} is not in that lane any more; reload the board.`);
  // A task anchored on itself stays where it is, but only in its own lane: elsewhere it is a missing anchor.
  if (at?.id === id) {
    if (!ids.includes(id)) throw missing(id);
    return [...ids];
  }
  const rest = ids.filter((x) => x !== id);
  if (!at) return [...rest, id];
  const index = rest.indexOf(at.id);
  if (index < 0) throw missing(at.id);
  rest.splice(at.side === "before" ? index : index + 1, 0, id);
  return rest;
}
