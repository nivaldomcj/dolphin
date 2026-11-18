import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { Board } from "../../types";

/**
 * Search state: the query, the matching task ids, and which match is current. Matches are in board
 * order, so stepping walks lane by lane, left to right.
 */
export function useSearch(board: Board | null) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !board) return null;
    const match = (s?: string | null) => (s ?? "").toLowerCase().includes(q);
    return new Set(Object.values(board.tasks).filter((t) => match(t.id) || match(t.title) || match(t.short) || match(t.app)).map((t) => t.id));
  }, [query, board]);

  const list = useMemo(() => (hits && board ? board.lanes.flatMap((l) => l.ids).filter((id) => hits.has(id)) : []), [hits, board]);

  useEffect(() => setIndex(0), [hits]);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = () => {
    setOpen(false);
    setQuery("");
  };
  const step = (delta: 1 | -1) => setIndex((i) => (list.length ? (i + delta + list.length) % list.length : 0));

  return { open, query, setQuery, hits, list, index, current: list[index], openSearch, closeSearch, step };
}
