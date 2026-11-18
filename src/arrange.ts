import { db } from "./db";
import { RELEASE_LANE } from "./rules";
import type { TaskMeta } from "./types";

/** Every write returns what it did, plus the rule warnings for the whole board after the write. */
export interface ArrangeResult {
  done: string;
  warnings: string[];
}

interface Placement { task_id: string; lane_key: string; pos: number }

const laneIds = (lane: string): string[] =>
  db.query<{ task_id: string }, [string]>("SELECT task_id FROM placement WHERE lane_key = ? ORDER BY pos").all(lane).map((r) => r.task_id);

const placementOf = (id: string): Placement | null =>
  db.query<Placement, [string]>("SELECT task_id, lane_key, pos FROM placement WHERE task_id = ?").get(id);

function assertTask(id: string): void {
  if (!db.query("SELECT 1 FROM task WHERE id = ?").get(id)) throw new Error(`Unknown task ${id}`);
}

function assertLane(key: string): void {
  if (!db.query("SELECT 1 FROM lane WHERE key = ?").get(key)) throw new Error(`Unknown lane ${key}`);
}

const clearLane = db.prepare("DELETE FROM placement WHERE lane_key = ?");
const deletePlacement = db.prepare("DELETE FROM placement WHERE task_id = ?");
const insertPlacement = db.prepare("INSERT INTO placement (task_id, lane_key, pos) VALUES (?, ?, ?)");

/** Makes `ids` the exact content of a lane, positions 0..n-1. A listed task placed elsewhere moves here. */
function writeLane(lane: string, ids: string[]): void {
  clearLane.run(lane);
  for (const id of ids) deletePlacement.run(id);
  ids.forEach((id, pos) => insertPlacement.run(id, lane, pos));
}

/** Checks the board against the hard rules and returns one line per breach. */
export function checkRules(): string[] {
  const rows = db
    .query<Placement & { kind: string | null; app: string | null }, []>(
      `SELECT p.task_id, p.lane_key, p.pos, json_extract(t.meta, '$.kind') AS kind, json_extract(t.meta, '$.app') AS app
       FROM placement p JOIN task t ON t.id = p.task_id WHERE t.closed = 0`,
    )
    .all();
  const at = new Map(rows.map((r) => [r.task_id, r]));
  const warnings: string[] = [];

  for (const r of rows) {
    if (r.kind === "release" && r.app?.includes("billing") && r.lane_key !== RELEASE_LANE) {
      warnings.push(`${r.task_id} is a release in lane ${r.lane_key}, not lane ${RELEASE_LANE}.`);
    }
  }

  for (const { a, b } of db.query<{ a: string; b: string }, []>("SELECT a, b FROM edge").all()) {
    const pa = at.get(a), pb = at.get(b);
    if (!pa || !pb) continue;
    const where = (p: Placement) => `${p.lane_key}#${p.pos + 1}`;
    if (pa.lane_key === pb.lane_key && pa.pos > pb.pos) {
      warnings.push(`${a} (${where(pa)}) blocks ${b} (${where(pb)}) but comes after it.`);
    } else if (pa.lane_key !== pb.lane_key && pa.pos >= pb.pos) {
      warnings.push(`${a} (${where(pa)}) blocks ${b} (${where(pb)}) in another lane; lane ${pb.lane_key} may wait.`);
    }
  }
  return warnings;
}

const result = (done: string): ArrangeResult => ({ done, warnings: checkRules() });

/**
 * Moves a task to a lane at a 1-based position (default: the end). Works for unplaced tasks and moves inside a lane.
 */
export function placeTask(id: string, lane: string, position?: number): ArrangeResult {
  assertTask(id);
  assertLane(lane);
  db.transaction(() => {
    const from = placementOf(id);
    if (from) writeLane(from.lane_key, laneIds(from.lane_key).filter((x) => x !== id));
    const ids = laneIds(lane);
    const index = position === undefined ? ids.length : Math.min(Math.max(position - 1, 0), ids.length);
    ids.splice(index, 0, id);
    writeLane(lane, ids);
  })();
  const pos = laneIds(lane).indexOf(id) + 1;
  return result(`${id} is now ${lane}#${pos}.`);
}

/** Sets the full order of a lane. The list must hold exactly the lane's current tasks. */
export function reorderLane(lane: string, ids: string[]): ArrangeResult {
  assertLane(lane);
  const current = laneIds(lane);
  const missing = current.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !current.includes(id));
  if (missing.length || extra.length || new Set(ids).size !== ids.length) {
    throw new Error(`Lane ${lane} order must list its ${current.length} tasks once each. Missing: ${missing.join(", ") || "none"}. Not in lane: ${extra.join(", ") || "none"}.`);
  }
  db.transaction(() => writeLane(lane, ids))();
  return result(`Lane ${lane} reordered (${ids.length} tasks).`);
}

/** Takes a task out of its lane. An open task then shows in lane N; a closed one disappears. */
export function unplaceTask(id: string): ArrangeResult {
  assertTask(id);
  const from = placementOf(id);
  if (!from) return result(`${id} was not placed.`);
  db.transaction(() => writeLane(from.lane_key, laneIds(from.lane_key).filter((x) => x !== id)))();
  return result(`${id} removed from lane ${from.lane_key}.`);
}

/** True when b can already reach a through edges, so a → b would close a loop. */
function reaches(from: string, to: string): boolean {
  const next = db.query<{ b: string }, [string]>("SELECT b FROM edge WHERE a = ?");
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const { b } of next.all(id)) stack.push(b);
  }
  return false;
}

/** Records that `blocker` must finish before `blocked` can start. */
export function addEdge(blocker: string, blocked: string): ArrangeResult {
  assertTask(blocker);
  assertTask(blocked);
  if (blocker === blocked) throw new Error("A task cannot block itself.");
  if (reaches(blocked, blocker)) throw new Error(`${blocked} already leads to ${blocker}; adding this edge makes a loop.`);
  db.run("INSERT OR IGNORE INTO edge (a, b) VALUES (?, ?)", [blocker, blocked]);
  return result(`${blocker} now blocks ${blocked}.`);
}

export function removeEdge(blocker: string, blocked: string): ArrangeResult {
  const { changes } = db.run("DELETE FROM edge WHERE a = ? AND b = ?", [blocker, blocked]);
  return result(changes ? `${blocker} no longer blocks ${blocked}.` : `There was no edge ${blocker} → ${blocked}.`);
}

export function renameLane(key: string, name: string): ArrangeResult {
  assertLane(key);
  db.run("UPDATE lane SET name = ? WHERE key = ?", [name, key]);
  return result(`Lane ${key} is now "${name}".`);
}

/** Sets the free-text note shown in the card's tooltip. An empty note removes it. */
export function setNote(id: string, note: string): ArrangeResult {
  assertTask(id);
  const row = db.query<{ meta: string }, [string]>("SELECT meta FROM task WHERE id = ?").get(id)!;
  const meta = JSON.parse(row.meta) as TaskMeta;
  if (note) meta.note = note;
  else delete meta.note;
  db.run("UPDATE task SET meta = ? WHERE id = ?", [JSON.stringify(meta), id]);
  return result(note ? `Note set on ${id}.` : `Note removed from ${id}.`);
}
