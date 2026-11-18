# 🐬 dolphin

A local companion page that splits my open tasks (Linear, GitHub Projects) into parallel lanes, so I can work on
several tasks at the same time. Claude arranges the lanes through an MCP server; the page shows them.

![dolphin with the settings menu open, privacy mode on and the legend bar shown](docs/screenshot.png)

_Privacy mode is on in the screenshot: titles and lane names are hidden._

## Run

Needs Bun 1.4.4 or later: `bun run typecheck` calls `bun check`, which older Bun versions do not have.

```sh
bun install
bun run dev                        # http://localhost:4747
```

Open the page as `localhost`, not `127.0.0.1`: YouTube refuses some embeds on a bare-IP address.

`bun run import path/to/data.json` loads a board snapshot once. It replaces the whole board, so do not run it on a
board you have arranged since.

## Stack and decisions

| Part | Choice | Why |
|---|---|---|
| Runtime | [Bun](https://bun.sh) and TypeScript | One tool for the server, SQLite, bundling, type checking and tests. No Node, no Vite. |
| Scope | Local only, one user, no auth, no hosting | A companion page next to my editor. Keep it simple. |
| Server | `Bun.serve` routes | Four routes do not need Hono or Elysia. |
| Page | [Preact](https://preactjs.com) 11 in TSX | Small, with a familiar React-like model to grow into. Bun's HTML import bundles the TSX, so no `htm` and no build step. |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) and [DaisyUI 5](https://daisyui.com) | DaisyUI is CSS-only, so it works with Preact. shadcn needs React and Radix. Pico was the no-build option, with fewer components. |
| Database | SQLite through `bun:sqlite`, with [Kysely](https://kysely.dev) 0.29 | Typed queries and migrations, and a chance to learn Kysely. Drizzle (heavier) and hand-rolled `user_version` migrations were the other options. |
| MCP | `@modelcontextprotocol/sdk` over HTTP, on `/mcp` in the same process | The page and Claude share one process and one database. A stdio server would be a second process the page cannot hear. |
| Sync | A 🔁 button, on demand | I am the only one who moves my tasks, so polling and webhooks add nothing. |
| Dependencies | Set by hand or by Claude, never copied from Linear relations | Tracker relations across lanes read as noise. Someone has to decide which links matter. |
| Linear | GraphQL through `fetch`, key in the macOS Keychain | No SDK and no `.env` file. |
| GitHub | `gh api graphql` | Reuses the `gh` login, so no token to store. |
| Lane rules | One string in `src/rules.ts` | Lanes are renamed every cycle. A rule engine would be overkill. |

## Page

The header has 3 buttons:

- 🔁 refreshes statuses from the trackers. A toast at the bottom left shows progress, then the changes.
- 🔍 opens the search box (also ⌘F). Enter and Shift+Enter step through the matches; Esc clears.
- 🎛️ opens the settings: theme `[💻|☀️|🌙]`, then `[🟢|🔴]` for titles, positions, in-lane blockers and legend, and privacy `[🙈|🙉]`.

The legend shows as a bar at the bottom. Privacy mode replaces task titles and lane names with solid bars and
hides the hover card, so a screenshot shows only task ids, statuses and the layout. It does not blur: blurred
text keeps the glyph shapes and can sometimes be recovered. Settings are kept in `localStorage`.

## Refresh

The 🔁 button (and the MCP `refresh` tool) pulls task statuses from Linear and from the UNI GitHub project. It
writes titles and statuses only: lanes, positions and dependencies stay as they are. Open tasks the board does not
know show in lane N. A refresh takes about 9 s, most of it waiting on GitHub.

- Linear reads a personal API key from `$LINEAR_API_KEY`, else from the macOS Keychain. Store it once:
  `security add-generic-password -s dolphin-linear-api-key -a "$USER" -w`
- GitHub uses the `gh` CLI and its existing login. The project is set in `src/sources/github.ts`.

If one source fails, the other still applies, and the toast shows the error.

## MCP

Connect Claude Code to the MCP server:

```sh
claude mcp add --transport http dolphin http://127.0.0.1:4747/mcp
```

Tools:

- `get_board`: the rules, the lanes in order, the edges and the current rule warnings. Read it before arranging.
- `refresh`: the same pull as the 🔁 button.
- `place_task` (id, lane, 1-based position), `reorder_lane` (lane, full id list), `unplace_task` (back to lane N).
- `add_edge` and `remove_edge` (blocker, blocked). A loop is rejected.
- `rename_lane` and `set_note`.

Every write returns what it did and the rule warnings for the whole board: a blocker after the task it blocks,
a cross-lane blocker that is not earlier, and a release outside lane A. Warnings never block a write.

## Database

Kysely runs on `bun:sqlite` through Kysely's built-in `SqliteDialect`. `src/db/bun-sqlite.ts` adapts the two
differences: Kysely passes parameters as one array and reads a `reader` flag. The community `kysely-bun-sqlite`
dialect pins Kysely 0.28, so it is not used. Migrations run when the server starts.

To change the schema:

1. Add `src/db/migrations/NNNN_name.ts` with `up` (and `down`), using `db.schema`.
2. List it in `src/db/migrations/index.ts`.
3. Update the row types in `src/db/schema.ts`.

Never edit a migration that already ran on your `dolphin.db`; write a new one. In Kysely 0.29, `Migrator` and
`Migration` come from `kysely/migration`.

## Styling

`bun-plugin-tailwind` (in `bunfig.toml`) builds the CSS for the HTML import. `src/web/app.css` loads Tailwind and
DaisyUI, then `board.css`, the board's own look: lanes, cards and arrows. DaisyUI covers the controls (`btn`, `join`,
`dropdown`, `input`, `toast`, `alert`, `loading`).

- The theme setting sets `data-theme` on `<html>`. DaisyUI and `board.css` both read it.
- Do not name a CSS variable after one DaisyUI uses, such as `--border` or `--size`: the controls break.
- `bun --hot` does not rebuild the CSS when only `board.css` changes. Restart the server.

## Test

```sh
bun test   # runs on an in-memory database (test-setup.ts), never on dolphin.db
```

## Layout

- `src/server.ts`: `Bun.serve` routes (`/`, `/api/board`, `POST /api/refresh`, `/mcp`).
- `src/refresh.ts` and `src/sources/`: the refresh, with one fetcher per tracker.
- `src/db/`: the Kysely setup, the `bun:sqlite` adapter, the row types and `migrations/`.
- `src/board.ts`: the board query.
- `src/mcp.ts`: MCP tools. `src/arrange.ts`: the writes behind them and the rule checks. `src/rules.ts`: the lane rules.
- `src/import.ts`: one-time import of a `data.json` snapshot.
- `src/web/`: the Preact page. `app.css` is the CSS entry; `board.css` holds the board styles.

Task facts (title, status) come from the trackers. Lanes, positions and dependencies are set by hand or by Claude.
`dolphin.db` and `data*.json` hold work data and are git-ignored.
