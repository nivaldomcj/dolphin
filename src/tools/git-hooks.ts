import { chmod, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Every file in .githooks carries this line, so the installer knows which hooks it may replace. */
export const MARK = "# dolphin hook";

/** What happened to one hook: written, or left alone because someone else's hook is there. */
export interface HookResult {
  name: string;
  installed: boolean;
}

/** Copies every hook in `sourceDir` into `hooksDir` as an executable, unless a hook there lacks `MARK`. */
export async function installHooks(sourceDir: string, hooksDir: string): Promise<HookResult[]> {
  const results: HookResult[] = [];
  for (const name of (await readdir(sourceDir)).sort()) {
    const target = Bun.file(join(hooksDir, name));
    if ((await target.exists()) && !(await target.text()).includes(MARK)) {
      results.push({ name, installed: false });
      continue;
    }
    await Bun.write(join(hooksDir, name), await Bun.file(join(sourceDir, name)).text());
    await chmod(join(hooksDir, name), 0o755);
    results.push({ name, installed: true });
  }
  return results;
}
