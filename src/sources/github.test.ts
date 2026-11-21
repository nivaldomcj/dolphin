import { afterAll, expect, test } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withConfig } from "../../test/config";
import type { GithubProject } from "../define-config";
import { fetchGithub, toFacts } from "./github";

const project: GithubProject = { owner: "org", number: 1, login: "me", repo: "org/docs", prefix: "SITE", open: ["Todo", "Doing"] };

const dir = await mkdtemp(join(tmpdir(), "dolphin-gh-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

/** A stand-in for the `gh` CLI: a shell script that runs `body`. */
async function fakeGh(name: string, body: string): Promise<string> {
  const path = join(dir, name);
  await Bun.write(path, `#!/bin/sh\n${body}\n`);
  await chmod(path, 0o755);
  return path;
}

test("each JSON line becomes a fact with the prefixed id, and a status outside `open` closes it", () => {
  const stdout = [
    JSON.stringify({ number: 12, title: "Docs page", url: "https://github.com/org/docs/issues/12", status: "Doing" }),
    JSON.stringify({ number: 14, title: "Shipped one", url: "https://github.com/org/docs/issues/14", status: "Shipped" }),
    "",
  ].join("\n");

  expect(toFacts(stdout, project)).toEqual([
    { id: "SITE-12", source: "github", title: "Docs page", status: "Doing", url: "https://github.com/org/docs/issues/12", closed: false },
    {
      id: "SITE-14",
      source: "github",
      title: "Shipped one",
      status: "Shipped",
      url: "https://github.com/org/docs/issues/14",
      closed: true,
    },
  ]);
});

test("empty output means no facts", () => {
  expect(toFacts("", project)).toEqual([]);
});

test("without a github block it reads nothing and runs no gh", async () => {
  const gh = await fakeGh("never", "exit 7");

  await withConfig({ github: undefined }, async () => {
    expect(await fetchGithub(undefined, gh)).toEqual([]);
  });
});

test("reads the facts gh prints", async () => {
  const gh = await fakeGh("ok", `echo '{"number":3,"title":"T","url":"https://github.com/org/docs/issues/3","status":"Todo"}'`);

  await withConfig({ github: project }, async () => {
    expect(await fetchGithub(undefined, gh)).toEqual([
      { id: "SITE-3", source: "github", title: "T", status: "Todo", url: "https://github.com/org/docs/issues/3", closed: false },
    ]);
  });
});

test("a gh failure throws with gh's own message", async () => {
  const gh = await fakeGh("fails", "echo 'HTTP 401: Bad credentials' >&2; exit 1");

  await withConfig({ github: project }, async () => {
    await expect(fetchGithub(undefined, gh)).rejects.toThrow("gh api graphql failed: HTTP 401: Bad credentials");
  });
});

test("an aborted refresh throws instead of returning partial output", async () => {
  const gh = await fakeGh("slow", "sleep 5");
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("deadline")), 50);

  await withConfig({ github: project }, async () => {
    await expect(fetchGithub(controller.signal, gh)).rejects.toThrow("deadline");
  });
});
