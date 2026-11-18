import index from "../web/index.html";
import { readBoard } from "../core/board";
import { handleMcp } from "./mcp";
import { refresh } from "../core/refresh";
import { makeGuard } from "./guard";
import { backupDaily } from "../core/backup";

const guard = makeGuard(() => server.port ?? 0);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 4747),
  development: Bun.env.NODE_ENV !== "production",
  // A refresh waits on GitHub's paged project API, which takes about 9 s.
  idleTimeout: 60,
  routes: {
    "/": index,
    "/api/board": guard(async () => Response.json(await readBoard())),
    "/api/refresh": { POST: guard(async () => Response.json({ summary: await refresh(), board: await readBoard() })) },
    "/mcp": guard(handleMcp),
  },
});

// Browsers send every *.localhost name to this machine. YouTube refuses some embeds on a bare-IP origin (the 🐬 easter egg).
console.log(`dolphin on http://dolphin.localhost:${server.port}/`);

void backupDaily();
