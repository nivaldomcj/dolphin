/** Bottom bar: what the colors and lines mean, and how hover works. Shown when the legend setting is on. */
export function Legend() {
  return (
    <footer class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-300 bg-base-200 px-4 py-2 text-xs text-base-content/60">
      <span>
        <span class="sw" style={{ "--fill": "var(--s-progress)" }} />
        In Progress
      </span>
      <span>
        <span class="sw" style={{ "--fill": "var(--s-blocked)" }} />
        Blocked
      </span>
      <span>
        <span class="sw" style={{ "--fill": "var(--s-todo)" }} />
        Todo
      </span>
      <span>
        <span class="sw" style={{ "--fill": "var(--s-done)" }} />
        Review / Done
      </span>
      <span>
        <span class="sw dash" />
        Umbrella
      </span>
      <span>
        <span class="ln" style={{ borderColor: "var(--seq)" }} />
        Next in lane
      </span>
      <span>
        <span class="ln" style={{ borderColor: "var(--blk)" }} />
        Blocker
      </span>
      <span class="ml-auto">Hover a card: red ring = its blockers, green ring = tasks it blocks. Click opens it.</span>
    </footer>
  );
}
