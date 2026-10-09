import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import { dispatch, endpoint, isCall, type Endpoint } from "./call";

const at = (...pattern: string[]): Endpoint => ({ pattern, calls: async () => ({ where: async () => pattern.join("/") }) });

function request(url: string, name: string | undefined, body: string, type = "application/json") {
  const headers: Record<string, string> = { "content-type": type };
  if (name) headers["x-expressive-call"] = name;
  return Object.assign(Readable.from([body]), { method: "POST", url, headers });
}

async function send(endpoints: Endpoint[], req: ReturnType<typeof request>, dev = false) {
  const res = { statusCode: 0, body: undefined as string | undefined, setHeader() {}, end(body?: string) { this.body = body; } };
  await dispatch(req as any, res as any, () => endpoints, dev);
  return { status: res.statusCode, body: res.body && JSON.parse(res.body) };
}

describe("call endpoints", () => {
  const endpoints = [at("blog", ":slug"), at("blog", "new"), at("docs", "*"), at()];

  it("will match a path to the most specific sidecar", () => {
    expect(endpoint(endpoints, "/blog/new")?.pattern).toEqual(["blog", "new"]);
    expect(endpoint(endpoints, "/blog/hello")?.pattern).toEqual(["blog", ":slug"]);
    expect(endpoint(endpoints, "/docs/a/b")?.pattern).toEqual(["docs", "*"]);
    expect(endpoint(endpoints, "/")?.pattern).toEqual([]);
  });

  it("will not match a path no sidecar owns", () => {
    expect(endpoint(endpoints, "/blog")).toBeUndefined();
    expect(endpoint(endpoints, "/blog/a/b")).toBeUndefined();
  });
});

describe("call dispatch", () => {
  const calls: Record<string, unknown> = {
    add: async (a: number, b: number) => a + b,
    none: async () => {},
    fail: async () => { throw new Error("Nope"); },
    value: 1,
  };
  const endpoints: Endpoint[] = [{ pattern: ["tally"], calls: async () => calls }];

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
});
