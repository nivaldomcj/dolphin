/**
 * One-time import of a board `data.json` snapshot into SQLite.
 * Usage: bun run import <path/to/data.json> [--force]. It replaces every lane, task, placement and edge,
 * so it refuses to run on a board that already has lanes unless --force is given.
 */
import { db } from "../db";
import { PROJECT } from "../sources/github";
import { LINEAR_ISSUE_URL } from "../sources/linear";
import type { Source, TaskMeta } from "../types";

interface Snapshot {
  lanes: { key: string; name: string; ids: string[] }[];
  tasks: Record<string, TaskMeta & { title: string; status: string; url?: string; closed?: boolean; source?: Source }>;
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

/**
 * Which tracker a snapshot task belongs to when the snapshot does not say: its url's host first, then the GitHub
 * project's id prefix, then Linear's id shape (TEAM-123). Anything else stops the import rather than guess, because
 * a refresh would close a task it wrongly sends to Linear.
 */
function trackerOf(id: string, url: string | undefined): Source {
  // A url that cannot be parsed tells nothing about the tracker; fall through to the id.
  const host = url && URL.canParse(url) ? new URL(url).hostname : "";
  if (host === "github.com") return "github";
  if (host === "linear.app") return "linear";
  if (id.startsWith(`${PROJECT.prefix}-`)) return "github";
  if (/^[A-Z][A-Z0-9]*-\d+$/.test(id)) return "linear";
  throw new Error(`${id}: cannot tell its tracker; add "source": "linear" or "github" to it in the snapshot`);
}

const args = Bun.argv.slice(2);
const force = args.includes("--force");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("Usage: bun run import <path/to/data.json> [--force]");
  process.exit(1);
}

const existing = await db.selectFrom("lane").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow();
if (existing.n > 0 && !force) {
  console.error(`The board already has ${existing.n} lanes. The import would replace them and every placement and edge.`);
  console.error("Run again with --force to do it anyway.");
  process.exit(1);
}

const snap = (await Bun.file(path).json()) as Snapshot;

await db.transaction().execute(async (trx) => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await trx.deleteFrom(table).execute();

  for (const [id, t] of Object.entries(snap.tasks)) {
    const { title, status, url, closed, source: given, ...meta } = t;
    if (given !== undefined && given !== "linear" && given !== "github") throw new Error(`${id}: unknown source "${given}"`);
    const source = given ?? trackerOf(id, url);
    const href = url ?? (source === "linear" ? `${LINEAR_ISSUE_URL}${id}` : undefined);
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
