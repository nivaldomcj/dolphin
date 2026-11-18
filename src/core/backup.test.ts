import { afterAll, expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { config } from "../config";
import { db } from "../db";
import { backup } from "./backup";

const dir = await mkdtemp(join(tmpdir(), "dolphin-backup-"));
const saved = config.backup;
config.backup = { dir, keep: 2 };
afterAll(async () => {
  config.backup = saved;
  await rm(dir, { recursive: true, force: true });
});

test("writes one copy a day, readable, and keeps the newest days", async () => {
  for (const table of ["edge", "placement", "task", "lane"] as const) await db.deleteFrom(table).execute();
  await db.insertInto("lane").values({ key: "A", name: "kept", bg: "", head: "", ord: 0 }).execute();
  await mkdir(join(dir, "2020-01-01"));
  await mkdir(join(dir, "notes"));

  const target = await backup({ now: new Date(2026, 10, 18) });
  expect(target).toBe(join(dir, "2026-11-18"));
  const copy = new Database(join(target!, "dolphin.db"), { readonly: true });
  expect(copy.query("SELECT name FROM lane").all()).toEqual([{ name: "kept" }]);
  copy.close();

  expect(await backup({ now: new Date(2026, 10, 18) })).toBeNull();
  expect(await backup({ now: new Date(2026, 10, 18), force: true })).toBe(target);

  await backup({ now: new Date(2026, 10, 19) });
  expect((await readdir(dir)).sort()).toEqual(["2026-11-18", "2026-11-19", "notes"]);
});
