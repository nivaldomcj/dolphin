# dolphin

A local companion page that splits my open tasks (Linear, GitHub Projects) into parallel lanes.
Claude arranges the lanes through an MCP server; the page shows them.

## Run

Needs Bun 1.4.4 or later: `bun run typecheck` calls `bun check`, which older Bun versions do not have.

```sh
bun install
bun run import path/to/data.json   # once: load a board snapshot into dolphin.db
bun run dev                        # http://127.0.0.1:4747
```

## Refresh

The 🔄 Refresh button (and the MCP `refresh` tool) pulls task statuses from Linear and from the UNI GitHub
project. It writes titles and statuses only: lanes, positions and dependencies stay as they are. Open tasks the
board does not know show in lane N. A refresh takes about 9 s, most of it waiting on GitHub.

- Linear reads a personal API key from `$LINEAR_API_KEY`, else from the macOS Keychain. Store it once:
  `security add-generic-password -s dolphin-linear-api-key -a "$USER" -w`
- GitHub uses the `gh` CLI and its existing login. The project is set in `src/sources/github.ts`.

If one source fails, the other still applies, and the page shows the error next to the button.

## MCP

Connect Claude Code to the MCP server:

```sh
claude mcp add --transport http dolphin http://127.0.0.1:4747/mcp
```

Tools:

- `get_board`: the rules, the lanes in order, the edges and the current rule warnings. Read it before arranging.
- `refresh`: the same pull as the 🔄 button.
- `place_task` (id, lane, 1-based position), `reorder_lane` (lane, full id list), `unplace_task` (back to lane N).
- `add_edge` and `remove_edge` (blocker, blocked). A loop is rejected.
- `rename_lane` and `set_note`.

Every write returns what it did and the rule warnings for the whole board: a blocker after the task it blocks,
a cross-lane blocker that is not earlier, and a release outside lane A. Warnings never block a write.
The rules live in `src/rules.ts`.

## Test

```sh
bun test   # runs on an in-memory database (test-setup.ts), never on dolphin.db
```

## Database

dolphin uses [Kysely](https://kysely.dev) on `bun:sqlite`. Migrations run when the server starts.

To change the schema:

1. Add `src/db/migrations/NNNN_name.ts` with `up` (and `down`), using `db.schema`.
2. List it in `src/db/migrations/index.ts`.
3. Update the row types in `src/db/schema.ts`.

Never edit a migration that already ran on your `dolphin.db`; write a new one.

## Layout

- `src/server.ts`: `Bun.serve` routes (`/`, `/api/board`, `POST /api/refresh`, `/mcp`).
- `src/refresh.ts` and `src/sources/`: the refresh, with one fetcher per tracker.
- `src/db/`: Kysely over `bun:sqlite` (`bun-sqlite.ts` adapts it to Kysely's SqliteDialect), the row types in `schema.ts`, and `migrations/`.
- `src/board.ts`: the board query.
- `src/mcp.ts`: MCP tools. `src/arrange.ts`: the writes behind them and the rule checks. `src/rules.ts`: the lane rules.
- `src/import.ts`: one-time import of a `data.json` snapshot.
- `src/web/`: the Preact page.

Task facts (title, status) come from the trackers. Lanes, positions and dependencies are set by hand or by Claude.
`dolphin.db` and `data*.json` hold work data and are git-ignored.
