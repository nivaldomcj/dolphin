import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "kysely";
import { CONFIG_PATH, config } from "../config";
import { db } from "../db";

const DEFAULT_DIR = `${Bun.env.HOME}/Library/Mobile Documents/com~apple~CloudDocs/dolphin`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Copies the database (and `dolphin.config.ts`, when present) into `<dir>/<YYYY-MM-DD>/`, then keeps only the newest
 * `keep` days. Returns the folder written, or null when backups are off or today's copy exists and `force` is not set.
 */
export async function backup({ now = new Date(), force = false } = {}): Promise<string | null> {
  if (config.backup === false) return null;
  const dir = config.backup?.dir ?? DEFAULT_DIR;
  const keep = config.backup?.keep ?? 14;
  const target = join(dir, localDay(now));
  const file = join(target, "dolphin.db");
  if (!force && (await Bun.file(file).exists())) return null;

  await mkdir(target, { recursive: true });
  await rm(file, { force: true });
  // VACUUM INTO writes a consistent copy while the server keeps the database open; it refuses an existing file.
  await sql`VACUUM INTO ${file}`.execute(db);
  if (await Bun.file(CONFIG_PATH).exists()) await Bun.write(join(target, "dolphin.config.ts"), Bun.file(CONFIG_PATH));

  const days = (await readdir(dir)).filter((d) => DAY.test(d)).sort();
  for (const old of days.slice(0, Math.max(days.length - keep, 0))) await rm(join(dir, old), { recursive: true, force: true });
  return target;
}

/** The daily copy for the server: never throws, so a full or missing iCloud Drive cannot break a refresh. */
export async function backupDaily(): Promise<void> {
  try {
    const target = await backup();
    if (target) console.log(`backup written to ${target}`);
  } catch (e) {
    console.error(`backup failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
