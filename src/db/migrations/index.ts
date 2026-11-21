import type { Migration } from "kysely/migration";
import * as m0001 from "./0001_initial";
import * as m0002 from "./0002_settings";
import * as m0003 from "./0003_task_cycle";

/**
 * Every migration, in order. Add a new file as `NNNN_name.ts` and list it here; never edit one that
 * already ran, write a new one instead. Keys sort as strings, so keep the 4-digit prefix.
 */
export const migrations: Record<string, Migration> = {
  "0001_initial": m0001,
  "0002_settings": m0002,
  "0003_task_cycle": m0003,
};
