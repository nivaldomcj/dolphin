import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/** Clear of the usual server (4747) and `bun run demo` (4750), so a running dolphin is never touched. */
const PORT = 4791;
/** A demo database of the run's own, re-seeded before every test (see `fixtures.ts`). */
export const DB = join(tmpdir(), `dolphin-e2e-${PORT}.db`);
export const ENV = { DOLPHIN_DB: DB, DOLPHIN_DEMO: "1", DOLPHIN_CONFIG: "dolphin.config.example.ts", PORT: String(PORT) };

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  // One server and one database: tests run one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    // Your installed Chrome, so Playwright downloads no browser.
    channel: "chrome",
    headless: true,
    // *.localhost names resolve to this machine in Chrome, and the server's guard accepts this one.
    baseURL: `http://dolphin.localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "bun src/scripts/seed-demo.ts && exec bun src/server/index.ts",
    cwd: join(import.meta.dirname, ".."),
    env: ENV,
    url: `http://127.0.0.1:${PORT}/`,
    // Never attach to a server someone else started on this port.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
