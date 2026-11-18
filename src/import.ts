/**
 * One-time import of a board `data.json` snapshot into SQLite.
 * Usage: bun run import <path/to/data.json>. It replaces every lane, task, placement and edge.
 */
import { db } from "./db";
import type { TaskMeta } from "./types";

interface Snapshot {
  lanes: { key: string; name: string; ids: string[] }[];
  tasks: Record<string, TaskMeta & { title: string; status: string; url?: string; closed?: boolean }>;
  edges: [string, string][];
}

const COLORS: Record<string, [bg: string, head: string]> = {
  A: ["#f1eafb", "#d4c2f2"],
  B: ["#fdeaf2", "#f5bdd4"],
  C: ["#fff0e2", "#f8cfa5"],
  D: ["#e6f6ea", "#b5e2c0"],
  E: ["#e5f1fb", "#b3d5f2"],
  X: ["#e6f4f2", "#b4dcd6"],
};
const FALLBACK: [string, string] = ["#f3f3f3", "#dcdcdc"];

const path = Bun.argv[2];
if (!path) {
  console.error("Usage: bun run import <path/to/data.json>");
  process.exit(1);
}
const snap = (await Bun.file(path).json()) as Snapshot;

await db.transaction().execute(async (trx) => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await trx.deleteFrom(table).execute();

  for (const [id, t] of Object.entries(snap.tasks)) {
    const { title, status, url, closed, ...meta } = t;
    const source = id.startsWith("ENG-") ? "linear" : "github";
    const href = url ?? (source === "linear" ? `https://linear.app/acme/issue/${id}` : undefined);
    if (!href) throw new Error(`${id}: a GitHub task needs a url in the snapshot`);
    await trx.insertInto("task").values({ id, source, title, status, url: href, closed: closed ? 1 : 0, meta: JSON.stringify(meta) }).execute();
  }

  const lanes = snap.lanes.filter((l) => l.key !== "N");
  for (const [ord, lane] of lanes.entries()) {
    const [bg, head] = COLORS[lane.key] ?? FALLBACK;
    await trx.insertInto("lane").values({ key: lane.key, name: lane.name, bg, head, ord }).execute();
    for (const [pos, task_id] of lane.ids.entries()) await trx.insertInto("placement").values({ task_id, lane_key: lane.key, pos }).execute();
  }

  for (const [a, b] of snap.edges) await trx.insertInto("edge").values({ a, b }).onConflict((oc) => oc.doNothing()).execute();
});

const count = async (table: "lane" | "task" | "placement" | "edge") =>
  (await db.selectFrom(table).select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow()).n;
console.log(`Imported ${await count("lane")} lanes, ${await count("task")} tasks, ${await count("placement")} placements, ${await count("edge")} edges.`);
