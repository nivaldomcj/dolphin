import { render } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Board } from "../types";
import { Arrows } from "./arrows";
import { Title } from "./easter-egg";
import { Lane, type Mark } from "./lane";
import { Legend } from "./legend";
import { usePref, useStringPref } from "./prefs";
import { RefreshButton } from "./refresh-button";
import { Search } from "./search";
import { Settings, type Theme } from "./settings";
import { Tip } from "./tip";

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = usePref("titles", true);
  const [positions, setPositions] = usePref("positions", true);
  const [inLane, setInLane] = usePref("inLane", false);
  /** Collapsed lane keys, stored as "A,X". */
  const [collapsedPref, setCollapsedPref] = useStringPref("collapsed", "");
  const collapsed = useMemo(() => new Set(collapsedPref.split(",").filter(Boolean)), [collapsedPref]);
  const setLane = (key: string, isCollapsed: boolean) => {
    const next = new Set(collapsed);
    if (isCollapsed) next.add(key);
    else next.delete(key);
    setCollapsedPref([...next].join(","));
  };
  const [legend, setLegend] = usePref("legend", false);
  const [privacy, setPrivacy] = usePref("privacy", false);
  const [theme, setTheme] = useStringPref("theme", "system");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hitIndex, setHitIndex] = useState(0);
  const [focus, setFocus] = useState<{ id: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("private", privacy);
  }, [privacy]);

  useEffect(() => {
    fetch("/api/board")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBoard, (e: Error) => setError(e.message));
  }, []);

  const { laneOf, up, down } = useMemo(() => {
    const laneOf = new Map<string, string>(), up = new Map<string, string[]>(), down = new Map<string, string[]>();
    for (const lane of board?.lanes ?? []) for (const id of lane.ids) laneOf.set(id, lane.key);
    for (const [a, b] of board?.edges ?? []) {
      down.set(a, [...(down.get(a) ?? []), b]);
      up.set(b, [...(up.get(b) ?? []), a]);
    }
    return { laneOf, up, down };
  }, [board]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !board) return null;
    const match = (s?: string | null) => (s ?? "").toLowerCase().includes(q);
    return new Set(Object.values(board.tasks).filter((t) => match(t.id) || match(t.title) || match(t.short) || match(t.app)).map((t) => t.id));
  }, [query, board]);

  /** Matches in board order, so Enter walks lane by lane, left to right. */
  const hitList = useMemo(() => (hits && board ? board.lanes.flatMap((l) => l.ids).filter((id) => hits.has(id)) : []), [hits, board]);

  useEffect(() => setHitIndex(0), [hits]);

  useEffect(() => {
    const id = hitList[hitIndex];
    const key = id && laneOf.get(id);
    // A match in a collapsed lane would be invisible, so expand that lane first; this effect runs again after.
    if (key && collapsed.has(key)) return setLane(key, false);
    if (id) boardRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [hitList, hitIndex, collapsed]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };
  const step = (delta: 1 | -1) => setHitIndex((i) => (hitList.length ? (i + delta + hitList.length) % hitList.length : 0));

  const markOf = (id: string): Mark => {
    if (hits && hitList[hitIndex] === id) return "current";
    if (focus && up.get(focus.id)?.includes(id)) return "rel-up";
    if (focus && down.get(focus.id)?.includes(id)) return "rel-down";
    if (hits) return hits.has(id) ? "hit" : "dim";
    return undefined;
  };

  const focused = focus && board?.tasks[focus.id];

  return (
    <>
      <header class="sticky top-0 z-10 flex items-center gap-2 border-b border-base-300 bg-base-200 px-4 py-2">
        <Title />
        <RefreshButton onBoard={setBoard} />
        <Search
          open={searchOpen}
          query={query}
          current={hitIndex}
          total={hitList.length}
          onToggle={() => (searchOpen ? closeSearch() : openSearch())}
          onOpen={openSearch}
          onClose={closeSearch}
          onQuery={setQuery}
          onStep={step}
        />
        <Settings
          theme={theme as Theme}
          onTheme={setTheme}
          titles={titles}
          onTitles={setTitles}
          positions={positions}
          onPositions={setPositions}
          inLane={inLane}
          onInLane={setInLane}
          legend={legend}
          onLegend={setLegend}
          privacy={privacy}
          onPrivacy={setPrivacy}
        />
      </header>
      <div class={`scroller${titles ? "" : " notitle"}${positions ? "" : " nopos"}`}>
        {error && <p class="empty">Could not load the board: {error}</p>}
        {board && board.lanes.length === 0 && <p class="empty">The board is empty. Run `bun run import &lt;data.json&gt;`.</p>}
        {board && (
          <div class="board" ref={boardRef}>
            <Arrows root={boardRef} board={board} laneOf={laneOf} showInLane={inLane} layoutKey={`${titles}|${collapsedPref}`} />
            {board.lanes.map((lane) => (
              <Lane
                key={lane.key}
                lane={lane}
                tasks={board.tasks}
                markOf={markOf}
                collapsed={collapsed.has(lane.key)}
                onToggle={() => setLane(lane.key, !collapsed.has(lane.key))}
                onFocus={(id, e) => setFocus({ id, x: e.clientX, y: e.clientY })}
                onMove={(e) => setFocus((f) => f && { ...f, x: e.clientX, y: e.clientY })}
                onBlur={() => setFocus(null)}
              />
            ))}
          </div>
        )}
      </div>
      {legend && <Legend />}
      {focus && focused && <Tip task={focused} x={focus.x} y={focus.y} waitsFor={up.get(focus.id) ?? []} blocks={down.get(focus.id) ?? []} />}
    </>
  );
}

render(<App />, document.getElementById("app")!);
