import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator, NO_MIGRATIONS } from "kysely/migration";
import { bunSqlite } from "./bun-sqlite";
import { migrations } from "./migrations";

// A database of its own, so going down and up again cannot disturb the one the other tests share.
let db: Kysely<unknown>;
const open = () => {
  const raw = new Database(":memory:", { strict: true });
  raw.run("PRAGMA foreign_keys = ON");
  db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: bunSqlite(raw) }) });
  return new Migrator({ db, provider: { getMigrations: async () => migrations } });
};
afterEach(() => db.destroy());

const tables = async () => (await db.introspection.getTables()).map((t) => t.name).sort();
const columns = async (table: string) =>
  (await db.introspection.getTables()).find((t) => t.name === table)?.columns.map((c) => c.name) ?? [];

test("migrating up creates the tables and the cycle columns", async () => {
  const { error, results } = await open().migrateToLatest();

  expect(error).toBeUndefined();
  expect(results?.map((r) => [r.migrationName, r.status])).toEqual([
    ["0001_initial", "Success"],
    ["0002_settings", "Success"],
    ["0003_task_cycle", "Success"],
  ]);
  expect(await tables()).toEqual(["edge", "lane", "placement", "setting", "task"]);
  expect(await columns("task")).toContain("cycle_state");
});

test("every migration can be undone, and applied again", async () => {
  const migrator = open();
  await migrator.migrateToLatest();

  const down = await migrator.migrateTo(NO_MIGRATIONS);
  expect(down.error).toBeUndefined();
  expect(down.results?.map((r) => r.migrationName)).toEqual(["0003_task_cycle", "0002_settings", "0001_initial"]);
  expect(await tables()).toEqual([]);

  const up = await migrator.migrateToLatest();
  expect(up.error).toBeUndefined();
  expect(await tables()).toEqual(["edge", "lane", "placement", "setting", "task"]);
});

test("undoing only the cycle migration drops its columns and keeps the data", async () => {
  const migrator = open();
  await migrator.migrateToLatest();
  await (db as Kysely<{ lane: { key: string; name: string; bg: string; head: string; ord: number } }>)
    .insertInto("lane")
    .values({ key: "A", name: "kept", bg: "", head: "", ord: 0 })
    .execute();

  await migrator.migrateDown();

  expect(await columns("task")).not.toContain("cycle_state");
  expect(await columns("task")).not.toContain("cycle_number");
  expect(await (db as Kysely<{ lane: { name: string } }>).selectFrom("lane").select("name").execute()).toEqual([{ name: "kept" }]);
});
