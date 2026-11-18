import { db } from "../db";
import { fetchGithub } from "../sources/github";
import { fetchLinear } from "../sources/linear";
import type { Fact } from "../sources/types";
import type { RefreshSummary, Source } from "../types";

interface Known {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: number;
}

async function apply(facts: Fact[], known: Map<string, Known>, summary: RefreshSummary): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const f of facts) {
      const k = known.get(f.id);
      if (!k) {
        if (f.closed) continue;
        await trx.insertInto("task").values({ id: f.id, source: f.source, title: f.title, status: f.status, url: f.url }).execute();
        summary.added.push(f.id);
        continue;
      }
      const closed = f.closed ? 1 : 0;
      if (k.status !== f.status || k.closed !== closed) summary.changes.push({ id: f.id, from: k.status, to: f.status });
      if (k.status !== f.status || k.closed !== closed || k.title !== f.title || k.url !== f.url) {
        await trx.updateTable("task").set({ title: f.title, status: f.status, url: f.url, closed }).where("id", "=", f.id).execute();
      }
    }
  });
}

/** Pulls task facts from Linear and GitHub and writes them. Lanes, positions and edges are never touched. */
export async function refresh(): Promise<RefreshSummary> {
  const rows: Known[] = await db.selectFrom("task").select(["id", "source", "title", "status", "url", "closed"]).execute();
  const known = new Map(rows.map((r) => [r.id, r]));
  const linearIds = rows.filter((r) => r.source === "linear").map((r) => r.id);

  const [linear, github] = await Promise.allSettled([fetchLinear(linearIds), fetchGithub()]);
  const summary: RefreshSummary = { changes: [], added: [], errors: {} };
  const facts: Fact[] = [];
  for (const [source, result] of [["linear", linear], ["github", github]] as const) {
    if (result.status === "fulfilled") facts.push(...result.value);
    else summary.errors[source] = result.reason instanceof Error ? result.reason.message : String(result.reason);
  }

  await apply(facts, known, summary);
  return summary;
}
