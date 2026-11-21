import { config } from "../config";
import type { Cycle } from "../types";
import type { Fact } from "./types";

const API = "https://api.linear.app/graphql";
const KEYCHAIN_ITEM = "dolphin-linear-api-key";
const FIELDS = "id identifier title url state { name type } cycle { number isActive isNext isPast isFuture completedAt }";
/** Linear state types that still need work. Everything else (completed, canceled, duplicate) is closed. */
const OPEN_TYPES = ["triage", "backlog", "unstarted", "started"];

interface Issue {
  /** Linear's stable UUID; the identifier (TEAM-123) changes when the issue moves to another team. */
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { name: string; type: string };
  cycle: { number: number; isActive: boolean; isNext: boolean; isPast: boolean; isFuture: boolean; completedAt: string | null } | null;
}

/**
 * Linear's cycle flags as one state. A completed cycle is past even before its scheduled end, when `isActive` and
 * `isPast` are both false. The next cycle is also `isFuture`, so `isNext` is checked first. A cycle no flag places
 * is past: it is not one that work is planned for.
 */
export const toCycle = (c: Issue["cycle"]): Cycle | null => {
  if (!c) return null;
  const state = c.completedAt || c.isPast ? "past" : c.isActive ? "current" : c.isNext ? "next" : c.isFuture ? "future" : "past";
  return { number: c.number, state };
};

/** Reads the personal API key from $LINEAR_API_KEY, else from the macOS Keychain. */
async function apiKey(): Promise<string> {
  if (Bun.env.LINEAR_API_KEY) return Bun.env.LINEAR_API_KEY;
  const out = await Bun.$`security find-generic-password -s ${KEYCHAIN_ITEM} -w`.quiet().nothrow();
  const key = out.stdout.toString().trim();
  if (out.exitCode !== 0 || !key) {
    throw new Error(`No Linear API key. Run: security add-generic-password -s ${KEYCHAIN_ITEM} -a "$USER" -w`);
  }
  return key;
}

interface GqlError {
  message: string;
  path?: (string | number)[];
}

interface GqlResult<T> {
  status: number;
  data: T | null;
  errors: GqlError[];
}

async function gql<T>(key: string, query: string, signal?: AbortSignal): Promise<GqlResult<T>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as { data?: T | null; errors?: GqlError[] } | null;
  if (!body) throw new Error(`Linear API ${res.status}: the response is not JSON`);
  return { status: res.status, data: body.data ?? null, errors: body.errors ?? [] };
}

const fail = ({ status, errors }: GqlResult<unknown>) =>
  new Error(`Linear API ${status}: ${errors.map((e) => e.message).join("; ") || "no data"}`);

const toFact = (i: Issue): Fact => ({
  id: i.identifier,
  source: "linear",
  title: i.title,
  status: i.state.name,
  url: i.url,
  closed: !OPEN_TYPES.includes(i.state.type),
  cycle: toCycle(i.cycle),
});

/**
 * The batch index of the lookup this error says is gone, or null when the error is anything else. Only an exact
 * alias (`i3`, not `i03`) at the top of the path counts; a not-found on a nested field does not.
 */
const goneIndex = (e: GqlError, batch: number): number | null => {
  const alias = e.path?.length === 1 ? String(e.path[0]) : "";
  const n = Number(alias.slice(1));
  return e.message === "Entity not found: Issue" && Number.isInteger(n) && n >= 0 && n < batch && alias === `i${n}` ? n : null;
};

/**
 * Looks up known ids in one aliased query. Linear answers the whole query with `data: null` when any one id is
 * missing, so the ids it reports as not found are dropped and the query is sent again without them.
 */
async function lookUp(key: string, ids: string[], missing: string[], signal?: AbortSignal): Promise<[requested: string, issue: Issue][]> {
  let left = ids;
  while (left.length > 0) {
    const query = `{ ${left.map((id, n) => `i${n}: issue(id: ${JSON.stringify(id)}) { ${FIELDS} }`).join(" ")} }`;
    const result = await gql<Record<string, Issue | null>>(key, query, signal);
    if (result.status === 200 && result.data && result.errors.length === 0) {
      const data = result.data;
      // Keyed by the id the board asked for: an issue moved to another team answers under its new identifier.
      return left.flatMap((id, n): [string, Issue][] => (data[`i${n}`] ? [[id, data[`i${n}`]!]] : []));
    }
    // Trust an error only when it is "not found" and names an alias of this batch; anything else fails the lookup,
    // so a malformed error can neither close the wrong task nor make this loop resend the same query forever.
    const gone = new Set<number>();
    for (const e of result.errors) {
      const n = goneIndex(e, left.length);
      if (n === null) throw fail(result);
      gone.add(n);
    }
    if (gone.size === 0) throw fail(result);
    missing.push(...left.filter((_, n) => gone.has(n)));
    left = left.filter((_, n) => !gone.has(n));
  }
  return [];
}

export interface LinearResult {
  facts: Fact[];
  /** Known ids Linear no longer returns: deleted, or out of the key's reach. */
  missing: string[];
  /** Set when a query failed after some facts were confirmed; the facts still apply, `missing` is then empty. */
  error?: string;
}

/**
 * Fetches the current state of every known Linear task, plus the open issues assigned to the key's owner.
 * Known ids are read in batches of 50 aliased `issue` lookups, so closed tasks come back too. With `linear: false`
 * in the config it returns nothing.
 */
export async function fetchLinear(knownIds: string[], signal?: AbortSignal): Promise<LinearResult> {
  if (config.linear === false) return { facts: [], missing: [] };
  const key = await apiKey();
  const facts = new Map<string, Fact>();
  const missing: string[] = [];

  // Issues already answered, by stable id, so the assigned list below does not add a moved issue a second time.
  const answered = new Set<string>();
  try {
    for (let i = 0; i < knownIds.length; i += 50) {
      for (const [requested, issue] of await lookUp(key, knownIds.slice(i, i + 50), missing, signal)) {
        facts.set(requested, { ...toFact(issue), id: requested });
        answered.add(issue.id);
      }
    }

    let after: string | null = null;
    do {
      const cursor: string = after ? `, after: ${JSON.stringify(after)}` : "";
      const result = await gql<{ viewer: { assignedIssues: { nodes: Issue[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } }>(
        key,
        `{ viewer { assignedIssues(first: 100${cursor}, filter: { state: { type: { in: ${JSON.stringify(OPEN_TYPES)} } } }) { nodes { ${FIELDS} } pageInfo { hasNextPage endCursor } } } }`,
        signal,
      );
      const data = result.data;
      if (result.status !== 200 || !data || result.errors.length) throw fail(result);
      for (const issue of data.viewer.assignedIssues.nodes) if (!answered.has(issue.id)) facts.set(issue.identifier, toFact(issue));
      after = data.viewer.assignedIssues.pageInfo.hasNextPage ? data.viewer.assignedIssues.pageInfo.endCursor : null;
    } while (after);
  } catch (e) {
    // Nothing confirmed yet: fail as before. Otherwise keep what was confirmed, and close nothing as missing,
    // because the assigned pages that did not load might have returned those ids.
    if (facts.size === 0) throw e;
    return { facts: [...facts.values()], missing: [], error: e instanceof Error ? e.message : String(e) };
  }

  // The two queries can see different moments: an id the assigned list returned is not missing.
  return { facts: [...facts.values()], missing: missing.filter((id) => !facts.has(id)) };
}
