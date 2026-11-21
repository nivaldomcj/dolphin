import { describe, expect, jest, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { type Notice, NoticeAlert, Toast, useAutoHide } from "./toast";

useDom();

const noop = () => {};

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
      const ok = mock(noop),
        failed = mock(noop);
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
