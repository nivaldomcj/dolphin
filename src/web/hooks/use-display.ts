import { useEffect } from "preact/hooks";
import type { Theme } from "../components/settings";
import { usePref, useStringPref } from "./prefs";

/** The display settings from the 🎛️ menu, kept in localStorage. Theme and privacy are applied to the document. */
export function useDisplay() {
  const [titles, setTitles] = usePref("titles", true);
  const [positions, setPositions] = usePref("positions", true);
  const [inLane, setInLane] = usePref("inLane", false);
  const [legend, setLegend] = usePref("legend", false);
  const [privacy, setPrivacy] = usePref("privacy", false);
  const [theme, setTheme] = useStringPref("theme", "system");

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("private", privacy);
  }, [privacy]);

  return {
    theme: theme as Theme,
    onTheme: setTheme,
    titles,
    onTitles: setTitles,
    positions,
    onPositions: setPositions,
    inLane,
    onInLane: setInLane,
    legend,
    onLegend: setLegend,
    privacy,
    onPrivacy: setPrivacy,
  };
}
