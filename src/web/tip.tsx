import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Task } from "../types";

interface Props {
  task: Task;
  x: number;
  y: number;
  waitsFor: string[];
  blocks: string[];
}

/** Hover card that follows the pointer and flips to stay inside the window. */
export function Tip({ task: t, x, y, waitsFor, blocks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: `${x + 14}px`, top: `${y + 16}px` });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let left = x + 14, top = y + 16;
    if (left + el.offsetWidth > innerWidth - 8) left = x - el.offsetWidth - 14;
    if (top + el.offsetHeight > innerHeight - 8) top = y - el.offsetHeight - 16;
    setPos({ left: `${left}px`, top: `${top}px` });
  }, [x, y, t.id]);

  return (
    <div class="tip sensitive" ref={ref} style={pos}>
      <b>{t.id}</b> · {t.status}
      <br />
      {t.title}
      <br />
      {t.short && (<><span class="k">Summary:</span> {t.short}<br /></>)}
      <span class="k">Kind:</span> {t.kind ?? "-"} · <span class="k">Priority:</span> {t.priority ?? "-"} ·{" "}
      <span class="k">Size:</span> {t.estimate ?? "-"}
      <br />
      <span class="k">App:</span> {t.app ?? "-"}
      {t.project && (<> · <span class="k">Project:</span> {t.project}</>)}
      {t.parent && (<> · <span class="k">Parent:</span> {t.parent}</>)}
      <br />
      {waitsFor.length > 0 && (<><span class="k">Waits for:</span> {waitsFor.join(", ")}<br /></>)}
      {blocks.length > 0 && (<><span class="k">Blocks:</span> {blocks.join(", ")}<br /></>)}
      {t.note && (<><span class="k">Note:</span> {t.note}</>)}
    </div>
  );
}
