/**
 * Fills a demo database with a made-up board, for screenshots and for trying dolphin without trackers.
 * Usage: bun run seed:demo, then bun run demo. It refuses to touch dolphin.db.
 */
import { basename } from "node:path";

const target = Bun.env.DOLPHIN_DB;
if (!target || basename(target) === "dolphin.db") {
  console.error("seed:demo writes only to a demo database. Run it as: bun run seed:demo");
  process.exit(1);
}

const { seedDemo } = await import("../tools/demo");
const n = await seedDemo();
console.log(`Demo board written to ${target}: ${n.lanes} lanes, ${n.tasks} tasks (ENG-160 waits in lane N).`);
