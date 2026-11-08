import { beforeAll, describe, expect, it } from "vitest";
import { Model } from "@expressive/mvc";

import { classId, invoke, resolve, verify, walkOf, type Endpoint } from "./call";
import { Current, install } from "./context";

const at = (...pattern: string[]): Endpoint => ({ pattern, exports: async () => ({ calls: {}, classes: {} }) });

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

  it("will prefer a param to a catch-all", () => {
    expect(resolve([at("docs", "*"), at("docs", ":page")], ["docs", "a"])?.endpoint.pattern).toEqual(["docs", ":page"]);
  });

  it("will not match a path no sidecar owns", () => {
    expect(resolve(endpoints, ["blog"])).toBeUndefined();
    expect(resolve(endpoints, ["blog", "a", "b"])).toBeUndefined();
  });
});

describe("walk", () => {
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

describe("invoke", () => {
  class Limit extends Error {
    status = 409;
    constructor(public limit: number) { super(`Over ${limit}`); }
  }
  class Odd extends Error { status = "odd"; }
  class Known extends Error {}
  class Tally extends Model { total = 7; }

  const calls: Record<string, unknown> = {
    add: async (a: number, b: number) => a + b,
    path: async () => Current.get().url.pathname,
    total: async () => Tally.get().total,
    limit: async () => { throw new Limit(3); },
    odd: async () => { throw new Odd("Odd"); },
    known: async () => { throw new Known("Known"); },
    fail: async () => { throw new Error("Nope"); },
    raw: async () => { throw "raw"; },
  };
  const endpoints: Endpoint[] = [
    { pattern: ["tally", ":id"], exports: async () => ({ calls, classes: { "/tally#Limit": Limit, "/tally#Odd": Odd, "/tally#Known": Known } }) },
  ];
  const request = new Request("http://localhost/tally/a");
  const run = (name: string, args: unknown[] = [], options?: Parameters<typeof invoke>[2]) =>
    invoke({ request, at: ["tally", "a"], name, args }, endpoints, options);

  beforeAll(() => install());

  it("will run a call in its folder and give back its value", async () => {
    expect(await run("add", [1, 2])).toEqual({ value: 3 });
    expect(await run("path")).toEqual({ value: "/tally/a" });
  });

  it("will seat the folders along the call's path", async () => {
    const seats = async (pattern: string[]) => (pattern.length === 2 ? Tally : undefined);

    expect(await run("total", [], { seats })).toEqual({ value: 7 });
  });

  it("will give back nothing for a name or a path no endpoint has", async () => {
    expect(await run("subtract")).toBeUndefined();
    expect(await invoke({ request, at: ["nope"], name: "add", args: [] }, endpoints)).toBeUndefined();
  });

  it("will give back an exported error's id, fields and numeric status", async () => {
    expect(await run("limit")).toEqual({ error: { error: "/tally#Limit", message: "Over 3", status: 409, limit: 3 }, status: 409 });
    expect(await run("odd")).toEqual({ error: { error: "/tally#Odd", message: "Odd", status: "odd" }, status: undefined });
  });

  it("will prefer a known id to an exported one", async () => {
    expect(await run("known", [], { errors: { "fixed:Known": Known } })).toMatchObject({ error: { error: "fixed:Known" } });
  });

  it("will hide any other error's message outside development", async () => {
    expect(await run("fail")).toEqual({ error: { message: "Internal error." } });
    expect(await run("raw", [], { dev: true })).toEqual({ error: { message: "Internal error." } });

    const outcome = await run("fail", [], { dev: true });
    expect(outcome).toMatchObject({ error: { message: "Nope", stack: expect.stringContaining("Error: Nope") } });
  });
});

describe("classId", () => {
  it("will find the nearest exported or known class of an error", async () => {
    class Base extends Error {}
    class Mid extends Base {}
    class Leaf extends Mid {}
    const endpoints: Endpoint[] = [{ pattern: [], exports: async () => ({ calls: {}, classes: { "#Base": Base } }) }];

    expect(await classId(endpoints, new Leaf())).toBe("#Base");
    expect(await classId(endpoints, new Leaf(), { "#Mid": Mid })).toBe("#Mid");
    expect(await classId(endpoints, new Error())).toBeUndefined();
  });
});
