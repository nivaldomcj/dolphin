/** Card fill per status, for Linear and for the UNI GitHub board. Unknown statuses render as Todo. */
const FILL: Record<string, string> = {
  "In Progress": "var(--s-progress)",
  Doing: "var(--s-progress)",
  Blocked: "var(--s-blocked)",
  Stuck: "var(--s-blocked)",
  "In Review": "var(--s-done)",
  Done: "var(--s-done)",
  Review: "var(--s-done)",
};

export const statusFill = (status: string): string => FILL[status] ?? "var(--s-todo)";
