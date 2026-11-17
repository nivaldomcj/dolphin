import { Database } from "bun:sqlite";
import type { Board, Lane, Task, TaskMeta } from "./types";

export const db = new Database(Bun.env.DOLPHIN_DB ?? "dolphin.db", { create: true, strict: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
db.run(`
  CREATE TABLE IF NOT EXISTS lane (
    key  TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bg   TEXT NOT NULL,
    head TEXT NOT NULL,
    ord  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS task (
    id     TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('linear', 'github')),
    title  TEXT NOT NULL,
    status TEXT NOT NULL,
    url    TEXT NOT NULL,
    closed INTEGER NOT NULL DEFAULT 0,
    meta   TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS placement (
    task_id  TEXT PRIMARY KEY REFERENCES task (id) ON DELETE CASCADE,
    lane_key TEXT NOT NULL REFERENCES lane (key),
    pos      INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS edge (
    a TEXT NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    b TEXT NOT NULL REFERENCES task (id) ON DELETE CASCADE,
    PRIMARY KEY (a, b)
  );
`);

/** Lane shown for tasks a refresh found but nobody placed yet. Not stored. */
const UNPLACED: Omit<Lane, "ids"> = { key: "N", name: "New, not placed yet", bg: "#eeeeee", head: "#d6d6d6" };

interface TaskRow {
  id: string;
  source: Task["source"];
  title: string;
  status: string;
  url: string;
  closed: number;
  meta: string;
}

/** Reads lanes, tasks and edges as one board, lanes in order and tasks by position. */
export function readBoard(): Board {
  const lanes = db.query<Omit<Lane, "ids">, []>("SELECT key, name, bg, head FROM lane ORDER BY ord").all();
  const placed = db.query<{ task_id: string; lane_key: string }, []>("SELECT task_id, lane_key FROM placement ORDER BY lane_key, pos").all();
  const rows = db.query<TaskRow, []>("SELECT * FROM task").all();
  const edges = db.query<{ a: string; b: string }, []>("SELECT a, b FROM edge").all();

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
