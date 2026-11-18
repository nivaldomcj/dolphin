import type { Source } from "../types";

/** What a tracker says about one task. A refresh writes only these fields. */
export interface Fact {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: boolean;
}
