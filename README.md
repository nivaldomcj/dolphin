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

Connect Claude Code to the MCP server:

```sh
claude mcp add --transport http dolphin http://127.0.0.1:4747/mcp
```

## Layout

- `src/server.ts`: `Bun.serve` routes (`/`, `/api/board`, `/mcp`).
- `src/db.ts`: SQLite schema and the board query.
- `src/mcp.ts`: MCP tools. `src/rules.ts`: the lane rules Claude reads.
- `src/import.ts`: one-time import of a `data.json` snapshot.
- `src/web/`: the Preact page.

Task facts (title, status) come from the trackers. Lanes, positions and dependencies are set by hand or by Claude.
`dolphin.db` and `data*.json` hold work data and are git-ignored.
