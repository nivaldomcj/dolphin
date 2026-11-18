import { type Kysely, sql } from "kysely";
import { db } from "../db";
import type { DB } from "../db/schema";
import { RELEASE_LANE } from "./rules";
import type { TaskMeta } from "../types";

/** Every write returns what it did, plus the rule warnings for the whole board after the write. */
export interface ArrangeResult {
  done: string;
  warnings: string[];
}

/** The root handle or an open transaction. */
type Q = Kysely<DB>;

interface Placement { task_id: string; lane_key: string; pos: number }

async function laneIds(q: Q, lane: string): Promise<string[]> {
  const rows = await q.selectFrom("placement").select("task_id").where("lane_key", "=", lane).orderBy("pos").execute();
  return rows.map((r) => r.task_id);
}

const placementOf = (q: Q, id: string): Promise<Placement | undefined> =>
  q.selectFrom("placement").selectAll().where("task_id", "=", id).executeTakeFirst();

async function assertTask(id: string): Promise<void> {
  if (!(await db.selectFrom("task").select("id").where("id", "=", id).executeTakeFirst())) throw new Error(`Unknown task ${id}`);
}

async function assertLane(key: string): Promise<void> {
  if (!(await db.selectFrom("lane").select("key").where("key", "=", key).executeTakeFirst())) throw new Error(`Unknown lane ${key}`);
}

/** Makes `ids` the exact content of a lane, positions 0..n-1. A listed task placed elsewhere moves here. */
async function writeLane(q: Q, lane: string, ids: string[]): Promise<void> {
  await q.deleteFrom("placement").where("lane_key", "=", lane).execute();
  if (ids.length === 0) return;
  await q.deleteFrom("placement").where("task_id", "in", ids).execute();
  await q.insertInto("placement").values(ids.map((task_id, pos) => ({ task_id, lane_key: lane, pos }))).execute();
}

/** Checks the board against the hard rules and returns one line per breach. */
export async function checkRules(): Promise<string[]> {
  const rows = await db
    .selectFrom("placement as p")
    .innerJoin("task as t", "t.id", "p.task_id")
    .select([
      "p.task_id",
      "p.lane_key",
      "p.pos",
      sql<string | null>`json_extract(t.meta, '$.kind')`.as("kind"),
      sql<string | null>`json_extract(t.meta, '$.app')`.as("app"),
    ])
    .where("t.closed", "=", 0)
    .execute();
  const at = new Map(rows.map((r) => [r.task_id, r]));
  const warnings: string[] = [];

  for (const r of rows) {
    if (r.kind === "release" && r.app?.includes("billing") && r.lane_key !== RELEASE_LANE) {
      warnings.push(`${r.task_id} is a release in lane ${r.lane_key}, not lane ${RELEASE_LANE}.`);
    }
  }

  for (const { a, b } of await db.selectFrom("edge").select(["a", "b"]).execute()) {
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

const result = async (done: string): Promise<ArrangeResult> => ({ done, warnings: await checkRules() });

/**
 * Moves a task to a lane at a 1-based position (default: the end). Works for unplaced tasks and moves inside a lane.
 */
export async function placeTask(id: string, lane: string, position?: number): Promise<ArrangeResult> {
  await assertTask(id);
  await assertLane(lane);
  await db.transaction().execute(async (trx) => {
    const from = await placementOf(trx, id);
    if (from) await writeLane(trx, from.lane_key, (await laneIds(trx, from.lane_key)).filter((x) => x !== id));
    const ids = await laneIds(trx, lane);
    const index = position === undefined ? ids.length : Math.min(Math.max(position - 1, 0), ids.length);
    ids.splice(index, 0, id);
    await writeLane(trx, lane, ids);
  });
  const pos = (await laneIds(db, lane)).indexOf(id) + 1;
  return result(`${id} is now ${lane}#${pos}.`);
}

/** Sets the full order of a lane. The list must hold exactly the lane's current tasks. */
export async function reorderLane(lane: string, ids: string[]): Promise<ArrangeResult> {
  await assertLane(lane);
  // Membership is read inside the transaction, so a move that lands first makes this reorder fail, not undo it.
  await db.transaction().execute(async (trx) => {
    const current = await laneIds(trx, lane);
    const missing = current.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !current.includes(id));
    if (missing.length || extra.length || new Set(ids).size !== ids.length) {
      throw new Error(`Lane ${lane} order must list its ${current.length} tasks once each. Missing: ${missing.join(", ") || "none"}. Not in lane: ${extra.join(", ") || "none"}.`);
    }
    await writeLane(trx, lane, ids);
  });
  return result(`Lane ${lane} reordered (${ids.length} tasks).`);
}

/** Takes a task out of its lane. An open task then shows in lane N; a closed one disappears. */
export async function unplaceTask(id: string): Promise<ArrangeResult> {
  await assertTask(id);
  const from = await placementOf(db, id);
  if (!from) return result(`${id} was not placed.`);
  await db.transaction().execute(async (trx) => writeLane(trx, from.lane_key, (await laneIds(trx, from.lane_key)).filter((x) => x !== id)));
  return result(`${id} removed from lane ${from.lane_key}.`);
}

/** True when `from` can already reach `to` through edges. */
async function reaches(q: Q, from: string, to: string): Promise<boolean> {
  const edges = await q.selectFrom("edge").select(["a", "b"]).execute();
  const next = Map.groupBy(edges, (e) => e.a);
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of next.get(id) ?? []) stack.push(e.b);
  }
  return false;
}

/** Records that `blocker` must finish before `blocked` can start. */
export async function addEdge(blocker: string, blocked: string): Promise<ArrangeResult> {
  await assertTask(blocker);
  await assertTask(blocked);
  if (blocker === blocked) throw new Error("A task cannot block itself.");
  // The loop check and the insert share one transaction, so two parallel calls cannot both pass the check.
  await db.transaction().execute(async (trx) => {
    if (await reaches(trx, blocked, blocker)) throw new Error(`${blocked} already leads to ${blocker}; adding this edge makes a loop.`);
    await trx.insertInto("edge").values({ a: blocker, b: blocked }).onConflict((oc) => oc.doNothing()).execute();
  });
  return result(`${blocker} now blocks ${blocked}.`);
}

export async function removeEdge(blocker: string, blocked: string): Promise<ArrangeResult> {
  const { numDeletedRows } = await db.deleteFrom("edge").where("a", "=", blocker).where("b", "=", blocked).executeTakeFirst();
  return result(numDeletedRows > 0n ? `${blocker} no longer blocks ${blocked}.` : `There was no edge ${blocker} → ${blocked}.`);
}

export async function renameLane(key: string, name: string): Promise<ArrangeResult> {
  await assertLane(key);
  await db.updateTable("lane").set({ name }).where("key", "=", key).execute();
  return result(`Lane ${key} is now "${name}".`);
}

/** Sets the free-text note shown in the card's tooltip. An empty note removes it. */
export async function setNote(id: string, note: string): Promise<ArrangeResult> {
  await assertTask(id);
  const row = await db.selectFrom("task").select("meta").where("id", "=", id).executeTakeFirstOrThrow();
  const meta = JSON.parse(row.meta) as TaskMeta;
  if (note) meta.note = note;
  else delete meta.note;
  await db.updateTable("task").set({ meta: JSON.stringify(meta) }).where("id", "=", id).execute();
  return result(note ? `Note set on ${id}.` : `Note removed from ${id}.`);
}
