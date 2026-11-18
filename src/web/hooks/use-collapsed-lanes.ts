import { useMemo } from "preact/hooks";
import { useStringPref } from "./prefs";

/** Collapsed lane keys, kept in localStorage as "A,X". `key` changes whenever the set does. */
export function useCollapsedLanes() {
  const [stored, setStored] = useStringPref("collapsed", "");
  const collapsed = useMemo(() => new Set(stored.split(",").filter(Boolean)), [stored]);

  const setCollapsed = (lane: string, value: boolean) => {
    const next = new Set(collapsed);
    if (value) next.add(lane);
    else next.delete(lane);
    setStored([...next].join(","));
  };

  return { collapsed, key: stored, setCollapsed, toggle: (lane: string) => setCollapsed(lane, !collapsed.has(lane)) };
}
