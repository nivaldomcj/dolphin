import type { Tone } from "../define-config";

/** Card fill for a tone. The server picks the tone from the status. */
export const toneFill = (tone: Tone): string => `var(--s-${tone})`;
