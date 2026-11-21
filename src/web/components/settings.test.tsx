import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { Settings } from "./settings";

useDom();

const noop = () => {};

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
