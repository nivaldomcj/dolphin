import { db } from "../src/db";
import { clearBoard } from "../src/core/clear-board";
import type { Insertable } from "kysely";
import type { LaneTable, TaskTable } from "../src/db/schema";

/** Empties the board tables before a test; the lane rules (settings) stay. */
export const resetDb = (): Promise<void> => clearBoard(db);

/** What an insert takes: Kysely makes the generated columns (closed, meta, cycle) optional. */
type TaskRow = Insertable<TaskTable>;

/** A task row: an open Linear task titled after its id, with no meta, unless `over` says otherwise. */
export const taskRow = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({
  id,
  source: "linear",
  title: id,
  status: "Todo",
  url: "",
  meta: "{}",
  ...over,
});

/** A lane row named after its key, with no colors. */
export const laneRow = (key: string, ord: number, over: Partial<LaneTable> = {}): LaneTable => ({
  key,
  name: key.toLowerCase(),
  bg: "",
  head: "",
  ord,
  ...over,
});

/** Placement rows that put `ids` in `lane`, in order. */
export const placements = (lane: string, ids: string[]) => ids.map((task_id, pos) => ({ task_id, lane_key: lane, pos }));
