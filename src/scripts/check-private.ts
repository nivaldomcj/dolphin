/**
 * Refuses text that names your employer, clients or projects, from the `denylist` in dolphin.config.ts.
 * Usage: bun run check:private [--staged | --message <file> | --all]. Default: --all (every tracked file).
 * The git hooks run --staged before a commit and --message on the commit message.
 */
import { config } from "../config";

const terms = config.denylist ?? [];
if (terms.length === 0) {
  console.warn("check:private: no denylist in dolphin.config.ts, nothing to check.");
  process.exit(0);
}

// A copy without `g` or `y`: those flags make test() resume from lastIndex and skip later matches.
const matchers = terms.map((t) =>
  typeof t === "string" ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : new RegExp(t.source, t.flags.replace(/[gy]/g, "")),
);
const hit = (line: string) => matchers.find((m) => m.test(line));

const git = async (...args: string[]) => {
  const out = await Bun.$`git ${args}`.quiet().nothrow();
  if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString().trim()}`);
  return out.stdout.toString();
};

const findings: string[] = [];
const scan = (where: string, text: string) => {
  for (const [n, line] of text.split("\n").entries()) {
    const m = hit(line);
    if (m) findings.push(`${where}:${n + 1}: matches ${m}`);
  }
};

const args = Bun.argv.slice(2);
if (args[0] === "--message") {
  scan("commit message", (await Bun.file(args[1]!).text()).replace(/^#.*$/gm, ""));
} else if (args[0] === "--staged") {
  // --no-renames: a pure rename has no "+++" line, so it is read as an added file, new name and content included.
  let file = "";
  for (const line of (await git("diff", "--cached", "-U0", "--no-color", "--no-renames", "--diff-filter=d")).split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.slice(6);
      const m = hit(file);
      if (m) findings.push(`${file}: file name matches ${m}`);
    } else if (line.startsWith("+")) {
      const m = hit(line);
      if (m) findings.push(`${file}: added line matches ${m}`);
    }
  }
} else {
  for (const file of (await git("ls-files")).split("\n").filter(Boolean)) {
    const named = hit(file);
    if (named) findings.push(`${file}: file name matches ${named}`);
    const blob = Bun.file(file);
    if (!(await blob.exists())) continue;
    const text = await blob.text();
    if (!text.includes("\0")) scan(file, text);
  }
}

if (findings.length > 0) {
  console.error("check:private found denylisted text:\n" + findings.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}
console.log("check:private: clean.");
