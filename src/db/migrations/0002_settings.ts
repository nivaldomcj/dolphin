import type { Kysely } from "kysely";

/** Key-value settings, JSON values. Seeds the lane rules that used to live in the code, in their generic form. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("setting")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();

  const text = [
    "- A blocker comes before the task it blocks, in the same lane or earlier in time in another lane.",
    "- Started tasks come first in a lane; umbrella tasks come last.",
  ].join("\n");
  await (db as Kysely<{ setting: { key: string; value: string } }>)
    .insertInto("setting")
    .values([
      { key: "rules", value: JSON.stringify(text) },
      { key: "pins", value: "[]" },
    ])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("setting").execute();
}
