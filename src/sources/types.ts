import type { Cycle, Source } from "../types";

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
}
