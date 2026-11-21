/** `s` with every regex metacharacter escaped, so `new RegExp` matches it literally. */
export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
