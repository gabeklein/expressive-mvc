import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { get, State } from "@expressive/mvc";

import { DETACHED, dispatch, isCall, resolve, verify, walkOf, type Endpoint, type Seats } from "./call";
import { connect, listen } from "./connection";
import { Current, install } from "./context";

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
    async slow() { this.total++; await new Promise(resolve => setTimeout(resolve, 5)); }
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
        seat: { fields: ["total"], methods: { "default.add": "add", "default.noop": "noop", "default.slow": "slow" } },
      }),
    },
  ];

  function tab() {
    const id = crypto.randomUUID();
    const headers = (extra: Record<string, string | undefined>) =>
      Object.fromEntries(Object.entries({ "x-expressive-connection": id, ...extra }).filter(([, value]) => value)) as Record<string, string>;

    return {
      pull: (twin = "Tally-A", url = "/tally", version?: string) =>
        send(endpoints, request(url, undefined, "[]", "application/json", headers({ "x-expressive-get": "default", "x-expressive-twin": twin, "if-none-match": version })), false, seats),
      call: (name: string, args = "[]", extra: Record<string, string | undefined> = {}) =>
        send(endpoints, request("/tally", name, args, "application/json", headers(extra)), false, seats),
    };
  }

  install();

  it("will reply to a pull with the seat's values and version", async () => {
    const { status, body } = await tab().pull();

    expect(status).toBe(200);
    expect(body).toEqual({ values: { total: expect.any(Number) }, version: expect.stringMatching(/^[\w-]+:\d+$/) });
  });

  it("will reply 400 to a pull or method call without a twin id", async () => {
    const bad = { status: 400, body: { message: "Expected an x-expressive-twin id." } };
    const { pull, call } = tab();

    expect(await pull("")).toEqual(bad);
    expect(await pull("a,b")).toEqual(bad);
    expect(await call("default.noop")).toEqual(bad);
  });

  it("will reply 304 to a pull that holds the current version, else only what changed", async () => {
    const { pull, call } = tab();
    const { version } = (await pull()).body;

    expect((await pull("Tally-A", "/tally", version)).status).toBe(304);

    await call("default.add", "[1]", { "x-expressive-twin": "Tally-A" });

    expect((await pull("Tally-A", "/tally", version)).body.values).toEqual({ total: expect.any(Number) });
  });

  it("will reply to a method call with its value and a frame of every twin it moved", async () => {
    const { pull, call } = tab();
    const tally = (await pull("Tally-A")).body;
    const visits = (await pull("Visits-B", "/")).body;
    const { body } = await call("default.add", "[2]", { "x-expressive-twin": "Tally-A", "if-none-match": tally.version });

    expect(body).toEqual({
      value: tally.values.total + 2,
      frame: {
        "Tally-A": { patch: { total: tally.values.total + 2 }, version: expect.any(String) },
        "Visits-B": { patch: { count: visits.values.count + 1 }, version: expect.any(String) },
      },
    });

    const again = await call("default.noop", "[]", { "x-expressive-twin": "Tally-A", "if-none-match": body.frame["Tally-A"].version });
    expect(again.body).toEqual({ frame: {} });
  });

  it("will frame each twin of the same seat on its own", async () => {
    const { pull, call } = tab();
    await pull("Tally-A");
    await pull("Tally-B");

    const { body } = await call("default.add", "[1]", { "x-expressive-twin": "Tally-A" });

    expect(Object.keys(body.frame)).toEqual(["Tally-A", "Tally-B"]);
    expect(body.frame["Tally-B"].patch).toEqual(body.frame["Tally-A"].patch);
  });

  it("will patch a method call with changes the caller missed", async () => {
    const mine = tab();
    const { version } = (await mine.pull()).body;
    const other = (await tab().call("default.add", "[3]", { "x-expressive-twin": "Tally-Z" })).body;
    const { body } = await mine.call("default.noop", "[]", { "x-expressive-twin": "Tally-A", "if-none-match": version });

    expect(body.frame["Tally-A"]).toEqual({ patch: { total: other.value }, version: expect.any(String) });
  });

  it("will hold a twin a method call names, patching every field without a version", async () => {
    const { body } = await tab().call("default.noop", "[]", { "x-expressive-twin": "Tally-A" });
    expect(body.frame).toEqual({ "Tally-A": { patch: { total: expect.any(Number) }, version: expect.any(String) } });
  });

  it("will frame a plain call's changes to the twins the tab holds", async () => {
    const { pull, call } = tab();
    const { values, version } = (await pull()).body;

    expect((await call("bump")).body).toEqual({ frame: { "Tally-A": { patch: { total: values.total + 1 }, version: expect.not.stringMatching(version) } } });
    expect((await tab().call("bump")).body).toEqual({ frame: {} });
  });

  it("will announce another tab's changes on the stream, and not the tab's own", async () => {
    const id = crypto.randomUUID();
    const events: [string, any][] = [];
    const mine = { "x-expressive-connection": id, "x-expressive-twin": "Tally-A" };

    listen(connect(id)!, (event, data) => events.push([event, data]));
    await send(endpoints, request("/tally", undefined, "[]", "application/json", { ...mine, "x-expressive-get": "default" }), false, seats);
    await new Promise(resolve => setTimeout(resolve));

    await send(endpoints, request("/tally", "default.slow", "[]", "application/json", mine), false, seats);
    await new Promise(resolve => setTimeout(resolve));
    expect(events.map(([event]) => event)).toEqual(["hello"]);

    await tab().call("default.add", "[1]", { "x-expressive-twin": "Tally-Z" });
    await new Promise(resolve => setTimeout(resolve));
    expect(events.slice(1)).toEqual([["stale", { "Tally-A": ["total"] }]]);
  });

  it("will drop the twins a request releases", async () => {
    const { pull, call } = tab();
    await pull("Tally-A");
    await pull("Visits-B", "/");

    const { body } = await call("default.add", "[1]", { "x-expressive-twin": "Tally-A", "x-expressive-release": "Visits-B,Gone-C" });

    expect(Object.keys(body.frame)).toEqual(["Tally-A"]);
  });

  it("will reply 404 to a pull of a folder without a seat, or naming anything but default", async () => {
    expect((await send([{ pattern: ["x"], exports: async () => ({ calls: {}, classes: {} }) }], request("/x", undefined, "[]", "application/json", { "x-expressive-get": "default" }))).status).toBe(404);
    expect((await send(endpoints, request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "other", "x-expressive-twin": "Tally-A" }), false, seats)).status).toBe(404);
  });

  it("will identify a pull as a call", () => {
    expect(isCall(request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "default" }) as any)).toBe(true);
  });
});

describe("pool dispatch", () => {
  class Shop extends State {
    static ttl = 60;
    name = "shop";

    static key() {
      if (Current.get().request.headers["x-deny"]) throw new Error("Denied");
    }
  }

  class Cart extends State {
    protected shop = get(Shop);
    items = 0;
    async add() { this.items++; return this.shop.name; }
    async seat() { return this.get(Shop, false) === undefined ? "none" : "shop"; }
  }

  const POOL = { "/shop#Cart": { Type: Cart, fields: ["items"], methods: { "/shop#Cart.add": "add", "/shop#Cart.seat": "seat" } } };
  const seats: Seats = async pattern => (pattern.join("/") === "shop" ? (Shop as any) : undefined);
  const endpoints: Endpoint[] = [
    { pattern: ["shop"], exports: async () => ({ calls: {}, classes: {}, pool: POOL }) },
    { pattern: ["detached"], exports: async () => ({ calls: {}, classes: {}, pool: { "/x#Note": { Type: class Note extends State { async seat() { return this.get(Shop, false) === undefined ? "none" : "shop"; } }, fields: [], methods: { "/x#Note.seat": "seat" } } } }) },
  ];

  function tab() {
    const id = crypto.randomUUID();
    const as = (url: string, extra: Record<string, string>, name?: string) =>
      send(endpoints, request(url, name, "[]", "application/json", { "x-expressive-connection": id, ...extra }), false, seats);

    return {
      id,
      pull: (twin: string, url = "/shop/42", extra: Record<string, string> = {}) => as(url, { "x-expressive-get": "/shop#Cart", "x-expressive-twin": twin, ...extra }),
      call: (twin: string, method = "/shop#Cart.add", url = "/shop/42") => as(url, { "x-expressive-twin": twin }, method),
    };
  }

  install();

  it("will build a twin's own instance under the route it names, and catch it up", async () => {
    const { pull, call } = tab();

    expect(await pull("Cart-A")).toEqual({ status: 200, body: { values: { items: 0 }, version: expect.any(String) } });
    expect(await call("Cart-A")).toEqual({ status: 200, body: { value: "shop", frame: { "Cart-A": { patch: { items: 1 }, version: expect.any(String) } } } });
  });

  it("will give each twin its own instance, kept across pulls", async () => {
    const { pull, call } = tab();
    const { version } = (await pull("Cart-A")).body;
    await pull("Cart-B");

    const { body } = await call("Cart-A");

    expect(Object.keys(body.frame)).toEqual(["Cart-A"]);
    expect((await pull("Cart-A", "/shop/42", { "if-none-match": body.frame["Cart-A"].version })).status).toBe(304);
    expect((await pull("Cart-A", "/shop/42", { "if-none-match": version })).body.values).toEqual({ items: 1 });
  });

  it("will run the gates above the route on every request", async () => {
    const { id, pull, call } = tab();
    await pull("Cart-A");

    expect((await pull("Cart-B", "/shop/42", { "x-deny": "1" })).status).toBe(500);
    expect(connect(id)!.twins.has("Cart-B")).toBe(false);

    const denied = request("/shop/42", "/shop#Cart.add", "[]", "application/json", { "x-expressive-connection": id, "x-expressive-twin": "Cart-A", "x-deny": "1" });
    expect((await send(endpoints, denied, false, seats)).status).toBe(500);
    expect((await call("Cart-A")).body).toMatchObject({ value: "shop", frame: { "Cart-A": { patch: { items: 1 } } } });
  });

  it("will build off any route with no seat above it", async () => {
    const { id } = tab();
    const as = (extra: Record<string, string>, name?: string) =>
      send(endpoints, request(DETACHED, name, "[]", "application/json", { "x-expressive-connection": id, "x-expressive-twin": "Note-A", ...extra }), false, seats);

    expect((await as({ "x-expressive-get": "/x#Note" })).status).toBe(200);
    expect((await as({}, "/x#Note.seat")).body.value).toBe("none");
  });

  it("will refuse a method for a twin it does not hold, or holds as something else", async () => {
    const { pull, call } = tab();
    await pull("Cart-A");

    expect((await call("Cart-B")).status).toBe(404);

    const mine = tab();
    await mine.pull("Cart-A");
    const other = { "x-expressive-connection": mine.id, "x-expressive-twin": "Cart-A" };

    expect((await send(endpoints, request("/shop/42", undefined, "[]", "application/json", { ...other, "x-expressive-get": "/x#Note" }), false, seats)).status).toBe(404);
    expect((await send(endpoints, request("/tally", "default.add", "[]", "application/json", other), false, seats)).status).toBe(404);
  });

  it("will destroy a pooled instance its twin releases", async () => {
    const { id, pull } = tab();
    await pull("Cart-A");
    const { instance } = connect(id)!.twins.get("Cart-A")!;

    await send(endpoints, request("/shop/42", undefined, "[]", "application/json", { "x-expressive-connection": id, "x-expressive-get": "/shop#Cart", "x-expressive-twin": "Cart-B", "x-expressive-release": "Cart-A" }), false, seats);

    expect(instance.get(null)).toBe(true);
  });
});

describe("walk", () => {
  const at = (...pattern: string[]): Endpoint => ({ pattern, exports: async () => ({ calls: {}, classes: {} }) });

  it("will take each segment's pattern from the folder that claims it, else the segment itself", () => {
    const list = [at("blog"), at("blog", ":slug"), at("blog", "new")];

    expect(walkOf(list, ["blog", "hello", "edit"])).toEqual({ pattern: ["blog", ":slug", "edit"], segments: ["blog", "hello", "edit"] });
    expect(walkOf(list, ["blog", "new"])).toEqual({ pattern: ["blog", "new"], segments: ["blog", "new"] });
    expect(walkOf(list, ["about"])).toEqual({ pattern: ["about"], segments: ["about"] });
    expect(walkOf(list, [])).toEqual({ pattern: [], segments: [] });
  });

  it("will end at a catch-all, which takes the rest of the path", () => {
    expect(walkOf([at("docs", "*")], ["docs", "a", "b"])).toEqual({ pattern: ["docs", "*"], segments: ["docs", "a/b"] });
  });
});

describe("verify", () => {
  it("will throw if an exported class is not an Error subclass", () => {
    expect(() => verify("/tally", { calls: {}, classes: { Ok: class extends Error {} } })).not.toThrow();
    expect(() => verify("/tally", { calls: {}, classes: { Bad: class {} } })).toThrow("/tally exports Bad, which is neither an async function nor an Error subclass.");
    expect(() => verify("/tally", { calls: {}, classes: { Odd: 1 } })).toThrow("exports Odd");
  });
});
