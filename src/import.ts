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

const insertLane = db.prepare("INSERT INTO lane (key, name, bg, head, ord) VALUES (?, ?, ?, ?, ?)");
const insertTask = db.prepare("INSERT INTO task (id, source, title, status, url, closed, meta) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertPlacement = db.prepare("INSERT INTO placement (task_id, lane_key, pos) VALUES (?, ?, ?)");
const insertEdge = db.prepare("INSERT OR IGNORE INTO edge (a, b) VALUES (?, ?)");

db.transaction(() => {
  db.run("DELETE FROM edge; DELETE FROM placement; DELETE FROM task; DELETE FROM lane;");

  for (const [id, t] of Object.entries(snap.tasks)) {
    const { title, status, url, closed, ...meta } = t;
    const source = id.startsWith("ENG-") ? "linear" : "github";
    const href = url ?? `https://linear.app/acme/issue/${id}`;
    insertTask.run(id, source, title, status, href, closed ? 1 : 0, JSON.stringify(meta));
  }

  snap.lanes
    .filter((l) => l.key !== "N")
    .forEach((lane, ord) => {
      const [bg, head] = COLORS[lane.key] ?? FALLBACK;
      insertLane.run(lane.key, lane.name, bg, head, ord);
      lane.ids.forEach((id, pos) => insertPlacement.run(id, lane.key, pos));
    });

  for (const [a, b] of snap.edges) insertEdge.run(a, b);
})();

const count = (table: string) => db.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table}`).get()?.n;
console.log(`Imported ${count("lane")} lanes, ${count("task")} tasks, ${count("placement")} placements, ${count("edge")} edges.`);
