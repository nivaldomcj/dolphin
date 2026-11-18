import { resolve } from "node:path";
import type { DolphinConfig, Tone } from "./define-config";

/** The repo root, where `dolphin.config.ts` lives. */
export const ROOT = resolve(import.meta.dir, "..");

/** `$DOLPHIN_CONFIG` (relative to the working directory), else `dolphin.config.ts` at the repo root. */
export const CONFIG_PATH = Bun.env.DOLPHIN_CONFIG ? resolve(Bun.env.DOLPHIN_CONFIG) : resolve(ROOT, "dolphin.config.ts");

const loaded: DolphinConfig = (await Bun.file(CONFIG_PATH).exists()) ? (await import(CONFIG_PATH)).default : {};

/** Demo mode (`DOLPHIN_DEMO=1`) calls no tracker and writes no backup. */
export const DEMO = Bun.env.DOLPHIN_DEMO === "1";

export const config: DolphinConfig = DEMO ? { ...loaded, linear: false, github: undefined, backup: false } : loaded;

const LINEAR_TONES: Record<string, Tone> = {
  "In Progress": "progress",
  Blocked: "blocked",
  "In Review": "done",
  Done: "done",
};

export const toneOf = (status: string): Tone => config.tones?.[status] ?? LINEAR_TONES[status] ?? "todo";
