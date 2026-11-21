import { useEffect, useMemo, useState } from "preact/hooks";
import type { Board } from "../../shared/types";

/** Which lane each task is in, and the blockers of each task (`up`) and the tasks it blocks (`down`). */
export interface BoardGraph {
  laneOf: Map<string, string>;
  up: Map<string, string[]>;
  down: Map<string, string[]>;
}

/** Loads the board once from `/api/board`; `setBoard` replaces it after a refresh. */
export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/board")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBoard, (e: Error) => setError(e.message));
  }, []);

  const graph = useMemo<BoardGraph>(() => {
    const laneOf = new Map<string, string>(),
      up = new Map<string, string[]>(),
      down = new Map<string, string[]>();
    for (const lane of board?.lanes ?? []) for (const id of lane.ids) laneOf.set(id, lane.key);
    for (const [a, b] of board?.edges ?? []) {
      down.set(a, [...(down.get(a) ?? []), b]);
      up.set(b, [...(up.get(b) ?? []), a]);
    }
    return { laneOf, up, down };
  }, [board]);

  return { board, setBoard, error, graph };
}
