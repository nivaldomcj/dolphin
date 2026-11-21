import type { Generated } from "kysely";
import type { Source } from "../types";

/** Row types for Kysely. Keep them in step with the migrations in `./migrations`. */
export interface DB {
  lane: LaneTable;
  task: TaskTable;
  placement: PlacementTable;
  edge: EdgeTable;
  setting: SettingTable;
}

export interface LaneTable {
  key: string;
  name: string;
  bg: string;
  head: string;
  ord: number;
}

export interface TaskTable {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  /** 0 or 1: SQLite has no boolean. */
  closed: Generated<number>;
  /** JSON of `TaskMeta`: the fields the arrangement owns. */
  meta: Generated<string>;
  /** The tracker's cycle number; null when the task has no cycle. */
  cycle_number: Generated<number | null>;
  /** A `CycleState`; null when the task has no cycle. */
  cycle_state: Generated<string | null>;
}

export interface PlacementTable {
  task_id: string;
  lane_key: string;
  /** 0-based position inside the lane. */
  pos: number;
}

export interface EdgeTable {
  /** The blocker. */
  a: string;
  /** The blocked task. */
  b: string;
}

export interface SettingTable {
  key: string;
  /** JSON. */
  value: string;
}
