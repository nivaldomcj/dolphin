import { describe, expect, test } from "bun:test";
import { matchers, scanDiff, scanFile, scanMessage, scanText } from "./privacy";

describe("matchers", () => {
  test("a string term matches literally and in any case", () => {
    const [m] = matchers(["acme.corp (eu)"]);
    expect(m!.test("Shipped for ACME.CORP (EU) today")).toBe(true);
    // The dot is literal, not "any character".
    expect(m!.test("acmeXcorp (eu)")).toBe(false);
  });

  test("a regex keeps its own flags but loses g and y", () => {
    const [m] = matchers([/\bSECRET-\d+/gy]);
    expect(m!.flags).toBe("");
    // With `g` kept, the second test() would start from lastIndex and miss.
    expect(m!.test("SECRET-1")).toBe(true);
    expect(m!.test("SECRET-2")).toBe(true);
  });
});

const patterns = matchers(["acme", /\bSECRET-\d+/g]);

test("scanText reports every matching line with its number and the term", () => {
  expect(scanText(patterns, "notes.md", "fine\nworks at Acme\nok\nsee SECRET-12 and SECRET-13")).toEqual([
    "notes.md:2: matches /acme/i",
    "notes.md:4: matches /\\bSECRET-\\d+/",
  ]);
});

test("clean text gives no findings", () => {
  expect(scanText(patterns, "a.ts", "nothing to see\n")).toEqual([]);
});

test("a commit message is scanned without git's # comment lines", () => {
  expect(scanMessage(patterns, "fix: the board\n# On branch acme-work\n")).toEqual([]);
  expect(scanMessage(patterns, "fix: acme board\n")).toEqual(["commit message:1: matches /acme/i"]);
});

describe("scanFile", () => {
  test("reports a matching file name and matching lines", () => {
    expect(scanFile(patterns, "docs/acme.md", "hello\nSECRET-1")).toEqual([
      "docs/acme.md: file name matches /acme/i",
      "docs/acme.md:2: matches /\\bSECRET-\\d+/",
    ]);
  });

  test("a binary file is checked by name only", () => {
    expect(scanFile(patterns, "logo.png", "\0acme")).toEqual([]);
  });

  test("a tracked file deleted from disk is checked by name only", () => {
    expect(scanFile(patterns, "acme.txt", null)).toEqual(["acme.txt: file name matches /acme/i"]);
  });
});

describe("scanDiff", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1 +1 @@",
    "-const client = 'acme';",
    "+const client = 'someone';",
    "diff --git a/notes/acme.md b/notes/acme.md",
    "--- /dev/null",
    "+++ b/notes/acme.md",
    "@@ -0,0 +1 @@",
    "+ticket SECRET-9",
  ].join("\n");

  test("reports added lines and new file names, not removed lines", () => {
    expect(scanDiff(patterns, diff)).toEqual([
      "notes/acme.md: file name matches /acme/i",
      "notes/acme.md: added line matches /\\bSECRET-\\d+/",
    ]);
  });

  test("an empty diff is clean", () => {
    expect(scanDiff(patterns, "")).toEqual([]);
  });
});
