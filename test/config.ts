import { afterAll, beforeAll } from "bun:test";
import { config } from "../src/config";
import type { DolphinConfig } from "../src/define-config";

/** No tracker and no backup: a refresh then reaches neither the network nor the backup folder. */
export const OFFLINE: Partial<DolphinConfig> = { linear: false, github: undefined, backup: false };

/** Replaces parts of the loaded config and returns a function that puts the old values back. */
function override(over: Partial<DolphinConfig>): () => void {
  const saved = Object.fromEntries((Object.keys(over) as (keyof DolphinConfig)[]).map((k) => [k, config[k]]));
  Object.assign(config, over);
  return () => Object.assign(config, saved);
}

/** Runs `fn` with parts of the loaded config replaced, and puts the old values back afterwards, even on failure. */
export async function withConfig<T>(over: Partial<DolphinConfig>, fn: () => T | Promise<T>): Promise<T> {
  const restore = override(over);
  try {
    return await fn();
  } finally {
    restore();
  }
}

/** Replaces parts of the config for every test in the file, and puts the old values back after the last one. */
export function useConfig(over: Partial<DolphinConfig>): void {
  let restore = () => {};
  beforeAll(() => {
    restore = override(over);
  });
  afterAll(() => restore());
}
