import index from "../web/index.html";
import { makeGuard } from "./guard";
import { apiRoutes } from "./routes";
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
    ...apiRoutes(guard),
  },
});

// Browsers send every *.localhost name to this machine. YouTube refuses some embeds on a bare-IP origin (the 🐬 easter egg).
console.log(`dolphin on http://dolphin.localhost:${server.port}/`);

void backupDaily();
