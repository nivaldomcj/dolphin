import index from "./web/index.html";
import { readBoard } from "./db";
import { handleMcp } from "./mcp";
import { refresh } from "./refresh";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 4747),
  development: Bun.env.NODE_ENV !== "production",
  // A refresh waits on GitHub's paged project API, which takes about 9 s.
  idleTimeout: 60,
  routes: {
    "/": index,
    "/api/board": () => Response.json(readBoard()),
    "/api/refresh": { POST: async () => Response.json({ summary: await refresh(), board: readBoard() }) },
    "/mcp": handleMcp,
  },
});

console.log(`dolphin on ${server.url}`);
