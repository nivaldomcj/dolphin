import type { Lane as LaneData, Task } from "../../shared/types";
import type { Target } from "../lib/move";
import { toneFill } from "../lib/tone";
import { type Hide, inOtherCycle, isHidden } from "../lib/visibility";

export type Mark = "current" | "hit" | "dim" | "rel-up" | "rel-down" | undefined;

/** Where a drag would put its card, as the classes drawn on the cards next to the gap. */
type Side = "drop-before" | "drop-after" | undefined;

interface CardProps {
  task: Task;
  pos: number;
  mark: Mark;
  dragging: boolean;
  side: Side;
  onFocus: (id: string, e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onBlur: () => void;
  /** Alt + press starts a drag; see `useMove`. */
  onGrab: (id: string, e: PointerEvent) => void;
  onCardClick: (e: MouseEvent) => void;
  onCardDragStart: (e: DragEvent) => void;
}

function Card({ task, pos, mark, dragging, side, onFocus, onMove, onBlur, onGrab, onCardClick, onCardDragStart }: CardProps) {
  const other = inOtherCycle(task);
  const classes = [
    "card",
    task.kind === "umbrella" && "umbrella",
    task.closed && "closed",
    other && "other-cycle",
    mark,
    dragging && "dragging",
    side,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <a
      class={classes}
      data-id={task.id}
      href={task.url}
      target="_blank"
      rel="noopener"
      style={{ "--fill": toneFill(task.tone) }}
      onMouseEnter={(e) => onFocus(task.id, e)}
      onMouseMove={onMove}
      onMouseLeave={onBlur}
      onPointerDown={(e) => onGrab(task.id, e)}
      onClick={onCardClick}
      onDragStart={onCardDragStart}
    >
      <span class="pos">{pos}</span>
      {other && task.cycle && (
        <span class="cyc" title={`Cycle ${task.cycle.number} (${task.cycle.state})`}>
          C{task.cycle.number}
        </span>
      )}
      <span class="id">{task.id}</span>
      <span class="ttl sensitive">{task.title}</span>
    </a>
  );
}

interface LaneProps extends Omit<CardProps, "task" | "pos" | "mark" | "dragging" | "side"> {
  lane: LaneData;
  tasks: Record<string, Task>;
  markOf: (id: string) => Mark;
  collapsed: boolean;
  onToggle: () => void;
  /** Which tasks to hide. Shown cards keep their position number, so it still matches the MCP's positions. */
  hide: Hide;
  /** The card being dragged, if any. */
  dragId: string | undefined;
  /** Where the drag would drop, if that changes anything. */
  drop: Target | null;
}

/** One lane. Its header toggles it: a collapsed lane is a thin row with only its key and task count. */
export function Lane({ lane, tasks, markOf, collapsed, onToggle, hide, dragId, drop, ...handlers }: LaneProps) {
  const count = lane.ids.filter((id) => tasks[id] && !isHidden(tasks[id], hide)).length;
  const here = drop?.lane === lane.key ? drop : null;
  const sideOf = (id: string): Side => (here?.at?.id === id ? `drop-${here.at.side}` : undefined);
  return (
    <div
      class={`lane${collapsed ? " collapsed" : ""}${here && !here.at ? " drop-end" : ""}`}
      data-lane={lane.key}
      style={{ "--lane-bg": lane.bg, "--lane-head": lane.head }}
    >
      <button type="button" class="lane-head" aria-expanded={!collapsed} onClick={onToggle}>
        {collapsed ? (
          <span>
            ▸ Lane {lane.key}{" "}
            <small>
              · {count} {count === 1 ? "task" : "tasks"}
            </small>
          </span>
        ) : (
          <>
            <span>▾ Lane {lane.key}</span>
            <small class="sensitive">{lane.name}</small>
            <small>
              {count} {count === 1 ? "task" : "tasks"}
            </small>
          </>
        )}
      </button>
      {!collapsed && (
        <div class="cards">
          {lane.ids.map((id, i) => {
            const task = tasks[id];
            return task && !isHidden(task, hide) ? (
              <Card key={id} task={task} pos={i + 1} mark={markOf(id)} dragging={id === dragId} side={sideOf(id)} {...handlers} />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
