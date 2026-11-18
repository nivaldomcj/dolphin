import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator } from "kysely/migration";
import { bunSqlite } from "./bun-sqlite";
import { migrations } from "./migrations";
import type { DB } from "./schema";

const raw = new Database(Bun.env.DOLPHIN_DB ?? "dolphin.db", { create: true, strict: true });
raw.run("PRAGMA journal_mode = WAL");
raw.run("PRAGMA foreign_keys = ON");

export const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: bunSqlite(raw) }) });

/** Applies every pending migration. Runs once when this module loads, so callers always see the latest schema. */
async function migrate(): Promise<void> {
  const { error, results } = await new Migrator({ db, provider: { getMigrations: async () => migrations } }).migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === "Success") console.log(`migration ${r.migrationName} applied`);
    if (r.status === "Error") console.error(`migration ${r.migrationName} failed`);
  }
  if (error) throw error;
}

await migrate();
