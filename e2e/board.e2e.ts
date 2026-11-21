import { card, center, dropAt, expect, grab, laneEl, laneIds, test } from "./fixtures";

test("the demo board loads with its lanes, cards and arrows", async ({ board: page }) => {
  await expect(page.locator(".lane")).toHaveCount(6);
  expect(await laneIds(page, "A")).toEqual(["ENG-101", "ENG-108", "ENG-112", "ENG-115"]);
  expect(await laneIds(page, "N")).toEqual(["ENG-160"]);
  // 13 sequence lines between neighbors (3+3+2+2+3) and the one cross-lane blocker. The four in-lane blockers are
  // off by default.
  await expect(page.locator("svg.arrows > path")).toHaveCount(14);
});

test("an Alt + drag into another lane saves the move", async ({ board: page }) => {
  await grab(page, "ENG-160");
  const last = await center(card(page, "ENG-131"));
  await dropAt(page, { x: last.x + 120, y: last.y });

  await expect.poll(() => laneIds(page, "B")).toEqual(["ENG-120", "ENG-124", "ENG-127", "ENG-131", "ENG-160"]);
  // Lane N empties, so it goes away.
  await expect(laneEl(page, "N")).toHaveCount(0);

  await page.reload();
  await expect.poll(() => laneIds(page, "B")).toEqual(["ENG-120", "ENG-124", "ENG-127", "ENG-131", "ENG-160"]);
});

test("dropping before a card puts it there, inside the same lane", async ({ board: page }) => {
  await grab(page, "ENG-147");
  const first = await center(card(page, "ENG-140"));
  await dropAt(page, { x: first.x - 40, y: first.y });

  await expect.poll(() => laneIds(page, "C")).toEqual(["ENG-147", "ENG-140", "ENG-143"]);
  await page.reload();
  await expect.poll(() => laneIds(page, "C")).toEqual(["ENG-147", "ENG-140", "ENG-143"]);
});

test("Esc cancels a drag and the board does not change", async ({ board: page }) => {
  await grab(page, "ENG-160");
  const target = await center(card(page, "ENG-131"));
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Alt");

  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  await page.reload();
  await expect.poll(() => laneIds(page, "N")).toEqual(["ENG-160"]);
});

test("a plain click opens the card's link; an Alt click does not", async ({ board: page }) => {
  await card(page, "ENG-160").click({ modifiers: ["Alt"] });
  await page.waitForTimeout(300);
  expect(page.context().pages()).toHaveLength(1);

  const popup = page.waitForEvent("popup");
  await card(page, "ENG-160").click();
  expect((await popup).url()).toBe("https://linear.app/acme/issue/ENG-160");
  await (await popup).close();
});

test("holding a drag near the board's edge scrolls it", async ({ board: page }) => {
  await page.setViewportSize({ width: 700, height: 420 });
  const scroller = page.locator(".scroller");
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);

  await grab(page, "ENG-101");
  const box = (await scroller.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10, { steps: 5 });

  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Alt");
});

test("a search match in a collapsed lane opens the lane and scrolls to the card", async ({ board: page }) => {
  await page.setViewportSize({ width: 700, height: 420 });
  await laneEl(page, "X").locator(".lane-head").click();
  await expect(laneEl(page, "X")).toHaveClass(/collapsed/);

  await page.keyboard.press("ControlOrMeta+f");
  await page.getByPlaceholder("Search ID, title or app").fill("changelog");

  await expect(laneEl(page, "X")).not.toHaveClass(/collapsed/);
  await expect(card(page, "SITE-19")).toHaveClass(/current/);
  await expect(card(page, "SITE-19")).toBeInViewport();
  await expect(page.getByText("1/1")).toBeVisible();
});

test("hovering a card shows its tip, kept inside the window", async ({ board: page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await card(page, "ENG-108").hover();

  const tip = page.locator(".tip");
  await expect(tip).toContainText("ENG-108 · In Progress");
  await expect(tip).toContainText("Blocks: ENG-112, ENG-155");
  await expect(card(page, "ENG-112")).toHaveClass(/rel-down/);

  // Near the window's right edge the tip flips to the pointer's left, and stays on screen.
  await page.evaluate(() => document.querySelector(".scroller")!.scrollTo(10_000, 10_000));
  const site19 = (await card(page, "SITE-19").boundingBox())!;
  const pointer = { x: site19.x + site19.width - 5, y: site19.y + site19.height / 2 };
  expect(pointer.x).toBeGreaterThan(900 - 300);
  await page.mouse.move(pointer.x, pointer.y);
  await expect(tip).toContainText("SITE-19");
  const box = (await tip.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(pointer.x);
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(900 - 8 + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(600 - 8 + 1);
});

test("refresh in demo mode calls no tracker and reports up to date", async ({ board: page }) => {
  await page.getByLabel("Refresh").click();
  await expect(page.getByText("Up to date")).toBeVisible();
});

test("the closed settings panel covers no card", async ({ board: page }) => {
  await page.setViewportSize({ width: 900, height: 600 });

  const covered = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".card")]
      .filter((c) => {
        const r = c.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        // Only cards on screen can be under the panel.
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
        return document.elementFromPoint(x, y)?.closest(".card") !== c;
      })
      .map((c) => c.dataset.id),
  );
  expect(covered).toEqual([]);
});

test("a drop in the empty space at the end of a lane puts the card last", async ({ board: page }) => {
  await grab(page, "ENG-160");
  const lane = (await laneEl(page, "A").boundingBox())!;
  // Far right of lane A, where the closed settings panel used to sit.
  await dropAt(page, { x: lane.x + lane.width - 40, y: lane.y + lane.height / 2 });

  await expect.poll(() => laneIds(page, "A")).toEqual(["ENG-101", "ENG-108", "ENG-112", "ENG-115", "ENG-160"]);
});

test("the settings panel opens and its switches still work", async ({ board: page }) => {
  await page.getByLabel("Settings").click();
  await page.getByLabel("in-lane blockers: on").click();

  // The four in-lane blockers join the 14 arrows.
  await expect(page.locator("svg.arrows > path")).toHaveCount(18);
});
