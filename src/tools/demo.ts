import { db } from "../db";
import { clearBoard } from "../core/clear-board";
import { writeRules } from "../core/rules";

type Status = [status: string, closed?: boolean];
const T: Record<string, Status> = {
  todo: ["Todo"],
  doing: ["In Progress"],
  review: ["In Review"],
  blocked: ["Blocked"],
  done: ["Done", true],
  gTodo: ["Todo"],
  gDoing: ["Doing"],
  gReview: ["Review"],
};

const tasks: [id: string, title: string, s: keyof typeof T, meta?: Record<string, string>][] = [
  ["ENG-101", "Renew the push notification certificate", "done", { app: "mobile" }],
  ["ENG-108", "Ship version 2.4 to the app stores", "doing", { app: "mobile", kind: "release", note: "Store review usually takes a day." }],
  ["ENG-112", "App crashes when the camera permission is denied", "blocked", { app: "mobile" }],
  ["ENG-115", "Mobile polish umbrella", "todo", { app: "mobile", kind: "umbrella" }],
  ["ENG-120", "Sign in with a passkey", "review", { app: "auth" }],
  ["ENG-124", "Rate-limit password reset emails", "doing", { app: "auth" }],
  ["ENG-127", "Expire idle sessions after 30 days", "todo", { app: "auth" }],
  ["ENG-131", "List signed-in devices in the settings", "todo", { app: "auth" }],
  ["ENG-140", "Paginate the projects endpoint", "doing", { app: "api" }],
  ["ENG-143", "Add a request id to every error response", "todo", { app: "api" }],
  ["ENG-147", "Retire the v1 search endpoint", "todo", { app: "api" }],
  ["ENG-150", "Move CI to the larger runners", "review", { app: "platform" }],
  ["ENG-152", "Test a database restore every night", "todo", { app: "platform" }],
  ["ENG-155", "Give every pull request its own preview environment", "todo", { app: "platform" }],
  ["SITE-12", "Write the getting-started page", "gReview"],
  ["SITE-14", "Dark mode for the docs site", "gDoing"],
  ["SITE-17", "Fix broken links in the API reference", "gTodo"],
  ["SITE-19", "Add a changelog page", "gTodo"],
  ["ENG-160", "App icon looks blurry on tablets", "todo", { app: "mobile" }],
];

const lanes: [key: string, name: string, bg: string, head: string, ids: string[]][] = [
  ["A", "Mobile app", "#f1eafb", "#d4c2f2", ["ENG-101", "ENG-108", "ENG-112", "ENG-115"]],
  ["B", "Auth", "#fdeaf2", "#f5bdd4", ["ENG-120", "ENG-124", "ENG-127", "ENG-131"]],
  ["C", "API", "#fff0e2", "#f8cfa5", ["ENG-140", "ENG-143", "ENG-147"]],
  ["D", "Platform", "#e6f6ea", "#b5e2c0", ["ENG-150", "ENG-152", "ENG-155"]],
  ["X", "Docs site", "#e6f4f2", "#b4dcd6", ["SITE-12", "SITE-14", "SITE-17", "SITE-19"]],
];

const edges: [string, string][] = [
  ["ENG-108", "ENG-112"],
  ["ENG-124", "ENG-127"],
  ["ENG-140", "ENG-147"],
  ["ENG-150", "ENG-152"],
  ["ENG-108", "ENG-155"],
];

/** Replaces the board with a made-up one, for screenshots and for trying dolphin without trackers. */
export async function seedDemo(): Promise<{ lanes: number; tasks: number }> {
  await db.transaction().execute(async (trx) => {
    await clearBoard(trx);
    await trx
      .insertInto("task")
      .values(
        tasks.map(([id, title, s, meta = {}]) => {
          const [status, closed] = T[s]!;
          const github = id.startsWith("SITE-");
          const url = github ? `https://github.com/example-org/docs/issues/${id.slice(5)}` : `https://linear.app/acme/issue/${id}`;
          return {
            id,
            source: github ? ("github" as const) : ("linear" as const),
            title,
            status,
            url,
            closed: closed ? 1 : 0,
            meta: JSON.stringify(meta),
          };
        }),
      )
      .execute();
    for (const [ord, [key, name, bg, head, ids]] of lanes.entries()) {
      await trx.insertInto("lane").values({ key, name, bg, head, ord }).execute();
      await trx
        .insertInto("placement")
        .values(ids.map((task_id, pos) => ({ task_id, lane_key: key, pos })))
        .execute();
    }
    await trx
      .insertInto("edge")
      .values(edges.map(([a, b]) => ({ a, b })))
      .execute();
  });

  await writeRules({
    text: [
      "- Lane A holds every app store release, and only one release runs at a time.",
      "- A blocker comes before the task it blocks, in the same lane or earlier in time in another lane.",
      "- Started tasks come first in a lane; umbrella tasks come last.",
      "- Lane X holds the docs site issues from GitHub.",
    ].join("\n"),
    pins: [{ lane: "A", kind: "release", app: "mobile", label: "app store release" }],
  });
  return { lanes: lanes.length, tasks: tasks.length };
}
