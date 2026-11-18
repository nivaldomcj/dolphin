/** Card fill for a status. Unknown statuses render as `todo`. */
export type Tone = "todo" | "progress" | "blocked" | "done";

/** A GitHub Projects (v2) board owned by an organization. Dolphin reads the items assigned to `login`. */
export interface GithubProject {
  /** The organization that owns the project. */
  owner: string;
  /** The project number, from its URL: github.com/orgs/<owner>/projects/<number>. */
  number: number;
  /** Your GitHub login. Only items assigned to it are read. */
  login: string;
  /** Only issues of this repository (owner/name) are read. */
  repo: string;
  /** Task id prefix on the board: `<prefix>-<issue number>`. */
  prefix: string;
  /** Status column names that still need work. Any other status closes the task. */
  open: string[];
}

export interface DolphinConfig {
  /** Read Linear tasks. Default: true. */
  linear?: boolean;
  github?: GithubProject;
  /** Card fill per status name, on top of the Linear defaults (In Progress, Blocked, In Review, Done). */
  tones?: Record<string, Tone>;
  /** Words that must never reach a commit. `bun run check:private` and the git hooks scan for them. */
  denylist?: (string | RegExp)[];
  /** A dated database copy, at most one a day. `false` turns it off. */
  backup?: false | { dir?: string; keep?: number };
}

/** Typed identity for `dolphin.config.ts`. */
export const defineConfig = (config: DolphinConfig): DolphinConfig => config;
