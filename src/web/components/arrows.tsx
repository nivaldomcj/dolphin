import type { RefObject } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";
import type { Board } from "../../shared/types";

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
  cx: number;
  cy: number;
}
interface Path {
  key: string;
  d: string;
  kind: "seq" | "cross" | "inlane";
}

function measure(root: HTMLElement, id: string): Box | undefined {
  const node = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!node) return undefined;
  const o = root.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  const l = r.left - o.left,
    t = r.top - o.top;
  return { l, t, r: l + r.width, b: t + r.height, cx: l + r.width / 2, cy: t + r.height / 2 };
}

function layout(root: HTMLElement, board: Board, laneOf: Map<string, string>, showInLane: boolean): Path[] {
  const paths: Path[] = [];
  for (const lane of board.lanes) {
    // Only rendered cards: a hidden (completed) card or a collapsed lane leaves no gap in the sequence line.
    const shown = lane.ids.map((id) => [id, measure(root, id)] as const).filter((e): e is readonly [string, Box] => e[1] !== undefined);
    for (let i = 0; i + 1 < shown.length; i++) {
      const [id, a] = shown[i]!,
        [, b] = shown[i + 1]!;
      paths.push({ key: `s-${id}`, kind: "seq", d: `M${a.r + 2},${a.cy} L${b.l - 3},${b.cy}` });
    }
  }
  for (const [x, y] of board.edges) {
    const cross = laneOf.get(x) !== laneOf.get(y);
    if (!cross && !showInLane) continue;
    const a = measure(root, x),
      b = measure(root, y);
    if (!a || !b) continue;
    let d: string;
    if (cross) {
      const down = b.cy > a.cy;
      const y1 = down ? a.b : a.t,
        y2 = down ? b.t - 2 : b.b + 2,
        my = (y1 + y2) / 2;
      d = `M${a.cx},${y1} C${a.cx},${my} ${b.cx},${my} ${b.cx},${y2}`;
    } else {
      const lift = 34 + Math.min(60, Math.abs(b.cx - a.cx) / 25);
      d = `M${a.cx},${a.t} C${a.cx},${a.t - lift} ${b.cx},${b.t - lift} ${b.cx},${b.t - 2}`;
    }
    paths.push({ key: `e-${x}-${y}`, kind: cross ? "cross" : "inlane", d });
  }
  return paths;
}

interface Props {
  root: RefObject<HTMLDivElement | null>;
  board: Board;
  laneOf: Map<string, string>;
  showInLane: boolean;
  /** Any value that changes card sizes, so the arrows are measured again. */
  layoutKey: unknown;
}

/** SVG overlay: grey sequence lines inside a lane, blue curves for dependencies. */
export function Arrows({ root, board, laneOf, showInLane, layoutKey }: Props) {
  const [paths, setPaths] = useState<Path[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const redraw = () => setPaths(layout(el, board, laneOf, showInLane));
    redraw();
    document.fonts?.ready.then(redraw);
    // Any board resize moves the cards: the window, the legend bar taking height, card widths changing.
    const observer = new ResizeObserver(redraw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [board, laneOf, showInLane, layoutKey]);

  return (
    // Sized by CSS (inset: 0 on the board). Measuring the board would include this overlay and it could never shrink.
    // Decorative: the hover tip gives the same blockers as text, so screen readers skip the drawing.
    <svg class="arrows" aria-hidden="true">
      <defs>
        <marker id="mS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0L10,5L0,10z" style={{ fill: "var(--seq)" }} />
        </marker>
        <marker id="mB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0L10,5L0,10z" style={{ fill: "var(--blk)" }} />
        </marker>
      </defs>
      {paths.map((p) =>
        p.kind === "seq" ? (
          <path key={p.key} d={p.d} style={{ stroke: "var(--seq)" }} stroke-width="1.6" marker-end="url(#mS)" />
        ) : (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            style={{ stroke: "var(--blk)" }}
            stroke-width={p.kind === "cross" ? 2.2 : 1.4}
            stroke-dasharray={p.kind === "inlane" ? "5 4" : undefined}
            opacity={p.kind === "inlane" ? 0.75 : undefined}
            marker-end="url(#mB)"
          />
        ),
      )}
    </svg>
  );
}
