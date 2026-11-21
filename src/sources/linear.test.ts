import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { fetchLinear, toCycle } from "./linear";

const savedKey = Bun.env.LINEAR_API_KEY;
beforeAll(() => {
  Bun.env.LINEAR_API_KEY = "test-key";
});
afterAll(() => {
  if (savedKey === undefined) delete Bun.env.LINEAR_API_KEY;
  else Bun.env.LINEAR_API_KEY = savedKey;
});

type Reply = { status?: number; body: unknown };

/** Answers the lookup queries with `lookups` in order, then one page of assigned issues (or `assignedReply`). */
function mockLinear(lookups: Reply[], assigned: unknown[] = [], assignedReply?: Reply) {
  const replies = [
    ...lookups,
    assignedReply ?? {
      body: { data: { viewer: { id: "me", assignedIssues: { nodes: assigned, pageInfo: { hasNextPage: false, endCursor: null } } } } },
    },
  ];
  return spyOn(globalThis, "fetch").mockImplementation((async () => {
    const r = replies.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch);
}

const me = { id: "me", name: "Me" };
const issue = (id: string, uuid = `uuid-${id}`, assignee: { id: string; name: string } | null = me) => ({
  id: uuid,
  identifier: id,
  title: id,
  url: `https://linear.app/x/${id}`,
  state: { name: "Todo", type: "unstarted" },
  assignee,
});
const notFound = (alias: string) => ({ message: "Entity not found: Issue", path: [alias] });

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

test("drops the ids Linear reports not found and asks again for the rest", async () => {
  const spy = mockLinear([
    { status: 400, body: { data: null, errors: [notFound("i1")] } },
    { body: { data: { i0: issue("A-1"), i1: issue("A-3") } } },
  ]);

  const result = await fetchLinear(["A-1", "A-2", "A-3"]);

  expect(result.missing).toEqual(["A-2"]);
  expect(result.facts.map((f) => f.id)).toEqual(["A-1", "A-3"]);
  expect(spy).toHaveBeenCalledTimes(3);
});

test("a not-found error without a usable alias fails instead of guessing or looping", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [{ message: "Entity not found: Issue" }] } }]);
  await expect(fetchLinear(["A-1"])).rejects.toThrow("Linear API 400: Entity not found: Issue");
});

test("an alias outside the batch fails instead of looping", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [notFound("i9")] } }]);
  await expect(fetchLinear(["A-1"])).rejects.toThrow("Linear API 400");
});

test("a not-found on a nested field fails instead of closing the issue", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [{ message: "Entity not found: WorkflowState", path: ["i0", "state"] }] } }]);
  await expect(fetchLinear(["A-1"])).rejects.toThrow("Linear API 400");
});

test("an issue moved to another team stays under the id the board asked for, without a second card", async () => {
  mockLinear([{ body: { data: { i0: issue("B-9", "u1") } } }], [issue("B-9", "u1")]);

  const result = await fetchLinear(["A-1"]);

  expect(result.facts.map((f) => [f.id, f.url])).toEqual([["A-1", "https://linear.app/x/B-9"]]);
});

test("an id the assigned list returns is not reported missing", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [notFound("i0")] } }], [issue("A-1")]);

  const result = await fetchLinear(["A-1"]);

  expect(result.missing).toEqual([]);
  expect(result.facts.map((f) => f.id)).toEqual(["A-1"]);
});

test("an issue that moves team between the two queries is still one card", async () => {
  mockLinear([{ body: { data: { i0: issue("A-1", "u1") } } }], [issue("B-9", "u1")]);

  expect((await fetchLinear(["A-1"])).facts.map((f) => f.id)).toEqual(["A-1"]);
});

test("an alias that only looks like one in the batch (i01) fails instead of closing i1", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [notFound("i01")] } }]);
  await expect(fetchLinear(["A-1", "A-2"])).rejects.toThrow("Linear API 400");
});

test("a failing assigned page keeps the confirmed lookups and reports the error, closing nothing", async () => {
  mockLinear([{ status: 400, body: { data: null, errors: [notFound("i1")] } }, { body: { data: { i0: issue("A-1") } } }], [], {
    status: 502,
    body: { errors: [{ message: "Bad gateway" }] },
  });

  const result = await fetchLinear(["A-1", "A-2"]);

  expect(result).toMatchObject({ missing: [], error: "Linear API 502: Bad gateway" });
  expect(result.facts.map((f) => f.id)).toEqual(["A-1"]);
});

test("a failure before anything is confirmed still fails the whole fetch", async () => {
  mockLinear([{ status: 500, body: { errors: [{ message: "boom" }] } }]);
  await expect(fetchLinear(["A-1"])).rejects.toThrow("Linear API 500: boom");
});

test("a known issue now assigned to someone else, or to nobody, is marked reassigned", async () => {
  mockLinear([
    { body: { data: { i0: issue("A-1"), i1: issue("A-2", undefined, { id: "sam", name: "Sam" }), i2: issue("A-3", undefined, null) } } },
  ]);

  const { facts } = await fetchLinear(["A-1", "A-2", "A-3"]);

  expect(facts.map((f) => [f.id, f.reassignedTo])).toEqual([
    ["A-1", undefined],
    ["A-2", "Sam"],
    ["A-3", null],
  ]);
});

test("an issue the later assigned list still returns is not marked reassigned", async () => {
  mockLinear([{ body: { data: { i0: issue("A-1", "u1", { id: "sam", name: "Sam" }) } } }], [issue("A-1", "u1")]);

  expect((await fetchLinear(["A-1"])).facts[0]?.reassignedTo).toBeUndefined();
});

test("a failing assigned page marks nothing reassigned, since it never confirmed who the viewer is", async () => {
  mockLinear([{ body: { data: { i0: issue("A-1", undefined, { id: "sam", name: "Sam" }) } } }], [], {
    status: 502,
    body: { errors: [{ message: "Bad gateway" }] },
  });

  const result = await fetchLinear(["A-1"]);

  expect(result.error).toBe("Linear API 502: Bad gateway");
  expect(result.facts[0]?.reassignedTo).toBeUndefined();
});

const flags = { isActive: false, isNext: false, isPast: false, isFuture: false, completedAt: null };

test("maps Linear's cycle flags to one state", () => {
  expect(toCycle(null)).toBeNull();
  expect(toCycle({ ...flags, number: 41, isActive: true })).toEqual({ number: 41, state: "current" });
  // The next cycle is also flagged as future.
  expect(toCycle({ ...flags, number: 42, isNext: true, isFuture: true })).toEqual({ number: 42, state: "next" });
  expect(toCycle({ ...flags, number: 43, isFuture: true })).toEqual({ number: 43, state: "future" });
  expect(toCycle({ ...flags, number: 40, isPast: true, completedAt: "2026-11-16T00:05:46.868Z" })).toEqual({ number: 40, state: "past" });
});

test("a cycle completed before its scheduled end is past, not future", () => {
  expect(toCycle({ ...flags, number: 41, completedAt: "2026-11-25T12:00:00.000Z" })).toEqual({ number: 41, state: "past" });
});

test("a cycle no flag places is past", () => {
  expect(toCycle({ ...flags, number: 7 })).toEqual({ number: 7, state: "past" });
});
