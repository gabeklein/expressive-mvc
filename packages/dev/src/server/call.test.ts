import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { get, State } from "@expressive/mvc";

import { dispatch, isCall, resolve, verify, type Endpoint, type Seats } from "./call";
import { install } from "./context";

const at = (...pattern: string[]): Endpoint => ({ pattern, exports: async () => ({ calls: {}, classes: {} }) });

const TAB = crypto.randomUUID();

function request(url: string, name: string | undefined, body: string, type = "application/json", extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": type, "x-expressive-connection": TAB, ...extra };
  if (name) headers["x-expressive-call"] = name;
  return Object.assign(Readable.from([body]), { method: "POST", url, headers });
}

async function sent(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false, seats?: Seats) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: undefined as string | undefined,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(body?: string) { this.body = body; },
  };

  await dispatch(req as any, res as any, () => endpoints, dev, seats);
  return { status: res.statusCode, body: res.body && JSON.parse(res.body), headers };
}

async function send(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false, seats?: Seats) {
  const { status, body } = await sent(endpoints, req, dev, seats);
  return { status, body };
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

  it("will reply with a call's value and the tab's frame", async () => {
    expect(await send(endpoints, request("/tally?x=1", "add", "[1, 2]"))).toEqual({ status: 200, body: { value: 3, frame: {} } });
  });

  it("will leave out an undefined value", async () => {
    expect(await send(endpoints, request("/tally", "none", "[]"))).toEqual({ status: 200, body: { frame: {} } });
  });

  it("will reply 400 to a call without a connection id", async () => {
    const bad = { status: 400, body: { message: "Expected an x-expressive-connection id." } };
    const { "x-expressive-connection": _, ...headers } = request("/tally", "add", "[]").headers;

    expect(await send(endpoints, request("/tally", "add", "[]", "application/json", { "x-expressive-connection": "tab" }))).toEqual(bad);
    expect(await send(endpoints, Object.assign(request("/tally", "add", "[]"), { headers }))).toEqual(bad);
  });

  it("will name the connection's epoch on every reply", async () => {
    const first = await sent(endpoints, request("/tally", "add", "[1, 2]"));
    const failed = await sent(endpoints, request("/tally", "fail", "[]"));

    expect(first.headers["x-expressive-epoch"]).toMatch(/^[\w-]{8}$/);
    expect(failed.headers["x-expressive-epoch"]).toBe(first.headers["x-expressive-epoch"]);
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
  class Visits extends State {
    static ttl = 60;
    count = 0;
  }

  class Tally extends State {
    static ttl = 60;
    total = 0;
    visits = get(Visits);
    async add(by: number) { this.visits.count++; return (this.total += by); }
    async noop() {}
  }

  const seats: Seats = async pattern => ({ "": Visits, tally: Tally } as Record<string, State.Type>)[pattern.join("/")] as any;
  const endpoints: Endpoint[] = [
    {
      pattern: [],
      exports: async () => ({ calls: {}, classes: {}, seat: { fields: ["count"], methods: {} } }),
    },
    {
      pattern: ["tally"],
      exports: async () => ({
        calls: { bump: async () => { Tally.get().total++; } },
        classes: {},
        seat: { fields: ["total"], methods: { "default.add": "add", "default.noop": "noop" } },
      }),
    },
  ];

  function tab() {
    const id = crypto.randomUUID();
    const headers = (extra: Record<string, string | undefined>) =>
      Object.fromEntries(Object.entries({ "x-expressive-connection": id, ...extra }).filter(([, value]) => value)) as Record<string, string>;

    return {
      pull: (url = "/tally", version?: string) =>
        send(endpoints, request(url, undefined, "[]", "application/json", headers({ "x-expressive-get": "default", "if-none-match": version })), false, seats),
      call: (name: string, args = "[]", extra: Record<string, string | undefined> = {}) =>
        send(endpoints, request("/tally", name, args, "application/json", headers(extra)), false, seats),
    };
  }

  install();

  it("will reply to a pull with the seat's slot, values and version", async () => {
    const { status, body } = await tab().pull();

    expect(status).toBe(200);
    expect(body).toEqual({ slot: 1, values: { total: expect.any(Number) }, version: expect.stringMatching(/^[\w-]+:\d+$/) });
  });

  it("will open a slot per pull", async () => {
    const { pull } = tab();

    expect((await pull("/tally")).body.slot).toBe(1);
    expect((await pull("/")).body.slot).toBe(2);
    expect((await pull("/tally")).body.slot).toBe(3);
  });

  it("will pull only what changed since the version sent", async () => {
    const { pull, call } = tab();
    const { version } = (await pull()).body;

    expect((await pull("/tally", version)).body).toEqual({ slot: 2, values: {}, version });

    await call("default.add", "[1]");

    expect((await pull("/tally", version)).body.values).toEqual({ total: expect.any(Number) });
  });

  it("will reply to a method call with its value and a frame of every slot it moved", async () => {
    const { pull, call } = tab();
    const tally = (await pull("/tally")).body;
    const visits = (await pull("/")).body;
    const { body } = await call("default.add", "[2]", { "x-expressive-slot": "1", "if-none-match": tally.version });

    expect(body).toEqual({
      value: tally.values.total + 2,
      frame: {
        1: { patch: { total: tally.values.total + 2 }, version: expect.any(String) },
        2: { patch: { count: visits.values.count + 1 }, version: expect.any(String) },
      },
    });

    expect((await call("default.noop", "[]", { "x-expressive-slot": "1", "if-none-match": body.frame[1].version })).body).toEqual({ frame: {} });
  });

  it("will patch a method call with changes the caller missed", async () => {
    const mine = tab();
    const { version } = (await mine.pull()).body;
    const other = (await tab().call("default.add", "[3]")).body;
    const { body } = await mine.call("default.noop", "[]", { "x-expressive-slot": "1", "if-none-match": version });

    expect(body.frame[1]).toEqual({ patch: { total: other.value }, version: expect.any(String) });
  });

  it("will patch every field of the calling slot without a version, and no slot it does not hold", async () => {
    const mine = tab();
    await mine.pull();
    await mine.pull();

    const { body } = await mine.call("default.noop", "[]", { "x-expressive-slot": "2" });

    expect(body.frame).toEqual({ 2: { patch: { total: expect.any(Number) }, version: expect.any(String) } });
    expect((await tab().call("default.noop", "[]", { "x-expressive-slot": "1" })).body).toEqual({ frame: {} });
  });

  it("will frame a plain call's changes to the slots the tab holds", async () => {
    const { pull, call } = tab();
    const { values, version } = (await pull()).body;

    expect((await call("bump")).body).toEqual({ frame: { 1: { patch: { total: values.total + 1 }, version: expect.not.stringMatching(version) } } });
    expect((await tab().call("bump")).body).toEqual({ frame: {} });
  });

  it("will drop the slots a request releases", async () => {
    const { pull, call } = tab();
    await pull("/tally");
    await pull("/");

    const { body } = await call("default.add", "[1]", { "x-expressive-release": "2,9" });

    expect(Object.keys(body.frame)).toEqual(["1"]);
    expect((await pull("/")).body.slot).toBe(3);
  });

  it("will reply 404 to a pull of a folder without a seat, or naming anything but default", async () => {
    expect((await send([{ pattern: ["x"], exports: async () => ({ calls: {}, classes: {} }) }], request("/x", undefined, "[]", "application/json", { "x-expressive-get": "default" }))).status).toBe(404);
    expect((await send(endpoints, request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "other" }), false, seats)).status).toBe(404);
  });

  it("will identify a pull as a call", () => {
    expect(isCall(request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "default" }) as any)).toBe(true);
  });
});

describe("verify", () => {
  it("will throw if an exported class is not an Error subclass", () => {
    expect(() => verify("/tally", { calls: {}, classes: { Ok: class extends Error {} } })).not.toThrow();
    expect(() => verify("/tally", { calls: {}, classes: { Bad: class {} } })).toThrow("/tally exports Bad, which is neither an async function nor an Error subclass.");
    expect(() => verify("/tally", { calls: {}, classes: { Odd: 1 } })).toThrow("exports Odd");
  });
});
