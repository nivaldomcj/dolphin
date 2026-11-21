import type { Cycle, Source } from "../shared/types";

/** What a tracker says about one task. A refresh writes only these fields. */
export interface Fact {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: boolean;
  /** The task's cycle, null when it has none. Left out by a tracker without cycles, so a refresh keeps the stored one. */
  cycle?: Cycle | null;
  /**
   * Set when the task is now assigned to someone else: their name, or null when nobody has it. A refresh removes
   * the task from the board. Left out while the task is still the user's, or when the tracker cannot tell.
   */
  reassignedTo?: string | null;
}
