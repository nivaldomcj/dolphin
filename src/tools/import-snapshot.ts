import { config } from "../config";
import { db } from "../db";
import type { Source, TaskMeta } from "../shared/types";

/** A board `data.json` snapshot, as the old board wrote it. */
export interface Snapshot {
  lanes: { key: string; name: string; ids: string[]; bg?: string; head?: string }[];
  tasks: Record<string, TaskMeta & { title: string; status: string; url?: string; closed?: boolean; source?: Source }>;
  edges: [string, string][];
}

export interface ImportCounts {
  lanes: number;
  tasks: number;
  placements: number;
  edges: number;
}

/** Lane colors in board order, for snapshot lanes that bring none. */
export const PALETTE: [bg: string, head: string][] = [
  ["#f1eafb", "#d4c2f2"],
  ["#fdeaf2", "#f5bdd4"],
  ["#fff0e2", "#f8cfa5"],
  ["#e6f6ea", "#b5e2c0"],
  ["#e5f1fb", "#b3d5f2"],
  ["#e6f4f2", "#b4dcd6"],
];

/**
 * Which tracker a snapshot task belongs to when the snapshot does not say: its url's host first, then the configured
 * GitHub project's id prefix, then Linear's id shape (TEAM-123). Anything else stops the import rather than guess, because
 * a refresh would close a task it wrongly sends to Linear.
 */
export function trackerOf(id: string, url: string | undefined): Source {
  // A url that cannot be parsed tells nothing about the tracker; fall through to the id.
  const host = url && URL.canParse(url) ? new URL(url).hostname : "";
  if (host === "github.com") return "github";
  if (host === "linear.app") return "linear";
  if (config.github && id.startsWith(`${config.github.prefix}-`)) return "github";
  if (/^[A-Z][A-Z0-9]*-\d+$/.test(id)) return "linear";
  throw new Error(`${id}: cannot tell its tracker; add "source": "linear" or "github" to it in the snapshot`);
}

/** Thrown when the board already has lanes and the import was not forced. */
export class BoardNotEmptyError extends Error {
  constructor(readonly lanes: number) {
    super(`The board already has ${lanes} lanes. The import would replace them and every placement and edge.`);
  }
}

const count = async (table: "lane" | "task" | "placement" | "edge") =>
  (
    await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .executeTakeFirstOrThrow()
  ).n;

/**
 * Replaces every lane, task, placement and edge with the snapshot's, in one transaction: a bad task leaves the old
 * board as it was. Refuses a board that already has lanes unless `force` is set.
 */
export async function importSnapshot(snap: Snapshot, { force = false } = {}): Promise<ImportCounts> {
  const existing = await count("lane");
  if (existing > 0 && !force) throw new BoardNotEmptyError(existing);

  await db.transaction().execute(async (trx) => {
    for (const table of ["edge", "placement", "task", "lane"] as const) await trx.deleteFrom(table).execute();

    for (const [id, t] of Object.entries(snap.tasks)) {
      const { title, status, url, closed, source: given, ...meta } = t;
      if (given !== undefined && given !== "linear" && given !== "github") throw new Error(`${id}: unknown source "${given}"`);
      const source = given ?? trackerOf(id, url);
      if (!url && source === "github") throw new Error(`${id}: a GitHub task needs a url in the snapshot`);
      // A Linear task without a url gets Linear's own link on the next refresh.
      await trx
        .insertInto("task")
        .values({ id, source, title, status, url: url ?? "", closed: closed ? 1 : 0, meta: JSON.stringify(meta) })
        .execute();
    }

    const lanes = snap.lanes.filter((l) => l.key !== "N");
    for (const [ord, lane] of lanes.entries()) {
      const [bg, head] = PALETTE[ord % PALETTE.length]!;
      await trx
        .insertInto("lane")
        .values({ key: lane.key, name: lane.name, bg: lane.bg ?? bg, head: lane.head ?? head, ord })
        .execute();
      for (const [pos, task_id] of lane.ids.entries())
        await trx.insertInto("placement").values({ task_id, lane_key: lane.key, pos }).execute();
    }

    for (const [a, b] of snap.edges)
      await trx
        .insertInto("edge")
        .values({ a, b })
        .onConflict((oc) => oc.doNothing())
        .execute();
  });

  return { lanes: await count("lane"), tasks: await count("task"), placements: await count("placement"), edges: await count("edge") };
}
