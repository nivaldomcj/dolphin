import type { Kysely } from "kysely";
import type { DB } from "../db/schema";

/**
 * Empties the board: edges, placements, tasks and lanes, in an order the foreign keys accept. The lane rules
 * (`setting`) stay. Pass a transaction to make it part of a larger write.
 */
export async function clearBoard(q: Kysely<DB>): Promise<void> {
  for (const table of ["edge", "placement", "task", "lane"] as const) await q.deleteFrom(table).execute();
}
