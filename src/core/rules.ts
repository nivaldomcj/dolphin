import { db } from "../db";

/** Keeps matching open tasks in one lane. A task matches when its meta has this `kind` and its `app` contains `app`. */
export interface Pin {
  lane: string;
  kind?: string;
  app?: string;
  /** How a warning names the task, e.g. "release run". */
  label: string;
}

/** Lane rules, read by Claude before it places or reorders tasks, and the pins the arrange tools check. */
export interface Rules {
  text: string;
  pins: Pin[];
}

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.selectFrom("setting").select("value").where("key", "=", key).executeTakeFirst();
  return row ? (JSON.parse(row.value) as T) : fallback;
}

async function write(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await db.insertInto("setting").values({ key, value: json }).onConflict((oc) => oc.column("key").doUpdateSet({ value: json })).execute();
}

export async function readRules(): Promise<Rules> {
  const [text, pins] = await Promise.all([read("rules", ""), read<Pin[]>("pins", [])]);
  return { text, pins };
}

/** Replaces the parts given; a part left out stays as it is. */
export async function writeRules(next: Partial<Rules>): Promise<Rules> {
  if (next.text !== undefined) await write("rules", next.text);
  if (next.pins !== undefined) await write("pins", next.pins);
  return readRules();
}

/** An empty `kind` or `app` counts as absent, so a pin with neither matches nothing rather than every task. */
export function pinMatches(pin: Pin, kind: string | null, app: string | null): boolean {
  if (!pin.kind && !pin.app) return false;
  return (!pin.kind || kind === pin.kind) && (!pin.app || (app ?? "").toLowerCase().includes(pin.app.toLowerCase()));
}
