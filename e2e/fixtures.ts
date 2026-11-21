import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Locator, type Page, test as base } from "@playwright/test";
import { ENV } from "./playwright.config";

const ROOT = join(import.meta.dirname, "..");

/** Every test starts from the same demo board, written while the server keeps running. */
export const test = base.extend<{ board: Page }>({
  board: async ({ page }, use) => {
    execFileSync("bun", ["src/scripts/seed-demo.ts"], { cwd: ROOT, env: { ...process.env, ...ENV }, stdio: "ignore" });
    await page.goto("/");
    await expect(page.locator(".card").first()).toBeVisible();
    await use(page);
  },
});

export { expect };

export const card = (page: Page, id: string): Locator => page.locator(`.card[data-id="${id}"]`);
export const laneEl = (page: Page, key: string): Locator => page.locator(`.lane[data-lane="${key}"]`);
export const laneIds = (page: Page, key: string): Promise<string[]> =>
  laneEl(page, key)
    .locator(".card")
    .evaluateAll((cards) => cards.map((c) => (c as HTMLElement).dataset.id!));

/** The center of an element, in page coordinates. */
export async function center(l: Locator): Promise<{ x: number; y: number }> {
  const box = (await l.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses Alt and the mouse on a card and moves past the drag slop, so the drag has started. */
export async function grab(page: Page, id: string): Promise<void> {
  const from = await center(card(page, id));
  await page.mouse.move(from.x, from.y);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  await expect(page.locator(".drag-ghost")).toHaveText(id);
}

/** Ends a drag over a point, releasing the mouse and Alt. */
export async function dropAt(page: Page, at: { x: number; y: number }): Promise<void> {
  await page.mouse.move(at.x, at.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
}
