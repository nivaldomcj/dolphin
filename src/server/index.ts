import index from "../web/index.html";
import { z } from "zod";
import { moveTask } from "../core/arrange";
import { readBoard } from "../core/board";
import { handleMcp } from "./mcp";
import { refresh } from "../core/refresh";
import { makeGuard } from "./guard";
import { backupDaily } from "../core/backup";

const guard = makeGuard(() => server.port ?? 0);

const moveBody = z
  .object({
    id: z.string().min(1),
    lane: z.string().min(1),
    at: z.object({ id: z.string().min(1), side: z.enum(["before", "after"]) }).strict().optional(),
  })
  .strict();

/** The page's drag and drop. The reply always carries the board, so a failed move still shows the real one. */
async function move(req: Request): Promise<Response> {
  try {
    const body = moveBody.parse(await req.json());
    const result = await moveTask(body.id, body.lane, body.at);
    return Response.json({ result, board: await readBoard() });
  } catch (e) {
    const error = e instanceof z.ZodError ? "Bad move request." : e instanceof Error ? e.message : String(e);
    return Response.json({ error, board: await readBoard() }, { status: 400 });
  }
}

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
    "/api/move": { POST: guard(move) },
    "/mcp": guard(handleMcp),
  },
});

// Browsers send every *.localhost name to this machine. YouTube refuses some embeds on a bare-IP origin (the 🐬 easter egg).
console.log(`dolphin on http://dolphin.localhost:${server.port}/`);

void backupDaily();
