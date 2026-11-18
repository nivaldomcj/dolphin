import type { Lane as LaneData, Task } from "../types";
import { statusFill } from "./status";

export type Mark = "current" | "hit" | "dim" | "rel-up" | "rel-down" | undefined;

interface CardProps {
  task: Task;
  pos: number;
  mark: Mark;
  onFocus: (id: string, e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onBlur: () => void;
}

function Card({ task, pos, mark, onFocus, onMove, onBlur }: CardProps) {
  const classes = ["card", task.kind === "umbrella" && "umbrella", task.closed && "closed", mark].filter(Boolean).join(" ");
  return (
    <a
      class={classes}
      data-id={task.id}
      href={task.url}
      target="_blank"
      rel="noopener"
      style={{ background: statusFill(task.status) }}
      onMouseEnter={(e) => onFocus(task.id, e)}
      onMouseMove={onMove}
      onMouseLeave={onBlur}
    >
      <span class="pos">{pos}</span>
      <span class="id">{task.id}</span>
      <span class="ttl sensitive">{task.title}</span>
    </a>
  );
}

interface LaneProps extends Omit<CardProps, "task" | "pos" | "mark"> {
  lane: LaneData;
  tasks: Record<string, Task>;
  markOf: (id: string) => Mark;
  collapsed: boolean;
  onToggle: () => void;
}

/** One lane. Its header toggles it: a collapsed lane is a thin row with only its key and task count. */
export function Lane({ lane, tasks, markOf, collapsed, onToggle, ...handlers }: LaneProps) {
  return (
    <div class={`lane${collapsed ? " collapsed" : ""}`} style={{ "--lane-bg": lane.bg, "--lane-head": lane.head }}>
      <button type="button" class="lane-head" aria-expanded={!collapsed} onClick={onToggle}>
        {collapsed ? (
          <span>
            ▸ Lane {lane.key} <small>· {lane.ids.length} tasks</small>
          </span>
        ) : (
          <>
            <span>▾ Lane {lane.key}</span>
            <small class="sensitive">{lane.name}</small>
            <small>{lane.ids.length} tasks</small>
          </>
        )}
      </button>
      {!collapsed && (
        <div class="cards">
          {lane.ids.map((id, i) => {
            const task = tasks[id];
            return task ? <Card key={id} task={task} pos={i + 1} mark={markOf(id)} {...handlers} /> : null;
          })}
        </div>
      )}
    </div>
  );
}
