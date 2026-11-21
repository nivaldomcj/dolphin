import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHooks, MARK } from "./git-hooks";

let root: string, source: string, hooks: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "dolphin-hooks-"));
  source = join(root, "githooks");
  hooks = join(root, "hooks");
  await mkdir(source);
  await mkdir(hooks);
  await Bun.write(join(source, "pre-commit"), `#!/bin/sh\n${MARK}\necho new pre-commit\n`);
  await Bun.write(join(source, "commit-msg"), `#!/bin/sh\n${MARK}\necho new commit-msg\n`);
});
afterEach(() => rm(root, { recursive: true, force: true }));

const mode = async (path: string) => (await stat(path)).mode & 0o777;

test("installs every hook as an executable copy", async () => {
  expect(await installHooks(source, hooks)).toEqual([
    { name: "commit-msg", installed: true },
    { name: "pre-commit", installed: true },
  ]);
  expect(await Bun.file(join(hooks, "pre-commit")).text()).toContain("echo new pre-commit");
  expect(await mode(join(hooks, "pre-commit"))).toBe(0o755);
});

test("replaces an older dolphin hook", async () => {
  await Bun.write(join(hooks, "pre-commit"), `#!/bin/sh\n${MARK}\necho old\n`);

  await installHooks(source, hooks);

  expect(await Bun.file(join(hooks, "pre-commit")).text()).toContain("echo new pre-commit");
});

test("leaves someone else's hook alone and says so", async () => {
  await Bun.write(join(hooks, "pre-commit"), "#!/bin/sh\necho mine\n");

  expect(await installHooks(source, hooks)).toEqual([
    { name: "commit-msg", installed: true },
    { name: "pre-commit", installed: false },
  ]);
  expect(await Bun.file(join(hooks, "pre-commit")).text()).toBe("#!/bin/sh\necho mine\n");
});

test("the hooks shipped in .githooks all carry the mark", async () => {
  const dir = join(import.meta.dir, "../../.githooks");
  for (const name of ["pre-commit", "commit-msg"]) expect(await Bun.file(join(dir, name)).text()).toContain(MARK);
});
