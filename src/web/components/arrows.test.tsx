import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import { board, lane } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { Arrows } from "./arrows";

useDom();

describe("Arrows", () => {
  /** A board root with cards laid out by lane row: lane i at y = i*100, card j at x = j*200, each 100x40. */
  function rootWith(b: ReturnType<typeof board>) {
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON() {} });
    for (const [i, l] of b.lanes.entries()) {
      for (const [j, id] of l.ids.entries()) {
        const card = document.createElement("a");
        card.dataset.id = id;
        card.getBoundingClientRect = () => ({
          left: j * 200,
          top: i * 100,
          right: j * 200 + 100,
          bottom: i * 100 + 40,
          width: 100,
          height: 40,
          x: j * 200,
          y: i * 100,
          toJSON() {},
        });
        root.appendChild(card);
      }
    }
    document.body.appendChild(root);
    return root;
  }
  const drawn = (c: Element) =>
    [...c.querySelectorAll("svg > path")].map((p) =>
      p.getAttribute("marker-end") === "url(#mS)" ? "seq" : p.getAttribute("stroke-dasharray") ? "inlane" : "cross",
    );

  const b = board(
    [lane("A", ["T1", "T2", "T3"]), lane("B", ["T4"])],
    [],
    [
      ["T1", "T3"],
      ["T2", "T4"],
    ],
  );
  const laneOf = new Map([
    ["T1", "A"],
    ["T2", "A"],
    ["T3", "A"],
    ["T4", "B"],
  ]);

  test("draws a sequence line between neighbors, and a curve for each cross-lane blocker", () => {
    const root = rootWith(b);
    const { container } = render(
      <Arrows root={{ current: root as HTMLDivElement }} board={b} laneOf={laneOf} showInLane={false} layoutKey={0} />,
    );

    expect(drawn(container)).toEqual(["seq", "seq", "cross"]);
    expect(container.querySelectorAll("svg > path")[0]?.getAttribute("d")).toBe("M102,20 L197,20");
    // T2 (x 200..300, y 0..40) blocks T4 (x 0..100, y 100..140): the curve goes down from T2's bottom to T4's top.
    expect(container.querySelectorAll("svg > path")[2]?.getAttribute("d")).toBe("M250,40 C250,69 50,69 50,98");
  });

  test("in-lane blockers are drawn only when asked for, dashed", () => {
    const root = rootWith(b);
    const { container } = render(<Arrows root={{ current: root as HTMLDivElement }} board={b} laneOf={laneOf} showInLane layoutKey={0} />);

    expect(drawn(container)).toEqual(["seq", "seq", "inlane", "cross"]);
  });

  test("a card that is not rendered leaves no line", () => {
    const root = rootWith(board([lane("A", ["T1", "T3"]), lane("B", ["T4"])]));
    const { container } = render(<Arrows root={{ current: root as HTMLDivElement }} board={b} laneOf={laneOf} showInLane layoutKey={0} />);

    // T2 is hidden: T1 and T3 are joined directly, and the edges that need T2 are skipped.
    expect(drawn(container)).toEqual(["seq", "inlane"]);
  });
});
