import type { Fact } from "./types";

/** The UNI board (lane X). Change these when the side project moves. */
const PROJECT = { owner: "example-org", number: 1, login: "nivaldomcj", repo: "example-org/tracker", prefix: "TRK" };

/** Board columns that still need work. */
const OPEN = new Set(["Backlog", "Todo", "Doing", "Stuck", "Review"]);

/** Only the fields a card needs. `gh --paginate` advances the cursor only when the variable is named `$endCursor`. */
const QUERY = `query($endCursor: String) {
  organization(login: "${PROJECT.owner}") {
    projectV2(number: ${PROJECT.number}) {
      items(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
          content { ... on Issue { number title url repository { nameWithOwner } assignees(first: 20) { nodes { login } } } }
        }
      }
    }
  }
}`;

/** One JSON line per issue of the repo assigned to the user. */
const JQ = `.data.organization.projectV2.items.nodes[]
  | select(.content.repository.nameWithOwner == "${PROJECT.repo}")
  | select([.content.assignees.nodes[].login] | index("${PROJECT.login}"))
  | {number: .content.number, title: .content.title, url: .content.url, status: (.status.name // "Backlog")}
  | @json`;

interface Item { number: number; title: string; url: string; status: string }

/** Lists the project's issues assigned to the user, through the `gh` CLI and its existing login. Takes about 9 s. */
export async function fetchGithub(): Promise<Fact[]> {
  const out = await Bun.$`gh api graphql --paginate -f query=${QUERY} --jq ${JQ}`.quiet().nothrow();
  if (out.exitCode !== 0) throw new Error(`gh api graphql failed: ${out.stderr.toString().trim()}`);

  return out.stdout
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Item)
    .map((i) => ({
      id: `${PROJECT.prefix}-${i.number}`,
      source: "github",
      title: i.title,
      status: i.status,
      url: i.url,
      closed: !OPEN.has(i.status),
    }));
}
