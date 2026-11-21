import type { Board, Lane, Task } from "../src/shared/types";

/** A task for web tests: open, no cycle, "todo" tone, unless `over` says otherwise. */
export const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  source: "linear",
  title: `${id} title`,
  status: "Todo",
  url: `https://example.com/${id}`,
  closed: false,
  cycle: null,
  tone: "todo",
  ...over,
});

export const lane = (key: string, ids: string[], over: Partial<Lane> = {}): Lane => ({
  key,
  name: `Lane ${key} name`,
  bg: "#fff",
  head: "#eee",
  ids,
  ...over,
});

/** A board from lanes; every id in them gets a default task unless `tasks` gives one. */
export function board(lanes: Lane[], tasks: Task[] = [], edges: [string, string][] = []): Board {
  const byId: Record<string, Task> = {};
  for (const l of lanes) for (const id of l.ids) byId[id] = task(id);
  for (const t of tasks) byId[t.id] = t;
  return { lanes, tasks: byId, edges };
}
