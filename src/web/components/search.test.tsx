import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { Search } from "./search";

useDom();

const noop = () => {};

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
