import { afterAll, afterEach, beforeAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/preact";

/**
 * Gives this test file a browser DOM (happy-dom) for its duration. Call it at the top of every web test file, before
 * any test. After each test it unmounts what was rendered, empties the page and localStorage, and restores a stubbed
 * fetch. The DOM is removed afterwards, so the server tests keep Bun's own fetch, Request and Response.
 *
 * Query through what `render` returns, not `screen`: `screen` binds to the document at import time, before this runs.
 */
export function useDom(url = "http://localhost:4747/"): void {
  beforeAll(() => GlobalRegistrator.register({ url }));
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
    // A test that stubbed fetch with spyOn gets the real one back.
    (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
  });
  afterAll(() => GlobalRegistrator.unregister());
}

/**
 * Puts a lane in the page the way `Lane` renders it, for `targetAt` to find: a header button and a `.cards` row whose
 * cards are 100px wide side by side (card i spans x = i*100 .. i*100+100). happy-dom has no layout, so the card
 * boxes are stubbed.
 */
export function laneInDom(key: string, cardIds: string[], { collapsed = false } = {}): HTMLElement {
  const el = document.createElement("div");
  el.className = `lane${collapsed ? " collapsed" : ""}`;
  el.dataset.lane = key;
  el.innerHTML = `<button class="lane-head">head</button><div class="cards"></div>`;
  const cards = el.querySelector(".cards")!;
  cardIds.forEach((id, i) => {
    const a = document.createElement("a");
    a.className = "card";
    a.dataset.id = id;
    a.getBoundingClientRect = () => ({
      left: i * 100,
      width: 100,
      right: i * 100 + 100,
      top: 0,
      bottom: 20,
      height: 20,
      x: i * 100,
      y: 0,
      toJSON() {},
    });
    cards.appendChild(a);
  });
  document.body.appendChild(el);
  return el;
}
