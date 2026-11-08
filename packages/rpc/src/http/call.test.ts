import { describe, expect, it, vi } from "vitest";

import { Model } from "@expressive/mvc";

import type { Endpoint, Seats } from "../call";
import { dispatch, failure, handler, isCall, reply, type Tier } from "./call";

const TAB = crypto.randomUUID();

function request(url: string, name: string | undefined, body: string, type = "application/json", extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": type, "x-expressive-connection": TAB, ...extra };
  if (name) headers["x-expressive-call"] = name;
  return { method: "POST", url, headers, body };
}

function fetched({ method, url, headers, body }: ReturnType<typeof request>) {
  return new Request(`http://localhost${url}`, { method, headers, body: method === "GET" ? undefined : body });
}

async function sent(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false, seats?: Seats) {
  const response = await dispatch(fetched(req), () => endpoints, dev, seats);
  const text = await response.text();

  return { status: response.status, body: text ? JSON.parse(text) : undefined, headers: Object.fromEntries(response.headers) };
}

async function send(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false, seats?: Seats) {
  const { status, body } = await sent(endpoints, req, dev, seats);
  return { status, body };
}

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

  it("will reply with a call's value alone, with no connection id", async () => {
    const plain = (name: string, args: string) => {
      const { "x-expressive-connection": _, ...headers } = request("/tally", name, args).headers;
      return sent(endpoints, Object.assign(request("/tally", name, args), { headers }));
    };

    expect(await plain("add", "[1, 2]")).toEqual({ status: 200, body: { value: 3 }, headers: { "content-type": "application/json; charset=utf-8" } });
    expect((await plain("none", "[]")).body).toEqual({});
  });

  it("will reply 404 to a pull, a seat method or a pool method", async () => {
    class Tally extends Model {
      total = 0;
      async add() { return ++this.total; }
    }

    const exports = {
      calls,
      classes: {},
      seat: { fields: ["total"], methods: { "default.add": "add" } },
      pool: { "/tally#Tally": { Type: Tally, fields: ["total"], methods: { "/tally#Tally.add": "add" } } },
    };
    const twinned: Endpoint[] = [{ pattern: ["tally"], exports: async () => exports }];
    const seats: Seats = async pattern => (pattern.join("/") === "tally" ? Tally : undefined);
    const as = (name: string | undefined, extra: Record<string, string>) =>
      send(twinned, request("/tally", name, "[]", "application/json", { "x-expressive-twin": "Tally-A", ...extra }), false, seats);
    const missing = { status: 404, body: { message: "Not found." } };

    expect(await as(undefined, { "x-expressive-get": "default" })).toEqual(missing);
    expect(await as(undefined, { "x-expressive-get": "/tally#Tally" })).toEqual(missing);
    expect(await as("default.add", {})).toEqual(missing);
    expect(await as("/tally#Tally.add", {})).toEqual(missing);
    expect(await as("none", {})).toEqual({ status: 200, body: {} });
    expect(await as("none", { "x-expressive-get": "default" })).toEqual(missing);
  });

  it("will identify a call by method, name header and JSON body", () => {
    expect(isCall(fetched(request("/tally", "add", "[]")))).toBe(true);
    expect(isCall(fetched(request("/tally", undefined, "[]")))).toBe(false);
    expect(isCall(fetched(request("/tally", "add", "[]", "text/plain")))).toBe(false);
    expect(isCall(fetched(Object.assign(request("/tally", "add", "[]"), { method: "GET" })))).toBe(false);
  });

  it("will identify a pull as a call", () => {
    expect(isCall(fetched(request("/tally", undefined, "[]", "application/json", { "x-expressive-get": "default" })))).toBe(true);
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

describe("handler", () => {
  const endpoints: Endpoint[] = [{ pattern: ["tally"], exports: async () => ({ calls: { add: async (a: number, b: number) => a + b }, classes: {} }) }];

  it("will answer a call, from a list or a function of one", async () => {
    for (const handle of [handler(endpoints), handler(() => endpoints, { dev: true })]) {
      const response = await handle(fetched(request("/tally", "add", "[1, 2]")));
      expect(await response!.json()).toEqual({ value: 3 });
    }
  });

  it("will pass on a request that is not a call", async () => {
    expect(await handler(endpoints)(new Request("http://localhost/tally"))).toBeUndefined();
  });
});

describe("failure", () => {
  it("will reply an error as a call would, with the headers given", async () => {
    class Gone extends Error { status = 410; }
    const endpoints: Endpoint[] = [{ pattern: [], exports: async () => ({ calls: {}, classes: { "#Gone": Gone } }) }];
    const response = await failure(new Gone("Gone"), endpoints, false, { "x-a": "1" });

    expect(response.status).toBe(410);
    expect(response.headers.get("x-a")).toBe("1");
    expect(await response.json()).toEqual({ error: "#Gone", message: "Gone", status: 410 });
  });
});

describe("tier", () => {
  const add = async (a: number, b: number) => a + b;
  const endpoints: Endpoint[] = [{ pattern: ["tally"], exports: async () => ({ calls: { add }, classes: {} }) }];

  it("will let a tier take a call, given what the request resolved to", async () => {
    const tier: Tier<any> = vi.fn(async ({ pathname, exports }, fn) => async (args: unknown[]) => reply(200, { pathname, fn: fn === add, exports: !!exports, args }));
    const response = await dispatch(fetched(request("/tally", "add", "[1]")), () => endpoints, false, undefined, tier);

    expect(await response.json()).toEqual({ pathname: "/tally", fn: true, exports: true, args: [1] });
  });

  it("will reply 404 to what no tier takes, and hand it no call for a pull or an unnamed request", async () => {
    const tier = vi.fn(async () => undefined);

    expect((await dispatch(fetched(request("/tally", undefined, "[]")), () => endpoints, false, undefined, tier)).status).toBe(404);
    expect((await dispatch(fetched(request("/tally", "add", "[]", "application/json", { "x-expressive-get": "default" })), () => endpoints, false, undefined, tier)).status).toBe(404);
    expect(tier.mock.calls.map(call => (call as unknown[])[1])).toEqual([undefined, undefined]);
  });
});

describe("reply", () => {
  it("will send no body for no value", async () => {
    const response = reply(304, undefined, { "x-a": "1" });

    expect(response.status).toBe(304);
    expect(response.headers.get("x-a")).toBe("1");
    expect(response.body).toBeNull();
  });
});
