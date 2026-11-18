import { db } from "./db";
import type { Board, Lane, Task, TaskMeta } from "./types";

/** Lane shown for tasks a refresh found but nobody placed yet. Not stored. */
const UNPLACED: Omit<Lane, "ids"> = { key: "N", name: "New, not placed yet", bg: "#eeeeee", head: "#d6d6d6" };

/** Reads lanes, tasks and edges as one board, lanes in order and tasks by position. */
export async function readBoard(): Promise<Board> {
  const [lanes, placed, rows, edges] = await Promise.all([
    db.selectFrom("lane").select(["key", "name", "bg", "head"]).orderBy("ord").execute(),
    db.selectFrom("placement").select(["task_id", "lane_key"]).orderBy("lane_key").orderBy("pos").execute(),
    db.selectFrom("task").selectAll().execute(),
    db.selectFrom("edge").select(["a", "b"]).execute(),
  ]);

  const tasks: Record<string, Task> = {};
  for (const r of rows) {
    const meta = JSON.parse(r.meta) as TaskMeta;
    tasks[r.id] = { ...meta, id: r.id, source: r.source, title: r.title, status: r.status, url: r.url, closed: r.closed === 1 };
  }

  const byLane = new Map<string, string[]>(lanes.map((l) => [l.key, []]));
  for (const p of placed) byLane.get(p.lane_key)?.push(p.task_id);
  const placedIds = new Set(placed.map((p) => p.task_id));
  const unplaced = rows.filter((r) => !placedIds.has(r.id) && r.closed === 0).map((r) => r.id);

  const board: Board = {
    lanes: lanes.map((l) => ({ ...l, ids: byLane.get(l.key) ?? [] })),
    tasks,
    edges: edges.map((e) => [e.a, e.b]),
  };
  if (unplaced.length > 0) board.lanes.push({ ...UNPLACED, ids: unplaced });
  return board;
}
