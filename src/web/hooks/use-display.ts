import { useEffect } from "preact/hooks";
import { isTheme, type Theme } from "../lib/theme";
import { usePref, useStringPref } from "./prefs";

/** The display settings from the 🎛️ menu, kept in localStorage. Theme and privacy are applied to the document. */
export function useDisplay() {
  const [titles, setTitles] = usePref("titles", true);
  const [positions, setPositions] = usePref("positions", true);
  const [inLane, setInLane] = usePref("inLane", false);
  const [legend, setLegend] = usePref("legend", false);
  const [completed, setCompleted] = usePref("completed", true);
  const [otherCycles, setOtherCycles] = usePref("otherCycles", true);
  const [privacy, setPrivacy] = usePref("privacy", false);
  const [stored, setTheme] = useStringPref("theme", "system");
  const theme: Theme = isTheme(stored) ? stored : "system";

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("private", privacy);
  }, [privacy]);

  return {
    theme,
    onTheme: setTheme,
    titles,
    onTitles: setTitles,
    positions,
    onPositions: setPositions,
    inLane,
    onInLane: setInLane,
    legend,
    onLegend: setLegend,
    completed,
    onCompleted: setCompleted,
    otherCycles,
    onOtherCycles: setOtherCycles,
    privacy,
    onPrivacy: setPrivacy,
  };
}
