import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { dispatch, endpoint, verify, type Endpoint } from "./call";

const at = (...pattern: string[]): Endpoint => ({ pattern, exports: async () => ({ calls: {}, classes: {} }) });

function request(url: string, name: string | undefined, body: string, type = "application/json") {
  const headers: Record<string, string> = { "content-type": type };
  if (name) headers["x-expressive-call"] = name;
  return Object.assign(Readable.from([body]), { method: "POST", url, headers });
}

async function send(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false) {
  const res = { statusCode: 0, body: undefined as string | undefined, setHeader() {}, end(body?: string) { this.body = body; } };
  const handled = await dispatch(req as any, res as any, () => endpoints, dev);
  return { handled, status: res.statusCode, body: res.body && JSON.parse(res.body) };
}

describe("call endpoints", () => {
  const endpoints = [at("blog", ":slug"), at("blog", "new"), at("docs", "*"), at()];

  it("will match a path to the most specific sidecar", () => {
    expect(endpoint(endpoints, ["blog", "new"])?.pattern).toEqual(["blog", "new"]);
    expect(endpoint(endpoints, ["blog", "hello"])?.pattern).toEqual(["blog", ":slug"]);
    expect(endpoint(endpoints, ["docs", "a", "b"])?.pattern).toEqual(["docs", "*"]);
    expect(endpoint(endpoints, [])?.pattern).toEqual([]);
  });

  it("will not match a path no sidecar owns", () => {
    expect(endpoint(endpoints, ["blog"])).toBeUndefined();
    expect(endpoint(endpoints, ["blog", "a", "b"])).toBeUndefined();
  });
});

describe("call dispatch", () => {
  const calls: Record<string, unknown> = {
    add: async (a: number, b: number) => a + b,
    none: async () => {},
    fail: async () => { throw new Error("Nope"); },
    value: 1,
  };
  class Limit extends Error {
    status = 409;
    constructor(public limit: number) { super(`Over ${limit}`); }
  }
  class Hard extends Limit {}
  class Strange extends Error { status = 200; }

  calls.limit = async () => { throw new Hard(3); };
  calls.strange = async () => { throw new Strange("Odd"); };

  const endpoints: Endpoint[] = [
    { pattern: ["tally"], exports: async () => ({ calls, classes: {} }) },
    { pattern: ["shared"], exports: async () => ({ calls: {}, classes: { Limit, Strange } }) },
  ];

  it("will reply with a call's value as JSON", async () => {
    expect(await send(endpoints, request("/tally?x=1", "add", "[1, 2]"))).toEqual({ handled: true, status: 200, body: 3 });
  });

  it("will reply 204 to undefined", async () => {
    expect(await send(endpoints, request("/tally", "none", "[]"))).toEqual({ handled: true, status: 204, body: undefined });
  });

  it("will pass on a request that is not a call", async () => {
    expect((await send(endpoints, request("/tally", undefined, "[]"))).handled).toBe(false);
    expect((await send(endpoints, request("/tally", "add", "[]", "text/plain"))).handled).toBe(false);
    expect((await send(endpoints, Object.assign(request("/tally", "add", "[]"), { method: "GET" }))).handled).toBe(false);
  });

  it("will reply 404 alike to an unknown path, an unknown name and a non-function", async () => {
    const missing = { handled: true, status: 404, body: { message: "Not found." } };

    expect(await send(endpoints, request("/nope", "add", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "subtract", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "toString", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "value", "[]"))).toEqual(missing);
  });

  it("will reply 400 to a body that is not an array of arguments", async () => {
    const bad = { handled: true, status: 400, body: { message: "Expected a JSON array of arguments." } };

    expect(await send(endpoints, request("/tally", "add", "{"))).toEqual(bad);
    expect(await send(endpoints, request("/tally", "add", "{}"))).toEqual(bad);
  });

  it("will hide a thrown error's message outside development", async () => {
    expect(await send(endpoints, request("/tally", "fail", "[]"))).toEqual({ handled: true, status: 500, body: { message: "Internal error." } });

    const { body } = await send(endpoints, request("/tally", "fail", "[]"), true);
    expect(body.message).toBe("Nope");
    expect(body.stack).toContain("Error: Nope");
  });

  it("will send an exported error class's id, status and fields, even from a subclass", async () => {
    expect(await send(endpoints, request("/tally", "limit", "[]"))).toEqual({
      handled: true,
      status: 409,
      body: { error: "/shared#Limit", message: "Over 3", status: 409, limit: 3 },
    });
  });

  it("will keep a status outside 4xx and 5xx to 500", async () => {
    expect((await send(endpoints, request("/tally", "strange", "[]"))).status).toBe(500);
  });
});

describe("verify", () => {
  it("will throw if an exported class is not an Error subclass", () => {
    expect(() => verify("/tally", { calls: {}, classes: { Ok: class extends Error {} } })).not.toThrow();
    expect(() => verify("/tally", { calls: {}, classes: { Bad: class {} } })).toThrow("/tally exports Bad, which is neither an async function nor an Error subclass.");
    expect(() => verify("/tally", { calls: {}, classes: { Odd: 1 } })).toThrow("exports Odd");
  });
});
