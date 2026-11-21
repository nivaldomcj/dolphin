import type { Task } from "../../shared/types";

/** Which tasks the display settings hide. A hidden card keeps its position number, so it still matches the MCP. */
export interface Hide {
  /** Done, Canceled and "Not found" tasks. */
  closed: boolean;
  /** Tasks in a cycle other than the current one. */
  otherCycles: boolean;
}

/** A task planned for a cycle that is not the current one. A task with no cycle is not in another cycle. */
export const inOtherCycle = (t: Task): boolean => !!t.cycle && t.cycle.state !== "current";

export const isHidden = (t: Task, hide: Hide): boolean => (hide.closed && t.closed) || (hide.otherCycles && inOtherCycle(t));
