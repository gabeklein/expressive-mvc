// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "./call";

interface Reply {
  body: unknown;
  status?: number;
  epoch?: string;
}

let call: ReturnType<typeof client>["call"];
let define: ReturnType<typeof client>["define"];

beforeEach(() => {
  ({ call, define } = client());
  history.replaceState(null, "", "/tally");
});

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

function serve(...replies: Reply[]) {
  const fetch = vi.fn(async (_path: unknown, _init?: RequestInit) => {
    const { body, status = 200, epoch = "e1" } = replies.shift()!;

    return new Response(JSON.stringify(body), { status, headers: { "x-expressive-epoch": epoch } });
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("call", () => {
  it("will POST the arguments to the sidecar's folder with no connection id, and resolve the value alone", async () => {
    history.replaceState(null, "", "/blog/hello/edit?draft=1");
    const fetch = serve({ body: { value: 3, frame: { "Tally-A": { patch: { total: 4 }, version: "g:2" } } } });

    expect(await call(["blog", ":slug"], "add", [1, 2])).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/blog/hello", {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "add" },
      body: "[1,2]",
    });
  });

  it("will fill a catch-all with the rest of the location", async () => {
    history.replaceState(null, "", "/docs/a/b");
    const fetch = serve({ body: { frame: {} } });

    expect(await call(["docs", "*"], "none", [])).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/docs/a/b", expect.anything());
  });

  it("will throw a failed call's message", async () => {
    serve({ body: { message: "Internal error." }, status: 500, epoch: "" });
    await expect(call([], "fail", [])).rejects.toThrow("Internal error.");
  });

  it("will throw if called from outside the sidecar's folder", async () => {
    history.replaceState(null, "", "/about");
    const fetch = serve();

    await expect(call(["blog", ":slug"], "add", [])).rejects.toThrow("add() belongs to /blog/:slug and cannot be called from /about.");
    await expect(call(["blog"], "add", [])).rejects.toThrow("belongs to /blog");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("will rebuild an exported error class with its fields", async () => {
    const Limit = define("/tally#Limit", "Limit");
    serve({ body: { error: "/tally#Limit", message: "Over 3", status: 409, limit: 3 }, status: 409 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error).toBeInstanceOf(Limit);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "Limit", message: "Over 3", status: 409, limit: 3 });
  });

  it("will throw a plain Error for a class this client never imported", async () => {
    serve({ body: { error: "/other#Nope", message: "No", status: 409 }, status: 409 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error.constructor).toBe(Error);
    expect(error).toMatchObject({ message: "No", status: 409 });
  });
});
