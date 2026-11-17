import { useState } from "preact/hooks";

/** A boolean toggle remembered in localStorage. Storage can be blocked, so every access is guarded. */
export function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`dolphin.${key}`);
      return stored === null ? initial : stored === "1";
    } catch {
      return initial;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(`dolphin.${key}`, v ? "1" : "0");
    } catch {}
  };
  return [value, set];
}
