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
}

export function Lane({ lane, tasks, markOf, ...handlers }: LaneProps) {
  return (
    <div class="lane" style={{ "--lane-bg": lane.bg, "--lane-head": lane.head }}>
      <div class="lane-head">
        Lane {lane.key}
        <small class="sensitive">{lane.name}</small>
        <small>{lane.ids.length} tasks</small>
      </div>
      <div class="cards">
        {lane.ids.map((id, i) => {
          const task = tasks[id];
          return task ? <Card key={id} task={task} pos={i + 1} mark={markOf(id)} {...handlers} /> : null;
        })}
      </div>
    </div>
  );
}
