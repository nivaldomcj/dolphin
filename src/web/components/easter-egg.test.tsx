import { describe, expect, spyOn, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/preact";
import { useDom } from "../../../test/dom";
import { Title } from "./easter-egg";

useDom();

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
