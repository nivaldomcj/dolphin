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
  const search = useSearch(board, !display.completed);
  const [focus, setFocus] = useState<{ id: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const { laneOf, up, down } = graph;

  // Reveal the current match on a new search or an explicit step, not on a lane toggle, so collapsing a lane during
  // a search sticks while Enter still brings the match back.
  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  useEffect(() => {
    const id = search.current;
    if (!id) return;
    const scroll = () =>
      boardRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    const key = laneOf.get(id);
    if (key && lanesRef.current.collapsed.has(key)) {
      lanesRef.current.setCollapsed(key, false);
      const frame = requestAnimationFrame(scroll); // after the expanded lane renders its cards
      return () => cancelAnimationFrame(frame); // the match changed first: do not scroll to the old one
    }
    scroll();
  }, [search.current, search.seq]);

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
            <Arrows root={boardRef} board={board} laneOf={laneOf} showInLane={display.inLane} layoutKey={`${display.titles}|${display.completed}|${lanes.key}`} />
            {board.lanes.map((lane) => (
              <Lane
                key={lane.key}
                lane={lane}
                tasks={board.tasks}
                markOf={markOf}
                collapsed={lanes.collapsed.has(lane.key)}
                onToggle={() => lanes.toggle(lane.key)}
                hideClosed={!display.completed}
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
