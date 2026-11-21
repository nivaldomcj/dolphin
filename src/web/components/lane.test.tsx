import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/preact";
import { lane, task } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { Lane, type Mark } from "./lane";

useDom();

const noop = () => {};
const handlers = { onFocus: noop, onMove: noop, onBlur: noop, onGrab: noop, onCardClick: noop, onCardDragStart: noop };

describe("Lane", () => {
  const tasks = {
    T1: task("T1"),
    T2: task("T2", { closed: true }),
    T3: task("T3", { cycle: { number: 9, state: "next" }, kind: "umbrella", tone: "blocked" }),
  };
  const show = (over: Partial<Parameters<typeof Lane>[0]> = {}) =>
    render(
      <Lane
        lane={lane("A", ["T1", "T2", "T3", "GONE"])}
        tasks={tasks}
        markOf={() => undefined}
        collapsed={false}
        onToggle={noop}
        hide={{ closed: false, otherCycles: false }}
        dragId={undefined}
        drop={null}
        {...handlers}
        {...over}
      />,
    );
  const cards = (c: Element) => [...c.querySelectorAll<HTMLElement>(".card")];

  test("shows each known task as a card linking to its tracker, numbered by place", () => {
    const { container } = show();

    expect(cards(container).map((c) => [c.dataset.id, c.querySelector(".pos")?.textContent])).toEqual([
      ["T1", "1"],
      ["T2", "2"],
      ["T3", "3"],
    ]);
    expect(cards(container)[0]?.getAttribute("href")).toBe("https://example.com/T1");
    expect(container.textContent).toContain("Lane A name");
    expect(container.textContent).toContain("3 tasks");
  });

  test("a hidden card keeps the others' numbers, and leaves the count", () => {
    const { container } = show({ hide: { closed: true, otherCycles: false } });

    expect(cards(container).map((c) => [c.dataset.id, c.querySelector(".pos")?.textContent])).toEqual([
      ["T1", "1"],
      ["T3", "3"],
    ]);
    expect(container.textContent).toContain("2 tasks");
  });

  test("card classes carry the closed, umbrella, other-cycle, mark and drag states", () => {
    const marks: Record<string, Mark> = { T1: "current", T3: "rel-up" };
    const { container } = show({ markOf: (id) => marks[id], dragId: "T1" });

    const [t1, t2, t3] = cards(container);
    expect(t1?.className).toBe("card current dragging");
    expect(t2?.className).toBe("card closed");
    expect(t3?.className).toBe("card umbrella other-cycle rel-up");
    expect(t3?.querySelector(".cyc")?.textContent).toBe("C9");
    expect(t3?.style.getPropertyValue("--fill")).toBe("var(--s-blocked)");
  });

  test("the drop target draws on the card next to the gap, or on the lane for its end", () => {
    const before = show({ drop: { lane: "A", at: { id: "T2", side: "before" } } });
    expect(before.container.querySelector(".drop-before")?.getAttribute("data-id")).toBe("T2");
    before.unmount();

    const end = show({ drop: { lane: "A" } });
    expect(end.container.querySelector(".lane")?.classList.contains("drop-end")).toBe(true);
    end.unmount();

    const elsewhere = show({ drop: { lane: "B" } });
    expect(elsewhere.container.querySelector(".drop-end, .drop-before, .drop-after")).toBeNull();
  });

  test("collapsed, it shows only its key and count, and the header toggles it", () => {
    const onToggle = mock(noop);
    const { container, getByRole } = show({ collapsed: true, onToggle });

    expect(cards(container)).toEqual([]);
    expect(getByRole("button").textContent).toBe("▸ Lane A · 3 tasks");
    expect(getByRole("button").getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("one task is counted in the singular", () => {
    const { container } = show({ lane: lane("B", ["T1"]) });
    expect(container.textContent).toContain("1 task");
    expect(container.textContent).not.toContain("1 tasks");
  });

  test("pointing at a card reports it, with the pointer", () => {
    const onFocus = mock((_id: string, _e: MouseEvent) => {});
    const onGrab = mock((_id: string, _e: PointerEvent) => {});
    const { container } = show({ onFocus, onGrab });

    fireEvent.mouseEnter(cards(container)[1]!);
    fireEvent.pointerDown(cards(container)[1]!);
    expect(onFocus.mock.calls[0]?.[0]).toBe("T2");
    expect(onGrab.mock.calls[0]?.[0]).toBe("T2");
  });
});
