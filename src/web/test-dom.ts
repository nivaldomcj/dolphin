import { afterAll, afterEach, beforeAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/preact";

/**
 * Gives this test file a browser DOM (happy-dom) for its duration. Call it at the top of every web test file, before
 * any test. The DOM is removed afterwards, so the server tests keep Bun's own fetch, Request and Response.
 *
 * Query through what `render` returns, not `screen`: `screen` binds to the document at import time, before this runs.
 */
export function useDom(url = "http://localhost:4747/"): void {
  beforeAll(() => GlobalRegistrator.register({ url }));
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    localStorage.clear();
  });
  afterAll(() => GlobalRegistrator.unregister());
}
