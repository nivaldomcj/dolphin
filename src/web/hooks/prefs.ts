import { useState } from "preact/hooks";

/** A value remembered in localStorage. Storage can be blocked, so every access is guarded. */
function usePersisted<T extends string | boolean>(key: string, initial: T, encode: (v: T) => string, decode: (s: string) => T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`dolphin.${key}`);
      return stored === null ? initial : decode(stored);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(`dolphin.${key}`, encode(v));
    } catch {}
  };
  return [value, set];
}

export function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  return usePersisted(key, initial, (v) => (v ? "1" : "0"), (s) => s === "1");
}

export function useStringPref(key: string, initial: string): [string, (v: string) => void] {
  return usePersisted(key, initial, (v) => v, (s) => s);
}
