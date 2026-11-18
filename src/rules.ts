/**
 * Lane rules, read by Claude before it places or reorders tasks. Edit them when lanes change.
 */
export const RULES = `
- Lane A holds every release.
- A blocker comes before the task it blocks, in the same lane or earlier in time in another lane.
- Started tasks come first in a lane; umbrella tasks come last.
- Lane X holds the GitHub project issues.
`.trim();

/** The lane that holds every release. The arrange tools warn when one sits elsewhere. */
export const RELEASE_LANE = "A";
