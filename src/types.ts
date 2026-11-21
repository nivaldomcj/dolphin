import type { Tone } from "./define-config";

/** Where a task's facts come from. A refresh overwrites facts; it never touches the arrangement. */
export type Source = "linear" | "github";

/** Fields the arrangement owns: written by the user or Claude, never by a refresh. */
export interface TaskMeta {
  short?: string;
  kind?: string;
  priority?: string | null;
  estimate?: string | null;
  app?: string;
  project?: string | null;
  parent?: string | null;
  note?: string;
}

/** Where a cycle sits against today. Only `current` is the cycle being worked on. */
export type CycleState = "current" | "next" | "future" | "past";

export const CYCLE_STATES: readonly CycleState[] = ["current", "next", "future", "past"];

/** The tracker's cycle of a task. Only Linear has cycles. */
export interface Cycle {
  number: number;
  state: CycleState;
}

export interface Task extends TaskMeta {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: boolean;
  /** Null when the task has no cycle. */
  cycle: Cycle | null;
  /** Card fill, from the status and the config's `tones`. */
  tone: Tone;
}

export interface Lane {
  key: string;
  name: string;
  bg: string;
  head: string;
  ids: string[];
}

/** The whole page in one payload, served by `GET /api/board`. */
export interface Board {
  lanes: Lane[];
  tasks: Record<string, Task>;
  edges: [string, string][];
}

/** Result of `POST /api/refresh` and of the MCP `refresh` tool. */
export interface RefreshSummary {
  /** Tasks whose status or open/closed state changed. */
  changes: { id: string; from: string; to: string }[];
  /** Open tasks the board did not know. They show in lane N until someone places them. */
  added: string[];
  /** A source that failed leaves its tasks untouched; the other source still applies. */
  errors: Partial<Record<Source, string>>;
}
