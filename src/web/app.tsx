import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Board } from "../types";
import { Arrows } from "./arrows";
import { Lane, type Mark } from "./lane";
import { usePref } from "./prefs";
import { Tip } from "./tip";

function Legend() {
  return (
    <div class="legend">
      <span><span class="sw" style={{ background: "var(--s-progress)" }} />In Progress</span>
      <span><span class="sw" style={{ background: "var(--s-blocked)" }} />Blocked</span>
      <span><span class="sw" style={{ background: "var(--s-todo)" }} />Todo</span>
      <span><span class="sw" style={{ background: "var(--s-done)" }} />In Review / Done</span>
      <span><span class="sw dash" />Umbrella</span>
      <span><span class="ln" style={{ borderColor: "var(--seq)" }} />Next in lane</span>
      <span><span class="ln" style={{ borderColor: "var(--blk)" }} />Blocker</span>
    </div>
  );
}

function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = usePref("titles", true);
  const [positions, setPositions] = usePref("positions", true);
  const [inLane, setInLane] = usePref("inLane", false);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<{ id: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const first = hits && board?.lanes.flatMap((l) => l.ids).find((id) => hits.has(id));
    if (first) boardRef.current?.querySelector(`[data-id="${CSS.escape(first)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [hits]);

  const markOf = (id: string): Mark => {
    if (focus && up.get(focus.id)?.includes(id)) return "rel-up";
    if (focus && down.get(focus.id)?.includes(id)) return "rel-down";
    if (hits) return hits.has(id) ? "hit" : "dim";
    return undefined;
  };

  const focused = focus && board?.tasks[focus.id];

  return (
    <>
      <header>
        <h1>dolphin</h1>
        <Legend />
        <span class="hint">Hover: red ring = blockers, green ring = blocked tasks. Click opens the task.</span>
        <div class="controls">
          <label><input type="checkbox" checked={titles} onChange={(e) => setTitles(e.currentTarget.checked)} /> Show titles</label>
          <label><input type="checkbox" checked={positions} onChange={(e) => setPositions(e.currentTarget.checked)} /> Show positions</label>
          <label><input type="checkbox" checked={inLane} onChange={(e) => setInLane(e.currentTarget.checked)} /> Show in-lane blockers</label>
          <input type="search" placeholder="Search ID, title or app" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        </div>
      </header>
      <div class={`scroller${titles ? "" : " notitle"}${positions ? "" : " nopos"}`}>
        {error && <p class="empty">Could not load the board: {error}</p>}
        {board && board.lanes.length === 0 && <p class="empty">The board is empty. Run `bun run import &lt;data.json&gt;`.</p>}
        {board && (
          <div class="board" ref={boardRef}>
            <Arrows root={boardRef} board={board} laneOf={laneOf} showInLane={inLane} layoutKey={titles} />
            {board.lanes.map((lane) => (
              <Lane
                key={lane.key}
                lane={lane}
                tasks={board.tasks}
                markOf={markOf}
                onFocus={(id, e) => setFocus({ id, x: e.clientX, y: e.clientY })}
                onMove={(e) => setFocus((f) => f && { ...f, x: e.clientX, y: e.clientY })}
                onBlur={() => setFocus(null)}
              />
            ))}
          </div>
        )}
      </div>
      {focus && focused && <Tip task={focused} x={focus.x} y={focus.y} waitsFor={up.get(focus.id) ?? []} blocks={down.get(focus.id) ?? []} />}
    </>
  );
}

render(<App />, document.getElementById("app")!);
