import { afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/preact";
import type { Board } from "../../shared/types";
import { board, lane, task } from "../test-board";
import { useDom } from "../test-dom";
import { App } from "./app";

useDom();

beforeAll(() => {
  // happy-dom has no layout: the page scrolls a match into view, which is a no-op here.
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

const serve = (b: Board | Response) =>
  spyOn(globalThis, "fetch").mockImplementation((async () => (b instanceof Response ? b : Response.json(b))) as unknown as typeof fetch);

const demo = board(
  [lane("A", ["ENG-1", "ENG-2"]), lane("B", ["ENG-3"]), lane("N", ["ENG-9"])],
  [
    task("ENG-1", { title: "Passkey sign in" }),
    task("ENG-2", { title: "Old thing", closed: true }),
    task("ENG-3", { title: "Rate limit" }),
  ],
  [["ENG-1", "ENG-3"]],
);

test("loads the board and shows every lane with its cards", async () => {
  serve(demo);
  const { container } = render(<App />);

  await waitFor(() => expect(container.querySelectorAll(".lane")).toHaveLength(3));
  expect([...container.querySelectorAll(".lane")].map((l) => (l as HTMLElement).dataset.lane)).toEqual(["A", "B", "N"]);
  expect([...container.querySelectorAll(".card")].map((c) => (c as HTMLElement).dataset.id)).toEqual(["ENG-1", "ENG-2", "ENG-3", "ENG-9"]);
});

test("an empty board says how to fill it", async () => {
  serve(board([]));
  const { container } = render(<App />);

  await waitFor(() => expect(container.textContent).toContain("The board is empty. Run `bun run import <data.json>`."));
});

test("a board that fails to load says why", async () => {
  serve(new Response("down", { status: 500 }));
  const { container } = render(<App />);

  await waitFor(() => expect(container.textContent).toContain("Could not load the board: HTTP 500"));
});

test("a search marks the current match, dims the rest, and counts the matches", async () => {
  serve(demo);
  const { container, getByLabelText, getByPlaceholderText } = render(<App />);
  await waitFor(() => expect(container.querySelectorAll(".card")).toHaveLength(4));

  fireEvent.click(getByLabelText("Search"));
  fireEvent.input(getByPlaceholderText("Search ID, title or app"), { target: { value: "rate" } });

  await waitFor(() => expect(container.querySelector('[data-id="ENG-3"]')?.classList.contains("current")).toBe(true));
  expect(container.querySelector('[data-id="ENG-1"]')?.classList.contains("dim")).toBe(true);
  expect(container.textContent).toContain("1/1");
});

test("hovering a card shows its tip and rings what it blocks", async () => {
  serve(demo);
  const { container } = render(<App />);
  await waitFor(() => expect(container.querySelectorAll(".card")).toHaveLength(4));

  fireEvent.mouseEnter(container.querySelector('[data-id="ENG-1"]')!);

  await waitFor(() => expect(document.querySelector(".tip")?.textContent).toContain("Blocks: ENG-3"));
  expect(container.querySelector('[data-id="ENG-3"]')?.classList.contains("rel-down")).toBe(true);
});

test("turning off completed tasks hides their cards", async () => {
  serve(demo);
  const { container, getByLabelText } = render(<App />);
  await waitFor(() => expect(container.querySelectorAll(".card")).toHaveLength(4));

  fireEvent.click(getByLabelText("completed: off"));

  await waitFor(() => expect(container.querySelector('[data-id="ENG-2"]')).toBeNull());
});
