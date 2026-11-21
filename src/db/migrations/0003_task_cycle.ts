import type { Kysely } from "kysely";

/** The tracker's cycle of each task: its number and where it sits against today. Null when the task has no cycle. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("task").addColumn("cycle_number", "integer").execute();
  await db.schema.alterTable("task").addColumn("cycle_state", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("task").dropColumn("cycle_state").execute();
  await db.schema.alterTable("task").dropColumn("cycle_number").execute();
}
