/**
 * Refuses text that names your employer, clients or projects, from the `denylist` in dolphin.config.ts.
 * Usage: bun run check:private [--staged | --message <file> | --all]. Default: --all (every tracked file).
 * The git hooks run --staged before a commit and --message on the commit message.
 */
import { config } from "../config";
import { matchers, scanDiff, scanFile, scanMessage } from "../core/privacy";

const terms = config.denylist ?? [];
if (terms.length === 0) {
  console.warn("check:private: no denylist in dolphin.config.ts, nothing to check.");
  process.exit(0);
}
const ms = matchers(terms);

const git = async (...args: string[]) => {
  const out = await Bun.$`git ${args}`.quiet().nothrow();
  if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString().trim()}`);
  return out.stdout.toString();
};

const findings: string[] = [];
const args = Bun.argv.slice(2);
if (args[0] === "--message") {
  findings.push(...scanMessage(ms, await Bun.file(args[1]!).text()));
} else if (args[0] === "--staged") {
  // --no-renames: a pure rename has no "+++" line, so it is read as an added file, new name and content included.
  findings.push(...scanDiff(ms, await git("diff", "--cached", "-U0", "--no-color", "--no-renames", "--diff-filter=d")));
} else {
  for (const file of (await git("ls-files")).split("\n").filter(Boolean)) {
    const blob = Bun.file(file);
    findings.push(...scanFile(ms, file, (await blob.exists()) ? await blob.text() : null));
  }
}

if (findings.length > 0) {
  console.error(`check:private found denylisted text:\n${findings.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("check:private: clean.");
