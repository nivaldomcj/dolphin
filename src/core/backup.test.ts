import { afterAll, expect, spyOn, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { useConfig, withConfig } from "../../test/config";
import { laneRow, resetDb } from "../../test/db";
import { db } from "../db";
import { backup, backupDaily } from "./backup";

const dir = await mkdtemp(join(tmpdir(), "dolphin-backup-"));
useConfig({ backup: { dir, keep: 2 } });
afterAll(() => rm(dir, { recursive: true, force: true }));

test("writes one copy a day, readable, and keeps the newest days", async () => {
  await resetDb();
  await db
    .insertInto("lane")
    .values(laneRow("A", 0, { name: "kept" }))
    .execute();
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

test("the daily backup logs the folder it wrote", async () => {
  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    const before = new Set(await readdir(dir));
    await backupDaily();

    // The folder it wrote is the one that was not there before; its name is today's date, whatever it is.
    const written = (await readdir(dir)).filter((d) => !before.has(d));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await Bun.file(join(dir, written[0]!, "dolphin.db")).exists()).toBe(true);
    expect(log).toHaveBeenCalledWith(`backup written to ${join(dir, written[0]!)}`);
  } finally {
    log.mockRestore();
  }
});

test("the daily backup never throws: a failure is logged instead", async () => {
  const blocker = join(dir, "not-a-dir");
  await Bun.write(blocker, "a file where the backup folder should be");
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    await withConfig({ backup: { dir: blocker, keep: 2 } }, backupDaily);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toStartWith("backup failed: ");
  } finally {
    error.mockRestore();
  }
});
