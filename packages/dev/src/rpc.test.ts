// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, describe, expect, it, vi } from "vitest";

import { call } from "./rpc";

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("rpc call", () => {
  const fetch = vi.fn();

  afterEach(() => {
    fetch.mockReset();
    vi.unstubAllGlobals();
  });

  function at(path: string, status = 200, body: unknown = "ok") {
    window.history.replaceState(null, "", path);
    fetch.mockImplementation(async () => reply(status, body));
    vi.stubGlobal("fetch", fetch);
  }

  it("will post the arguments as a JSON array to the scope's path and the function", async () => {
    at("/blog");
    expect(await call(["blog"], "list", [1, "a"])).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("/blog/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '[1,"a"]',
    });
  });

  it("will fill params from the current location", async () => {
    at("/blog/hello/comments");
    await call(["blog", ":slug"], "like", []);
    expect(fetch.mock.calls[0][0]).toBe("/blog/hello/like");
  });

  it("will call an ancestor scope from below it", async () => {
    at("/blog/hello");
    await call([], "ping", []);
    await call(["blog"], "list", []);
    expect(fetch.mock.calls.map(c => c[0])).toEqual(["/ping", "/blog/list"]);
  });

  it("will fill a catch-all with the rest of the location", async () => {
    at("/docs/a/b");
    await call(["docs", "*"], "read", []);
    expect(fetch.mock.calls[0][0]).toBe("/docs/a/b/read");
  });

  it("will not consult the location for a scope without params", async () => {
    at("/about");
    await call(["api", "greetings"], "hello", []);
    expect(fetch.mock.calls[0][0]).toBe("/api/greetings/hello");
  });

  it("will throw if a scope with params is called outside it", async () => {
    at("/about");
    await expect(call(["blog", ":slug"], "like", [])).rejects.toThrow("like() belongs to /blog/:slug and was called from /about.");
    await expect(call(["docs", "*"], "read", [])).rejects.toThrow("belongs to /docs/*");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("will throw the server's error message", async () => {
    at("/blog", 500, { error: "nope" });
    await expect(call(["blog"], "list", [])).rejects.toThrow("nope");
  });
});
