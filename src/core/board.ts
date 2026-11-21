import { toneOf } from "../config";
import { db } from "../db";
import { UNPLACED } from "./order";
import { CYCLE_STATES, type Board, type Cycle, type CycleState, type Task, type TaskMeta } from "../types";

/** The stored cycle columns as a `Cycle`, or null when either is missing or the state is unknown. */
const cycleOf = (n: number | null, s: string | null): Cycle | null =>
  n !== null && CYCLE_STATES.includes(s as CycleState) ? { number: n, state: s as CycleState } : null;


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
    tasks[r.id] = { ...meta, id: r.id, source: r.source, title: r.title, status: r.status, url: r.url, closed: r.closed === 1, cycle: cycleOf(r.cycle_number, r.cycle_state), tone: toneOf(r.status) };
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
