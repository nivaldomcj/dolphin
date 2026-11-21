/** Scans text against the `denylist` in dolphin.config.ts. `bun run check:private` and the git hooks use it. */

/**
 * One matcher per term. A string is matched literally and in any case. A regex keeps its own flags, so it is
 * case-sensitive unless it carries `i`; only `g` and `y` are dropped:
 * those make test() resume from lastIndex and skip later matches.
 */
export function matchers(terms: (string | RegExp)[]): RegExp[] {
  return terms.map((t) =>
    typeof t === "string" ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : new RegExp(t.source, t.flags.replace(/[gy]/g, "")),
  );
}

const hit = (patterns: RegExp[], line: string) => patterns.find((m) => m.test(line));

/** One finding per line of `text` that matches, as `<where>:<line number>: matches <regex>`. */
export function scanText(patterns: RegExp[], where: string, text: string): string[] {
  const findings: string[] = [];
  for (const [n, line] of text.split("\n").entries()) {
    const m = hit(patterns, line);
    if (m) findings.push(`${where}:${n + 1}: matches ${m}`);
  }
  return findings;
}

/** A commit message, without the `#` comment lines git adds to the editor. */
export function scanMessage(patterns: RegExp[], text: string): string[] {
  return scanText(patterns, "commit message", text.replace(/^#.*$/gm, ""));
}

/** A file's name and, unless it is binary (holds a NUL), its content. */
export function scanFile(patterns: RegExp[], file: string, text: string | null): string[] {
  const named = hit(patterns, file);
  const findings = named ? [`${file}: file name matches ${named}`] : [];
  if (text !== null && !text.includes("\0")) findings.push(...scanText(patterns, file, text));
  return findings;
}

/**
 * The added lines and new file names of a `git diff -U0 --no-renames` output. Removed and context lines are not
 * scanned: taking a name out of the code must not be refused.
 */
export function scanDiff(patterns: RegExp[], diff: string): string[] {
  const findings: string[] = [];
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.slice(6);
      const m = hit(patterns, file);
      if (m) findings.push(`${file}: file name matches ${m}`);
    } else if (line.startsWith("+")) {
      const m = hit(patterns, line);
      if (m) findings.push(`${file}: added line matches ${m}`);
    }
  }
  return findings;
}
