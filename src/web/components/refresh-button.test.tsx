import { describe, expect, mock, spyOn, test } from "bun:test";
import { act, fireEvent, render, waitFor } from "@testing-library/preact";
import { board, lane } from "../../../test/board";
import { useDom } from "../../../test/dom";
import { describeRefresh, RefreshButton } from "./refresh-button";

useDom();

describe("refresh", () => {
  test("a summary with nothing in it reads up to date", () => {
    expect(describeRefresh({ changes: [], added: [], errors: {} })).toEqual({
      kind: "done",
      title: "Up to date",
      lines: [],
      failed: false,
    });
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

    await act(async () =>
      reply(Response.json({ summary: { changes: [{ id: "T1", from: "Todo", to: "Done" }], added: [], errors: {} }, board: next })),
    );
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
