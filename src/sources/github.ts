import { config } from "../config";
import type { GithubProject } from "../define-config";
import type { Fact } from "./types";

/** Only the fields a card needs. `gh --paginate` advances the cursor only when the variable is named `$endCursor`. */
const query = (p: GithubProject) => `query($endCursor: String) {
  organization(login: ${JSON.stringify(p.owner)}) {
    projectV2(number: ${p.number}) {
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
const jq = (p: GithubProject) => `.data.organization.projectV2.items.nodes[]
  | select(.content.repository.nameWithOwner == ${JSON.stringify(p.repo)})
  | select([.content.assignees.nodes[].login] | index(${JSON.stringify(p.login)}))
  | {number: .content.number, title: .content.title, url: .content.url, status: (.status.name // "Backlog")}
  | @json`;

interface Item { number: number; title: string; url: string; status: string }

/**
 * Lists the configured project's issues assigned to the user, through the `gh` CLI and its existing login. Takes
 * about 9 s. Without a `github` block in the config it returns nothing.
 */
export async function fetchGithub(signal?: AbortSignal): Promise<Fact[]> {
  const project = config.github;
  if (!project) return [];
  const open = new Set(project.open);
  // An abort (the refresh deadline) kills the gh process.
  const gh = Bun.spawn(["gh", "api", "graphql", "--paginate", "-f", `query=${query(project)}`, "--jq", jq(project)], { stdout: "pipe", stderr: "pipe", signal });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(gh.stdout).text(), new Response(gh.stderr).text(), gh.exited]);
  signal?.throwIfAborted();
  if (exitCode !== 0) throw new Error(`gh api graphql failed: ${stderr.trim()}`);

  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Item)
    .map((i) => ({
      id: `${project.prefix}-${i.number}`,
      source: "github",
      title: i.title,
      status: i.status,
      url: i.url,
      closed: !open.has(i.status),
    }));
}
