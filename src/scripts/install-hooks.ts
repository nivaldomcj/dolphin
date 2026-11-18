/** Copies .githooks/* into the repo's hooks folder. `bun install` runs it through the `prepare` script. */
import { chmod, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ROOT } from "../config";

const out = await Bun.$`git rev-parse --git-path hooks`.cwd(ROOT).quiet().nothrow();
if (out.exitCode !== 0) process.exit(0); // Not a git checkout, e.g. a downloaded archive.
const hooks = resolve(ROOT, out.stdout.toString().trim());
for (const name of await readdir(join(ROOT, ".githooks"))) {
  await Bun.write(join(hooks, name), Bun.file(join(ROOT, ".githooks", name)));
  await chmod(join(hooks, name), 0o755);
}
console.log(`git hooks installed in ${hooks}`);
