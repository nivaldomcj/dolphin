// Copy to dolphin.config.ts (git-ignored) and fill in your own values.
import { defineConfig } from "./src/define-config";

export default defineConfig({
  linear: true,

  // Remove this block if you do not track a GitHub project.
  github: {
    owner: "example-org",
    number: 1,
    login: "your-github-login",
    repo: "example-org/example-repo",
    prefix: "REPO",
    open: ["Backlog", "Todo", "Doing", "Stuck", "Review"],
  },

  // Card fill for the GitHub column names. Linear's own names already have one.
  tones: { Doing: "progress", Stuck: "blocked", Review: "done", Shipped: "done" },

  // Your employer, client and project names. Commits that contain them are refused.
  denylist: ["acme-corp", /\bSECRET-\d+/],

  backup: { dir: `${Bun.env.HOME}/Library/Mobile Documents/com~apple~CloudDocs/dolphin`, keep: 14 },
});
