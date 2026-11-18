import type { Migration } from "kysely/migration";
import * as m0001 from "./0001_initial";

/**
 * Every migration, in order. Add a new file as `NNNN_name.ts` and list it here; never edit one that
 * already ran, write a new one instead. Keys sort as strings, so keep the 4-digit prefix.
 */
export const migrations: Record<string, Migration> = {
  "0001_initial": m0001,
};
