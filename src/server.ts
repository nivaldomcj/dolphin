import index from "./web/index.html";
import { readBoard } from "./db";
import { handleMcp } from "./mcp";

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(Bun.env.PORT ?? 4747),
  development: Bun.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/board": () => Response.json(readBoard()),
    "/mcp": handleMcp,
  },
});

console.log(`dolphin on ${server.url}`);
