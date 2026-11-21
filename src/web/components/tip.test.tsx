import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import { task } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { Tip } from "./tip";

useDom();

describe("Tip", () => {
  test("shows the task's facts, its blockers, what it blocks and its note", () => {
    const t = task("ENG-1", {
      status: "In Progress",
      kind: "release",
      app: "billing",
      project: "Q4",
      parent: "ENG-0",
      note: "ship Friday",
      cycle: { number: 7, state: "next" },
    });
    const text = render(<Tip task={t} x={10} y={10} waitsFor={["ENG-2"]} blocks={["ENG-3", "ENG-4"]} />).container.textContent ?? "";

    expect(text).toContain("ENG-1 · In Progress");
    expect(text).toContain("Kind: release · Priority: - · Size: -");
    expect(text).toContain("App: billing · Project: Q4 · Cycle: 7 (next) · Parent: ENG-0");
    expect(text).toContain("Waits for: ENG-2");
    expect(text).toContain("Blocks: ENG-3, ENG-4");
    expect(text).toContain("Note: ship Friday");
  });

  test("leaves out the parts a task does not have", () => {
    const text =
      render(<Tip task={task("T1", { cycle: { number: 3, state: "current" } })} x={0} y={0} waitsFor={[]} blocks={[]} />).container
        .textContent ?? "";

    expect(text).toContain("Cycle: 3");
    expect(text).not.toContain("(current)");
    for (const part of ["Waits for", "Blocks", "Note", "Project", "Parent", "Summary"]) expect(text).not.toContain(part);
  });
});
