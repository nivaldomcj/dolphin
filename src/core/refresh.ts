import { db } from "../db";
import { backupDaily } from "./backup";
import { fetchGithub } from "../sources/github";
import { fetchLinear, type LinearResult } from "../sources/linear";
import type { Fact } from "../sources/types";
import type { RefreshSummary, Source } from "../types";

interface Known {
  id: string;
  source: Source;
  title: string;
  status: string;
  url: string;
  closed: number;
  cycle_number: number | null;
  cycle_state: string | null;
}

/** The fact's cycle as the two columns, or nothing when the tracker does not report cycles. */
const cycleColumns = (f: Fact) =>
  f.cycle === undefined ? {} : { cycle_number: f.cycle?.number ?? null, cycle_state: f.cycle?.state ?? null };

/** Status written on a Linear task that Linear no longer returns. The task is also closed, so its card fades. */
export const NOT_FOUND = "Not found in Linear";

/**
 * Writes the facts in one transaction. The current rows are read inside it, so a refresh that ran while this one
 * was fetching cannot make it insert a task twice.
 */
async function apply(facts: Fact[], missing: string[], summary: RefreshSummary): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const rows: Known[] = await trx
      .selectFrom("task")
      .select(["id", "source", "title", "status", "url", "closed", "cycle_number", "cycle_state"])
      .execute();
    const known = new Map(rows.map((r) => [r.id, r]));

    for (const f of facts) {
      const k = known.get(f.id);
      if (!k) {
        if (f.closed) continue;
        const inserted = await trx
          .insertInto("task")
          .values({ id: f.id, source: f.source, title: f.title, status: f.status, url: f.url, ...cycleColumns(f) })
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirst();
        if (inserted.numInsertedOrUpdatedRows) summary.added.push(f.id);
        continue;
      }
      const closed = f.closed ? 1 : 0;
      const cycle = cycleColumns(f);
      // A cycle move is not a status change, so it is written but not reported.
      const cycleMoved = "cycle_number" in cycle && (k.cycle_number !== cycle.cycle_number || k.cycle_state !== cycle.cycle_state);
      if (k.status !== f.status || k.closed !== closed) summary.changes.push({ id: f.id, from: k.status, to: f.status });
      if (k.status !== f.status || k.closed !== closed || k.title !== f.title || k.url !== f.url || cycleMoved) {
        await trx
          .updateTable("task")
          .set({ title: f.title, status: f.status, url: f.url, closed, ...cycle })
          .where("id", "=", f.id)
          .execute();
      }
    }

    for (const id of missing) {
      const k = known.get(id);
      if (!k || (k.status === NOT_FOUND && k.closed === 1)) continue;
      summary.changes.push({ id, from: k.status, to: NOT_FOUND });
      await trx.updateTable("task").set({ status: NOT_FOUND, closed: 1 }).where("id", "=", id).execute();
    }
  });
}

/** Where a refresh gets its facts. The trackers in production; fakes in tests. */
export interface Sources {
  fetchLinear: (knownIds: string[], signal?: AbortSignal) => Promise<LinearResult>;
  fetchGithub: (signal?: AbortSignal) => Promise<Fact[]>;
}

/** How long one source may take before it is cancelled and reported as failed. A refresh usually takes ~9 s. */
const DEADLINE_MS = 30_000;

/** Runs a source with a deadline: on expiry its requests are aborted and it fails with a "timed out" error. */
async function withDeadline<T>(name: string, ms: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${name} timed out after ${ms / 1000} s`)), ms);
  const expired = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason)));
  try {
    return await Promise.race([task(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds a refresh over the given sources. Runs never overlap, so an older fetch can never overwrite a newer one.
 * A call made while a run is in flight waits for one more run after it, so its result is never older than the call;
 * every call that arrives during the same run shares that next run.
 */
export function createRefresh(sources: Sources, deadlineMs = DEADLINE_MS): () => Promise<RefreshSummary> {
  let running: Promise<RefreshSummary> | null = null;
  let next: Promise<RefreshSummary> | null = null;
  const start = () => {
    const current: Promise<RefreshSummary> = run(sources, deadlineMs).finally(() => {
      if (running === current) running = null;
    });
    return (running = current);
  };
  return () => {
    // A queued run is joined first: between one run ending and the queued one starting, `running` is already null.
    if (next) return next;
    if (!running) return start();
    next = running
      .catch(() => undefined)
      .then(() => {
        next = null;
        return start();
      });
    return next;
  };
}

const pull = createRefresh({ fetchLinear, fetchGithub });

/**
 * Pulls task facts from Linear and GitHub and writes them. Lanes, positions and edges are never touched. Writes the
 * day's backup afterwards, when it is not there yet.
 */
export async function refresh(): Promise<RefreshSummary> {
  const summary = await pull();
  void backupDaily();
  return summary;
}

async function run(sources: Sources, deadlineMs: number): Promise<RefreshSummary> {
  const linearIds = (await db.selectFrom("task").select("id").where("source", "=", "linear").execute()).map((r) => r.id);

  // Each source runs in its own async wrapper with its own deadline, so one that throws early or hangs cannot stop
  // the other.
  const [linear, github] = await Promise.allSettled([
    withDeadline("Linear", deadlineMs, async (signal) => sources.fetchLinear(linearIds, signal)),
    withDeadline("GitHub", deadlineMs, async (signal) => sources.fetchGithub(signal)),
  ]);
  const summary: RefreshSummary = { changes: [], added: [], errors: {} };
  const facts: Fact[] = [];
  let missing: string[] = [];
  if (linear.status === "fulfilled") {
    facts.push(...linear.value.facts);
    missing = linear.value.missing;
    if (linear.value.error) summary.errors.linear = linear.value.error;
  } else summary.errors.linear = message(linear.reason);
  if (github.status === "fulfilled") facts.push(...github.value);
  else summary.errors.github = message(github.reason);

  await apply(facts, missing, summary);
  return summary;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
