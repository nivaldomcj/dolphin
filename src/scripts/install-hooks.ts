/** Copies .githooks/* into the repo's hooks folder. `bun install` runs it through the `prepare` script. */
import { join, resolve } from "node:path";
import { ROOT } from "../config";
import { installHooks } from "../tools/git-hooks";

const out = await Bun.$`git rev-parse --git-path hooks`.cwd(ROOT).quiet().nothrow();
if (out.exitCode !== 0) process.exit(0); // Not a git checkout, e.g. a downloaded archive.
const hooks = resolve(ROOT, out.stdout.toString().trim());

for (const { name, installed } of await installHooks(join(ROOT, ".githooks"), hooks)) {
  if (installed) console.log(`git hook ${name} installed in ${hooks}`);
  else console.warn(`git hook ${name} exists and is not dolphin's; left as it is. Add a call to .githooks/${name} to it by hand.`);
}
