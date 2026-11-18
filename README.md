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

## Layout

- `src/server.ts`: `Bun.serve` routes (`/`, `/api/board`, `POST /api/refresh`, `/mcp`).
- `src/refresh.ts` and `src/sources/`: the refresh, with one fetcher per tracker.
- `src/db.ts`: SQLite schema and the board query.
- `src/mcp.ts`: MCP tools. `src/rules.ts`: the lane rules Claude reads.
- `src/import.ts`: one-time import of a `data.json` snapshot.
- `src/web/`: the Preact page.

Task facts (title, status) come from the trackers. Lanes, positions and dependencies are set by hand or by Claude.
`dolphin.db` and `data*.json` hold work data and are git-ignored.
