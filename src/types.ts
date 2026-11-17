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

export interface Task extends TaskMeta {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: boolean;
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
