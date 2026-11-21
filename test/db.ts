import { db } from "../src/db";
import { clearBoard } from "../src/core/clear-board";
import type { LaneTable, TaskTable } from "../src/db/schema";

/** Empties the board tables before a test; the lane rules (settings) stay. */
export const resetDb = (): Promise<void> => clearBoard(db);

type TaskRow = Omit<TaskTable, "closed" | "meta" | "cycle_number" | "cycle_state"> & {
  closed?: number;
  meta?: string;
  cycle_number?: number | null;
  cycle_state?: string | null;
};

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
