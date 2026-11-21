/** The themes, in menu order, with the label and tooltip the settings menu shows for each. */
export const THEMES = [
  { value: "system", label: "💻", title: "Theme: system" },
  { value: "light", label: "☀️", title: "Theme: light" },
  { value: "dark", label: "🌙", title: "Theme: dark" },
] as const;
export type Theme = (typeof THEMES)[number]["value"];

/** True for a stored value that names a theme; anything else (stale or hand-edited) falls back to system. */
export const isTheme = (v: string): v is Theme => THEMES.some((t) => t.value === v);
