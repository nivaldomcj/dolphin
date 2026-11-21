import { z } from "zod";
import { moveTask } from "../core/arrange";
import { readBoard } from "../core/board";
import { refresh } from "../core/refresh";
import type { makeGuard } from "./guard";
import { handleMcp } from "./mcp";

const moveBody = z
  .object({
    id: z.string().min(1),
    lane: z.string().min(1),
    at: z
      .object({ id: z.string().min(1), side: z.enum(["before", "after"]) })
      .strict()
      .optional(),
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

/** The API and MCP routes, each behind `guard`. The page itself is served by `index.ts`. */
export const apiRoutes = (guard: ReturnType<typeof makeGuard>) => ({
  "/api/board": guard(async () => Response.json(await readBoard())),
  "/api/refresh": { POST: guard(async () => Response.json({ summary: await refresh(), board: await readBoard() })) },
  "/api/move": { POST: guard(move) },
  "/mcp": guard(handleMcp),
});
