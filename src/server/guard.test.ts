import { describe, expect, test } from "bun:test";
import { makeGuard } from "./guard";

const ok = () => new Response("ok");
const call = (port: number, headers: Record<string, string>) => (makeGuard(() => port)(ok)(new Request("http://x/", { method: "POST", headers })) as Response).status;

describe("guard", () => {
  test("allows dolphin's own names on its port, with or without an Origin", () => {
    expect(call(4747, { host: "dolphin.localhost:4747", origin: "http://dolphin.localhost:4747" })).toBe(200);
    expect(call(4747, { host: "127.0.0.1:4747" })).toBe(200);
    expect(call(4747, { host: "LOCALHOST:4747" })).toBe(200);
  });

  test("rejects a foreign Host, a foreign Origin and another port", () => {
    expect(call(4747, { host: "evil.example:4747" })).toBe(403);
    expect(call(4747, { host: "localhost:4747", origin: "http://evil.example" })).toBe(403);
    expect(call(4747, { host: "localhost:8080" })).toBe(403);
  });

  test("on port 80 accepts the bare names browsers send", () => {
    expect(call(80, { host: "dolphin.localhost", origin: "http://dolphin.localhost" })).toBe(200);
  });
});
