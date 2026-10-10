import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { State } from "@expressive/mvc";

import { dispatch, isCall, resolve, verify, type Endpoint, type Seats } from "./call";
import { install } from "./context";

const at = (...pattern: string[]): Endpoint => ({ pattern, exports: async () => ({ calls: {}, classes: {} }) });

function request(url: string, name: string | undefined, body: string, type = "application/json", extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": type, ...extra };
  if (name) headers["x-expressive-call"] = name;
  return Object.assign(Readable.from([body]), { method: "POST", url, headers });
}

async function send(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false, seats?: Seats) {
  const res = { statusCode: 0, body: undefined as string | undefined, setHeader() {}, end(body?: string) { this.body = body; } };
  await dispatch(req as any, res as any, () => endpoints, dev, seats);
  return { status: res.statusCode, body: res.body && JSON.parse(res.body) };
}

describe("call endpoints", () => {
  const endpoints = [at("blog", ":slug"), at("blog", "new"), at("docs", "*"), at()];

  it("will match a path to the most specific sidecar", () => {
    expect(resolve(endpoints, ["blog", "new"])?.endpoint.pattern).toEqual(["blog", "new"]);
    expect(resolve(endpoints, ["blog", "hello"])?.endpoint.pattern).toEqual(["blog", ":slug"]);
    expect(resolve(endpoints, ["docs", "a", "b"])?.endpoint.pattern).toEqual(["docs", "*"]);
    expect(resolve(endpoints, [])?.endpoint.pattern).toEqual([]);
  });

  it("will bind a path's segments to the sidecar's pattern", () => {
    expect(resolve(endpoints, ["blog", "hello"])?.segments).toEqual(["blog", "hello"]);
    expect(resolve(endpoints, ["docs", "a", "b"])?.segments).toEqual(["docs", "a/b"]);
  });

  it("will not match a path no sidecar owns", () => {
    expect(resolve(endpoints, ["blog"])).toBeUndefined();
    expect(resolve(endpoints, ["blog", "a", "b"])).toBeUndefined();
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
    { pattern: ["shared"], exports: async () => ({ calls: {}, classes: { "/shared#Limit": Limit, "/shared#Strange": Strange } }) },
  ];

  it("will reply with a call's value as JSON", async () => {
    expect(await send(endpoints, request("/tally?x=1", "add", "[1, 2]"))).toEqual({ status: 200, body: 3 });
  });

  it("will reply 204 to undefined", async () => {
    expect(await send(endpoints, request("/tally", "none", "[]"))).toEqual({ status: 204, body: undefined });
  });

  it("will identify a call by method, name header and JSON body", () => {
    expect(isCall(request("/tally", "add", "[]") as any)).toBe(true);
    expect(isCall(request("/tally", undefined, "[]") as any)).toBe(false);
    expect(isCall(request("/tally", "add", "[]", "text/plain") as any)).toBe(false);
    expect(isCall(Object.assign(request("/tally", "add", "[]"), { method: "GET" }) as any)).toBe(false);
  });

  it("will reply 404 alike to an unknown path, an unknown name and a non-function", async () => {
    const missing = { status: 404, body: { message: "Not found." } };

    expect(await send(endpoints, request("/nope", "add", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "subtract", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "toString", "[]"))).toEqual(missing);
    expect(await send(endpoints, request("/tally", "value", "[]"))).toEqual(missing);
  });

  it("will reply 400 to a body that is not an array of arguments", async () => {
    const bad = { status: 400, body: { message: "Expected a JSON array of arguments." } };

    expect(await send(endpoints, request("/tally", "add", "{"))).toEqual(bad);
    expect(await send(endpoints, request("/tally", "add", "{}"))).toEqual(bad);
  });

  it("will hide a thrown error's message outside development", async () => {
    expect(await send(endpoints, request("/tally", "fail", "[]"))).toEqual({ status: 500, body: { message: "Internal error." } });

    const { body } = await send(endpoints, request("/tally", "fail", "[]"), true);
    expect(body.message).toBe("Nope");
    expect(body.stack).toContain("Error: Nope");
  });

  it("will send an exported error class's id, status and fields, even from a subclass", async () => {
    expect(await send(endpoints, request("/tally", "limit", "[]"))).toEqual({
      status: 409,
      body: { error: "/shared#Limit", message: "Over 3", status: 409, limit: 3 },
    });
  });

  it("will keep a status outside 4xx and 5xx to 500", async () => {
    expect((await send(endpoints, request("/tally", "strange", "[]"))).status).toBe(500);
  });
});

describe("seat dispatch", () => {
  class Tally extends State {
    static ttl = 60;
    total = 0;
    async add(by: number) { return (this.total += by); }
    async noop() {}
  }

  const seats: Seats = async pattern => (pattern.join("/") === "tally" ? Tally : undefined);
  const endpoints: Endpoint[] = [{
    pattern: ["tally"],
    exports: async () => ({ calls: {}, classes: {}, seat: { fields: ["total"], methods: { "default.add": "add", "default.noop": "noop" } } }),
  }];
  const pull = (extra: Record<string, string> = {}) => request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "default", ...extra });

  install();

  it("will reply to a pull with the seat's values and version", async () => {
    const { status, body } = await send(endpoints, pull(), false, seats);

    expect(status).toBe(200);
    expect(body).toEqual({ values: { total: 0 }, version: expect.stringMatching(/^[\w-]+:\d+$/) });
  });

  it("will reply to a method call with its value, the patch and the version", async () => {
    const before = (await send(endpoints, pull(), false, seats)).body.version;
    const { body } = await send(endpoints, request("/tally", "default.add", "[2]"), false, seats);

    expect(body).toEqual({ value: 2, patch: { total: 2 }, version: expect.any(String) });
    expect(body.version).not.toBe(before);

    const unchanged = await send(endpoints, request("/tally", "default.noop", "[]"), false, seats);
    expect(unchanged.body).toEqual({ value: undefined, patch: {}, version: body.version });
  });

  it("will reply 304 to a pull that holds the current version, else only what changed", async () => {
    const { version } = (await send(endpoints, pull(), false, seats)).body;

    expect((await send(endpoints, pull({ "if-none-match": version }), false, seats)).status).toBe(304);

    await send(endpoints, request("/tally", "default.add", "[1]"), false, seats);

    const { body } = await send(endpoints, pull({ "if-none-match": version }), false, seats);
    expect(body.values).toEqual({ total: expect.any(Number) });
  });

  it("will reply 404 to a pull of a folder without a seat, or naming anything but default", async () => {
    expect((await send([{ pattern: [], exports: async () => ({ calls: {}, classes: {} }) }], request("/", undefined, "[]", "application/json", { "x-expressive-get": "default" }))).status).toBe(404);
    expect((await send(endpoints, pull({ "x-expressive-get": "other" }), false, seats)).status).toBe(404);
  });

  it("will identify a pull as a call", () => {
    expect(isCall(pull() as any)).toBe(true);
  });
});

describe("verify", () => {
  it("will throw if an exported class is not an Error subclass", () => {
    expect(() => verify("/tally", { calls: {}, classes: { Ok: class extends Error {} } })).not.toThrow();
    expect(() => verify("/tally", { calls: {}, classes: { Bad: class {} } })).toThrow("/tally exports Bad, which is neither an async function nor an Error subclass.");
    expect(() => verify("/tally", { calls: {}, classes: { Odd: 1 } })).toThrow("exports Odd");
  });
});
