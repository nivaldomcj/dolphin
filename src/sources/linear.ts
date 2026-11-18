import type { Fact } from "./types";

const API = "https://api.linear.app/graphql";
const KEYCHAIN_ITEM = "dolphin-linear-api-key";
const FIELDS = "identifier title url state { name type }";
/** Linear state types that still need work. Everything else (completed, canceled, duplicate) is closed. */
const OPEN_TYPES = ["triage", "backlog", "unstarted", "started"];

interface Issue {
  identifier: string;
  title: string;
  url: string;
  state: { name: string; type: string };
}

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

async function gql<T>(key: string, query: string): Promise<T> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(`Linear API ${res.status}: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
  }
  return body.data;
}

const toFact = (i: Issue): Fact => ({
  id: i.identifier,
  source: "linear",
  title: i.title,
  status: i.state.name,
  url: i.url,
  closed: !OPEN_TYPES.includes(i.state.type),
});

/**
 * Fetches the current state of every known Linear task, plus the open issues assigned to the key's owner.
 * Known ids are read in batches of 50 aliased `issue` lookups, so closed tasks come back too.
 */
export async function fetchLinear(knownIds: string[]): Promise<Fact[]> {
  const key = await apiKey();
  const facts = new Map<string, Fact>();

  for (let i = 0; i < knownIds.length; i += 50) {
    const chunk = knownIds.slice(i, i + 50);
    const query = `{ ${chunk.map((id, n) => `i${n}: issue(id: ${JSON.stringify(id)}) { ${FIELDS} }`).join(" ")} }`;
    const data = await gql<Record<string, Issue | null>>(key, query);
    for (const issue of Object.values(data)) if (issue) facts.set(issue.identifier, toFact(issue));
  }

  const mine = await gql<{ viewer: { assignedIssues: { nodes: Issue[] } } }>(
    key,
    `{ viewer { assignedIssues(first: 250, filter: { state: { type: { in: ${JSON.stringify(OPEN_TYPES)} } } }) { nodes { ${FIELDS} } } } }`,
  );
  for (const issue of mine.viewer.assignedIssues.nodes) facts.set(issue.identifier, toFact(issue));

  return [...facts.values()];
}
