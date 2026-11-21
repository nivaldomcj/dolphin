import { afterEach, describe, expect, jest, mock, spyOn, test } from "bun:test";
import { act, fireEvent, render, waitFor } from "@testing-library/preact";
import { board, lane, task } from "../test-board";
import { useDom } from "../test-dom";
import { Arrows } from "./arrows";
import { Title } from "./easter-egg";
import { Lane, type Mark } from "./lane";
import { Legend } from "./legend";
import { describeRefresh, RefreshButton } from "./refresh-button";
import { Search } from "./search";
import { Settings } from "./settings";
import { Tip } from "./tip";
import { type Notice, NoticeAlert, Toast, useAutoHide } from "./toast";

useDom();

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

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

    expect(cards(container).map((c) => [c.dataset.id, c.querySelector(".pos")?.textContent])).toEqual([["T1", "1"], ["T2", "2"], ["T3", "3"]]);
    expect(cards(container)[0]?.getAttribute("href")).toBe("https://example.com/T1");
    expect(container.textContent).toContain("Lane A name");
    expect(container.textContent).toContain("3 tasks");
  });

  test("a hidden card keeps the others' numbers, and leaves the count", () => {
    const { container } = show({ hide: { closed: true, otherCycles: false } });

    expect(cards(container).map((c) => [c.dataset.id, c.querySelector(".pos")?.textContent])).toEqual([["T1", "1"], ["T3", "3"]]);
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
    const { container } = render(
      <Lane lane={lane("B", ["T1"])} tasks={tasks} markOf={() => undefined} collapsed={false} onToggle={noop} hide={{ closed: false, otherCycles: false }} dragId={undefined} drop={null} {...handlers} />,
    );
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

describe("Search", () => {
  const props = { open: true, query: "", current: 0, total: 0, onToggle: noop, onOpen: noop, onClose: noop, onQuery: noop, onStep: noop };

  test("closed, it is only the button, which toggles it", () => {
    const onToggle = mock(noop);
    const { container, getByLabelText } = render(<Search {...props} open={false} onToggle={onToggle} />);

    expect(container.querySelector("input")).toBeNull();
    fireEvent.click(getByLabelText("Search"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("typing reports the query; Enter and Shift+Enter step; Esc closes", () => {
    const onQuery = mock((_q: string) => {});
    const onStep = mock((_d: 1 | -1) => {});
    const onClose = mock(noop);
    const { getByPlaceholderText } = render(<Search {...props} onQuery={onQuery} onStep={onStep} onClose={onClose} />);
    const input = getByPlaceholderText("Search ID, title or app") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "eng" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onQuery).toHaveBeenCalledWith("eng");
    expect(onStep.mock.calls.map((c) => c[0])).toEqual([1, -1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("shows which match is current, or 0 when nothing matches", () => {
    const hits = render(<Search {...props} query="eng" current={1} total={4} />);
    expect(hits.container.textContent).toContain("2/4");
    hits.unmount();

    expect(render(<Search {...props} query="zzz" />).container.textContent).toContain("0");
  });

  test("⌘F or Ctrl+F opens the search instead of the browser's find", () => {
    const onOpen = mock(noop);
    render(<Search {...props} open={false} onOpen={onOpen} />);

    const meta = new KeyboardEvent("keydown", { key: "f", metaKey: true, cancelable: true });
    dispatchEvent(meta);
    dispatchEvent(new KeyboardEvent("keydown", { key: "F", ctrlKey: true }));
    dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(meta.defaultPrevented).toBe(true);
  });
});

describe("Settings", () => {
  const props = {
    theme: "system" as const,
    onTheme: noop,
    titles: true,
    onTitles: noop,
    positions: true,
    onPositions: noop,
    inLane: false,
    onInLane: noop,
    legend: false,
    onLegend: noop,
    completed: true,
    onCompleted: noop,
    otherCycles: true,
    onOtherCycles: noop,
    privacy: false,
    onPrivacy: noop,
  };

  test("the current theme and each setting's state are the active buttons", () => {
    const { container } = render(<Settings {...props} theme="dark" />);
    const active = [...container.querySelectorAll(".btn-active")].map((b) => b.getAttribute("aria-label"));

    expect(active).toEqual([
      "Theme: dark",
      "titles: on",
      "positions: on",
      "in-lane blockers: off",
      "completed: on",
      "other cycles: on",
      "legend: off",
      "privacy: off",
    ]);
  });

  test("the buttons report the chosen value", () => {
    const onTheme = mock((_t: string) => {});
    const onLegend = mock((_v: boolean) => {});
    const onTitles = mock((_v: boolean) => {});
    const { getByLabelText } = render(<Settings {...props} onTheme={onTheme} onLegend={onLegend} onTitles={onTitles} />);

    fireEvent.click(getByLabelText("Theme: light"));
    fireEvent.click(getByLabelText("legend: on"));
    fireEvent.click(getByLabelText("titles: off"));

    expect(onTheme).toHaveBeenCalledWith("light");
    expect(onLegend).toHaveBeenCalledWith(true);
    expect(onTitles).toHaveBeenCalledWith(false);
  });
});

describe("Tip", () => {
  test("shows the task's facts, its blockers, what it blocks and its note", () => {
    const t = task("ENG-1", { status: "In Progress", kind: "release", app: "billing", project: "Q4", parent: "ENG-0", note: "ship Friday", cycle: { number: 7, state: "next" } });
    const text = render(<Tip task={t} x={10} y={10} waitsFor={["ENG-2"]} blocks={["ENG-3", "ENG-4"]} />).container.textContent ?? "";

    expect(text).toContain("ENG-1 · In Progress");
    expect(text).toContain("Kind: release · Priority: - · Size: -");
    expect(text).toContain("App: billing · Project: Q4 · Cycle: 7 (next) · Parent: ENG-0");
    expect(text).toContain("Waits for: ENG-2");
    expect(text).toContain("Blocks: ENG-3, ENG-4");
    expect(text).toContain("Note: ship Friday");
  });

  test("leaves out the parts a task does not have", () => {
    const text = render(<Tip task={task("T1", { cycle: { number: 3, state: "current" } })} x={0} y={0} waitsFor={[]} blocks={[]} />).container.textContent ?? "";

    expect(text).toContain("Cycle: 3");
    expect(text).not.toContain("(current)");
    for (const part of ["Waits for", "Blocks", "Note", "Project", "Parent", "Summary"]) expect(text).not.toContain(part);
  });
});

describe("toasts", () => {
  const notice = (failed: boolean): Notice => ({ failed, title: "Moved", lines: ["one", "two"] });

  test("a notice shows its title and lines in its tone, and closes", () => {
    const onClose = mock(noop);
    const { container, getByLabelText } = render(
      <Toast side="end">
        <NoticeAlert notice={notice(false)} tone="warning" sensitive onClose={onClose} />
      </Toast>,
    );

    expect(container.querySelector(".toast")?.classList.contains("toast-end")).toBe(true);
    expect(container.querySelector(".alert")?.classList.contains("alert-warning")).toBe(true);
    expect([...container.querySelectorAll("li")].map((l) => l.textContent)).toEqual(["one", "two"]);
    expect(container.querySelector("ul")?.classList.contains("sensitive")).toBe(true);
    fireEvent.click(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a failure is always red", () => {
    const { container } = render(<NoticeAlert notice={notice(true)} tone="success" onClose={noop} />);
    expect(container.querySelector(".alert")?.classList.contains("alert-error")).toBe(true);
  });

  test("a notice that did not fail hides itself after 6 s; a failure stays", () => {
    jest.useFakeTimers();
    try {
      const Probe = ({ n, clear }: { n: Notice; clear: () => void }) => {
        useAutoHide(n, clear);
        return null;
      };
      const ok = mock(noop), failed = mock(noop);
      render(<Probe n={notice(false)} clear={ok} />);
      render(<Probe n={notice(true)} clear={failed} />);

      jest.advanceTimersByTime(5999);
      expect(ok).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(ok).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(60_000);
      expect(failed).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("refresh", () => {
  test("a summary with nothing in it reads up to date", () => {
    expect(describeRefresh({ changes: [], added: [], errors: {} })).toEqual({ kind: "done", title: "Up to date", lines: [], failed: false });
  });

  test("a summary lists every change, new task and failed source", () => {
    expect(
      describeRefresh({ changes: [{ id: "T1", from: "Todo", to: "Done" }], added: ["T9", "T10"], errors: { github: "gh down" } }),
    ).toEqual({
      kind: "done",
      title: "1 changed, 2 new, 1 source failed",
      lines: ["T1: Todo → Done", "T9: new, in lane N", "T10: new, in lane N", "github: gh down"],
      failed: true,
    });
  });

  test("the button shows progress, then hands over the board and reports", async () => {
    const next = board([lane("A", ["T1"])]);
    let reply!: (r: Response) => void;
    spyOn(globalThis, "fetch").mockImplementation((() => new Promise<Response>((resolve) => (reply = resolve))) as unknown as typeof fetch);
    const onBoard = mock((_b: unknown) => {});
    const { container, getByLabelText } = render(<RefreshButton onBoard={onBoard} />);

    fireEvent.click(getByLabelText("Refresh"));
    await waitFor(() => expect(container.textContent).toContain("Refreshing…"));
    expect((getByLabelText("Refresh") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => reply(Response.json({ summary: { changes: [{ id: "T1", from: "Todo", to: "Done" }], added: [], errors: {} }, board: next })));
    await waitFor(() => expect(container.textContent).toContain("1 changed"));
    expect(onBoard).toHaveBeenCalledWith(next);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/refresh", { method: "POST" });
  });

  test("a failed refresh says so and keeps the board", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 502 }));
    const onBoard = mock((_b: unknown) => {});
    const { container, getByLabelText } = render(<RefreshButton onBoard={onBoard} />);

    fireEvent.click(getByLabelText("Refresh"));

    await waitFor(() => expect(container.textContent).toContain("Refresh failed"));
    expect(container.textContent).toContain("HTTP 502");
    expect(container.querySelector(".alert-error")).not.toBeNull();
    expect(onBoard).not.toHaveBeenCalled();
  });
});

describe("Title", () => {
  test("clicking the title opens the video, and closing the dialog removes it", async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    const showModal = spyOn(HTMLDialogElement.prototype, "showModal");
    const { container, getByText } = render(<Title />);
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(getByText("🐬 dolphin"));
    await waitFor(() => expect(showModal).toHaveBeenCalledTimes(1));
    expect(container.querySelector("iframe")?.getAttribute("src")).toContain("youtube.com/embed/");

    fireEvent(container.querySelector("dialog")!, new Event("close"));
    await waitFor(() => expect(container.querySelector("iframe")).toBeNull());
    showModal.mockRestore();
  });
});

test("the legend names the colors and lines", () => {
  const text = render(<Legend />).container.textContent ?? "";
  for (const part of ["In Progress", "Blocked", "Umbrella", "Next in lane", "Blocker"]) expect(text).toContain(part);
});

describe("Arrows", () => {
  /** A board root with cards laid out by lane row: lane i at y = i*100, card j at x = j*200, each 100x40. */
  function rootWith(b: ReturnType<typeof board>) {
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON() {} });
    b.lanes.forEach((l, i) =>
      l.ids.forEach((id, j) => {
        const card = document.createElement("a");
        card.dataset.id = id;
        card.getBoundingClientRect = () => ({ left: j * 200, top: i * 100, right: j * 200 + 100, bottom: i * 100 + 40, width: 100, height: 40, x: j * 200, y: i * 100, toJSON() {} });
        root.appendChild(card);
      }),
    );
    document.body.appendChild(root);
    return root;
  }
  const drawn = (c: Element) =>
    [...c.querySelectorAll("svg > path")].map((p) => (p.getAttribute("marker-end") === "url(#mS)" ? "seq" : p.getAttribute("stroke-dasharray") ? "inlane" : "cross"));

  const b = board([lane("A", ["T1", "T2", "T3"]), lane("B", ["T4"])], [], [["T1", "T3"], ["T2", "T4"]]);
  const laneOf = new Map([["T1", "A"], ["T2", "A"], ["T3", "A"], ["T4", "B"]]);

  test("draws a sequence line between neighbors, and a curve for each cross-lane blocker", () => {
    const root = rootWith(b);
    const { container } = render(<Arrows root={{ current: root as HTMLDivElement }} board={b} laneOf={laneOf} showInLane={false} layoutKey={0} />);

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
