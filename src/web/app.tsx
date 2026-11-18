import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Arrows } from "./components/arrows";
import { Title } from "./components/easter-egg";
import { Lane, type Mark } from "./components/lane";
import { Legend } from "./components/legend";
import { RefreshButton } from "./components/refresh-button";
import { Search } from "./components/search";
import { Settings } from "./components/settings";
import { Tip } from "./components/tip";
import { useBoard } from "./hooks/use-board";
import { useCollapsedLanes } from "./hooks/use-collapsed-lanes";
import { useDisplay } from "./hooks/use-display";
import { useSearch } from "./hooks/use-search";

function App() {
  const { board, setBoard, error, graph } = useBoard();
  const display = useDisplay();
  const lanes = useCollapsedLanes();
  const search = useSearch(board);
  const [focus, setFocus] = useState<{ id: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { laneOf, up, down } = graph;

  useEffect(() => {
    const id = search.current;
    const key = id && laneOf.get(id);
    // A match in a collapsed lane would be invisible, so expand that lane first; this effect runs again after.
    if (key && lanes.collapsed.has(key)) return lanes.setCollapsed(key, false);
    if (id) boardRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [search.current, lanes.collapsed]);

  const markOf = (id: string): Mark => {
    if (search.hits && search.current === id) return "current";
    if (focus && up.get(focus.id)?.includes(id)) return "rel-up";
    if (focus && down.get(focus.id)?.includes(id)) return "rel-down";
    if (search.hits) return search.hits.has(id) ? "hit" : "dim";
    return undefined;
  };

  const focused = focus && board?.tasks[focus.id];

  return (
    <>
      <header class="sticky top-0 z-10 flex items-center gap-2 border-b border-base-300 bg-base-200 px-4 py-2">
        <Title />
        <RefreshButton onBoard={setBoard} />
        <Search
          open={search.open}
          query={search.query}
          current={search.index}
          total={search.list.length}
          onToggle={() => (search.open ? search.closeSearch() : search.openSearch())}
          onOpen={search.openSearch}
          onClose={search.closeSearch}
          onQuery={search.setQuery}
          onStep={search.step}
        />
        <Settings {...display} />
      </header>
      <div class={`scroller${display.titles ? "" : " notitle"}${display.positions ? "" : " nopos"}`}>
        {error && <p class="empty">Could not load the board: {error}</p>}
        {board && board.lanes.length === 0 && <p class="empty">The board is empty. Run `bun run import &lt;data.json&gt;`.</p>}
        {board && (
          <div class="board" ref={boardRef}>
            <Arrows root={boardRef} board={board} laneOf={laneOf} showInLane={display.inLane} layoutKey={`${display.titles}|${lanes.key}`} />
            {board.lanes.map((lane) => (
              <Lane
                key={lane.key}
                lane={lane}
                tasks={board.tasks}
                markOf={markOf}
                collapsed={lanes.collapsed.has(lane.key)}
                onToggle={() => lanes.toggle(lane.key)}
                onFocus={(id, e) => setFocus({ id, x: e.clientX, y: e.clientY })}
                onMove={(e) => setFocus((f) => f && { ...f, x: e.clientX, y: e.clientY })}
                onBlur={() => setFocus(null)}
              />
            ))}
          </div>
        )}
      </div>
      {display.legend && <Legend />}
      {focus && focused && <Tip task={focused} x={focus.x} y={focus.y} waitsFor={up.get(focus.id) ?? []} blocks={down.get(focus.id) ?? []} />}
    </>
  );
}

render(<App />, document.getElementById("app")!);
