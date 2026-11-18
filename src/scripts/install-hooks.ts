/** Copies .githooks/* into the repo's hooks folder. `bun install` runs it through the `prepare` script. */
import { chmod, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ROOT } from "../config";

const out = await Bun.$`git rev-parse --git-path hooks`.cwd(ROOT).quiet().nothrow();
if (out.exitCode !== 0) process.exit(0); // Not a git checkout, e.g. a downloaded archive.
const hooks = resolve(ROOT, out.stdout.toString().trim());
/** Every file in .githooks carries this line, so the installer knows which hooks it may replace. */
const MARK = "# dolphin hook";

for (const name of await readdir(join(ROOT, ".githooks"))) {
  const target = Bun.file(join(hooks, name));
  if ((await target.exists()) && !(await target.text()).includes(MARK)) {
    console.warn(`git hook ${name} exists and is not dolphin's; left as it is. Add a call to .githooks/${name} to it by hand.`);
    continue;
  }
  await Bun.write(join(hooks, name), await Bun.file(join(ROOT, ".githooks", name)).text());
  await chmod(join(hooks, name), 0o755);
  console.log(`git hook ${name} installed in ${hooks}`);
}
