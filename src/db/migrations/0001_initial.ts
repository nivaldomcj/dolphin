import { type Kysely, sql } from "kysely";

/**
 * The schema dolphin had before migrations existed. `ifNotExists` lets a database created by the
 * old `CREATE TABLE IF NOT EXISTS` block adopt this migration without changes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("lane")
    .ifNotExists()
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("bg", "text", (c) => c.notNull())
    .addColumn("head", "text", (c) => c.notNull())
    .addColumn("ord", "integer", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("task")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("source", "text", (c) => c.notNull().check(sql`source IN ('linear', 'github')`))
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("closed", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("meta", "text", (c) => c.notNull().defaultTo("{}"))
    .execute();

  await db.schema
    .createTable("placement")
    .ifNotExists()
    .addColumn("task_id", "text", (c) => c.primaryKey().references("task.id").onDelete("cascade"))
    .addColumn("lane_key", "text", (c) => c.notNull().references("lane.key"))
    .addColumn("pos", "integer", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("edge")
    .ifNotExists()
    .addColumn("a", "text", (c) => c.notNull().references("task.id").onDelete("cascade"))
    .addColumn("b", "text", (c) => c.notNull().references("task.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("edge_pk", ["a", "b"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["edge", "placement", "task", "lane"]) await db.schema.dropTable(table).execute();
}
