import { db } from "./db";
import { fetchGithub } from "./sources/github";
import { fetchLinear } from "./sources/linear";
import type { Fact } from "./sources/types";
import type { RefreshSummary, Source } from "./types";

interface Known {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: number;
}

const updateTask = db.prepare("UPDATE task SET title = ?, status = ?, url = ?, closed = ? WHERE id = ?");
const insertTask = db.prepare("INSERT INTO task (id, source, title, status, url, closed) VALUES (?, ?, ?, ?, ?, 0)");

const apply = db.transaction((facts: Fact[], known: Map<string, Known>, summary: RefreshSummary) => {
  for (const f of facts) {
    const k = known.get(f.id);
    if (!k) {
      if (f.closed) continue;
      insertTask.run(f.id, f.source, f.title, f.status, f.url);
      summary.added.push(f.id);
      continue;
    }
    const closed = f.closed ? 1 : 0;
    if (k.status !== f.status || k.closed !== closed) summary.changes.push({ id: f.id, from: k.status, to: f.status });
    if (k.status !== f.status || k.closed !== closed || k.title !== f.title || k.url !== f.url) {
      updateTask.run(f.title, f.status, f.url, closed, f.id);
    }
  }
});

/** Pulls task facts from Linear and GitHub and writes them. Lanes, positions and edges are never touched. */
export async function refresh(): Promise<RefreshSummary> {
  const rows = db.query<Known, []>("SELECT id, source, title, status, url, closed FROM task").all();
  const known = new Map(rows.map((r) => [r.id, r]));
  const linearIds = rows.filter((r) => r.source === "linear").map((r) => r.id);

  const [linear, github] = await Promise.allSettled([fetchLinear(linearIds), fetchGithub()]);
  const summary: RefreshSummary = { changes: [], added: [], errors: {} };
  const facts: Fact[] = [];
  for (const [source, result] of [["linear", linear], ["github", github]] as const) {
    if (result.status === "fulfilled") facts.push(...result.value);
    else summary.errors[source] = result.reason instanceof Error ? result.reason.message : String(result.reason);
  }

  apply(facts, known, summary);
  return summary;
}
