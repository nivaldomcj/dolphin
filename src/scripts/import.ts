/**
 * One-time import of a board `data.json` snapshot into SQLite.
 * Usage: bun run import <path/to/data.json> [--force]. It replaces every lane, task, placement and edge,
 * so it refuses to run on a board that already has lanes unless --force is given.
 */
import { BoardNotEmptyError, importSnapshot, type Snapshot } from "../tools/import-snapshot";

const args = Bun.argv.slice(2);
const force = args.includes("--force");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("Usage: bun run import <path/to/data.json> [--force]");
  process.exit(1);
}

try {
  const n = await importSnapshot((await Bun.file(path).json()) as Snapshot, { force });
  console.log(`Imported ${n.lanes} lanes, ${n.tasks} tasks, ${n.placements} placements, ${n.edges} edges.`);
} catch (e) {
  if (!(e instanceof BoardNotEmptyError)) throw e;
  console.error(e.message);
  console.error("Run again with --force to do it anyway.");
  process.exit(1);
}
