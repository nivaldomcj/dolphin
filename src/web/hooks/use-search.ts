import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { Board } from "../../shared/types";
import { type Hide, isHidden } from "../lib/visibility";

/**
 * Search state: the query, the matching task ids, and which match is current. Matches are in board
 * order, so stepping walks lane by lane, left to right.
 */
export function useSearch(board: Board | null, hide: Hide = { closed: false, otherCycles: false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** The current match by id, not by place: a drag and drop reorders the matches but keeps this one current. */
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  /** Bumped on every step and every new set of matches, so the page reveals the match even when its id repeats. */
  const [seq, setSeq] = useState(0);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !board) return null;
    const match = (s?: string | null) => (s ?? "").toLowerCase().includes(q);
    const visible = Object.values(board.tasks).filter((t) => !isHidden(t, hide));
    return new Set(visible.filter((t) => match(t.id) || match(t.title) || match(t.short) || match(t.app)).map((t) => t.id));
  }, [query, board, hide.closed, hide.otherCycles]);

  const list = useMemo(() => (hits && board ? board.lanes.flatMap((l) => l.ids).filter((id) => hits.has(id)) : []), [hits, board]);

  // A new set of matches starts at the first one. Keyed on the ids, not the Set, which every new board rebuilds.
  const hitKey = hits ? [...hits].sort().join("\n") : null;
  useEffect(() => {
    setCurrentId(list[0]);
    setSeq((n) => n + 1);
  }, [hitKey]);

  const index = Math.max(currentId === undefined ? 0 : list.indexOf(currentId), 0);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = () => {
    setOpen(false);
    setQuery("");
  };
  const step = (delta: 1 | -1) => {
    if (list.length) setCurrentId(list[(index + delta + list.length) % list.length]);
    setSeq((n) => n + 1);
  };

  return { open, query, setQuery, hits, list, index, seq, current: list[index], openSearch, closeSearch, step };
}
