import index from "../web/index.html";
import { readBoard } from "../core/board";
import { handleMcp } from "./mcp";
import { refresh } from "../core/refresh";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 4747),
  development: Bun.env.NODE_ENV !== "production",
  // A refresh waits on GitHub's paged project API, which takes about 9 s.
  idleTimeout: 60,
  routes: {
    "/": index,
    "/api/board": async () => Response.json(await readBoard()),
    "/api/refresh": { POST: async () => Response.json({ summary: await refresh(), board: await readBoard() }) },
    "/mcp": handleMcp,
  },
});

// Browsers send every *.localhost name to this machine. YouTube refuses some embeds on a bare-IP origin (the 🐬 easter egg).
console.log(`dolphin on http://dolphin.localhost:${server.port}/`);
