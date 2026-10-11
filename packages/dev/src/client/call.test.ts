// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, describe, expect, it, vi } from "vitest";

import { def, State } from "@expressive/mvc";

import { runtime } from "./call";

const { call, define, twin } = runtime(State, def);

function reply(status: number, body?: unknown) {
  const fetch = vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("call", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, "", "/");
  });

  it("will POST the arguments to the sidecar's folder, params filled from the location", async () => {
    history.replaceState(null, "", "/blog/hello/edit?draft=1");
    const fetch = reply(200, 3);

    expect(await call(["blog", ":slug"], "add", [1, 2])).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/blog/hello", {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "add" },
      body: "[1,2]",
    });
  });

  it("will fill a catch-all with the rest of the location", async () => {
    history.replaceState(null, "", "/docs/a/b");
    const fetch = reply(204);

    expect(await call(["docs", "*"], "none", [])).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/docs/a/b", expect.anything());
  });

  it("will throw a failed call's message", async () => {
    reply(500, { message: "Internal error." });
    await expect(call([], "fail", [])).rejects.toThrow("Internal error.");
  });

  it("will throw if called from outside the sidecar's folder", async () => {
    history.replaceState(null, "", "/about");
    const fetch = reply(200, 1);

    await expect(call(["blog", ":slug"], "add", [])).rejects.toThrow("add() belongs to /blog/:slug and cannot be called from /about.");
    await expect(call(["blog"], "add", [])).rejects.toThrow("belongs to /blog");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("will rebuild an exported error class with its fields", async () => {
    const Limit = define("/tally#Limit", "Limit");
    reply(409, { error: "/tally#Limit", message: "Over 3", status: 409, limit: 3 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error).toBeInstanceOf(Limit);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "Limit", message: "Over 3", status: 409, limit: 3 });
  });

  it("will throw a plain Error for a class this client never imported", async () => {
    reply(409, { error: "/other#Nope", message: "No", status: 409 });

    const error = (await call([], "add", []).catch((e: Error) => e)) as Error;

    expect(error.constructor).toBe(Error);
    expect(error).toMatchObject({ message: "No", status: 409 });
  });
});

describe("twin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState(null, "", "/");
  });

  function replies(...bodies: unknown[]) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(bodies.shift()), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("will make a named State that attaches on creation and holds the snapshot", async () => {
    history.replaceState(null, "", "/tally");
    const fetch = replies({ values: { total: 4 }, version: "g:1" });
    const Tally = twin(["tally"], {}, ["total"], "Tally");
    const tally = Tally.new() as any;

    expect(Tally.name).toBe("Tally");
    expect(tally).toBeInstanceOf(State);
    expect(fetch).toHaveBeenCalledWith("/tally", expect.objectContaining({
      headers: expect.objectContaining({ "x-expressive-get": "default" }),
      body: "[]",
    }));

    await vi.waitFor(() => expect(tally.total).toBe(4));
  });

  it("will call the server through a method and apply the reply's patch before resolving", async () => {
    history.replaceState(null, "", "/tally");
    const fetch = replies({ values: { total: 0 }, version: "g:1" }, { value: 5, patch: { total: 5 }, version: "g:2" });
    const Tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally");
    const tally = Tally.new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));
    expect(await tally.add(2, 3)).toBe(5);
    expect(tally.total).toBe(5);
    expect(fetch).toHaveBeenLastCalledWith("/tally", expect.objectContaining({
      headers: expect.objectContaining({ "x-expressive-call": "default.add" }),
      body: "[2,3]",
    }));
  });

  it("will send the held version with a call and patch only what changed", async () => {
    history.replaceState(null, "", "/tally");
    const fetch = replies({ values: { total: 0, label: "a" }, version: "g:1" }, { value: 1, patch: { total: 1 }, version: "g:2" });
    const Tally = twin(["tally"], { add: "default.add" }, ["total", "label"], "Tally");
    const tally = Tally.new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));
    await tally.add(1);

    expect(fetch).toHaveBeenLastCalledWith("/tally", expect.objectContaining({
      headers: expect.objectContaining({ "if-none-match": "g:1" }),
    }));
    expect(tally.total).toBe(1);
    expect(tally.label).toBe("a");
  });

  it("will throw if a twin field is assigned outside a reply", async () => {
    history.replaceState(null, "", "/tally");
    replies({ values: { total: 0 }, version: "g:1" });
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));

    expect(() => (tally.total = 1)).toThrow(/\.total is read-only - change it through a method\.$/);
    expect(() => tally.set({ total: 1 })).toThrow("read-only");
    expect(tally.total).toBe(0);
  });

  it("will resolve a field the snapshot leaves out as undefined", async () => {
    history.replaceState(null, "", "/tally");
    replies({ values: {}, version: "g:1" });
    const tally = twin(["tally"], {}, ["user"], "Tally").new() as any;

    let thrown: unknown;
    try { tally.user; } catch (error) { thrown = error; }

    expect(await thrown).toBeUndefined();
    expect(tally.user).toBeUndefined();
  });

  it("will ignore a reply older than the version it holds", async () => {
    history.replaceState(null, "", "/tally");
    let resolve!: (res: Response) => void;
    const fetch = vi.fn()
      .mockReturnValueOnce(new Promise<Response>(done => (resolve = done)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1, patch: { total: 1 }, version: "g:2" })));
    vi.stubGlobal("fetch", fetch);

    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;

    await tally.add(1);
    resolve(new Response(JSON.stringify({ values: { total: 0 }, version: "g:1" })));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve));

    expect(tally.total).toBe(1);
  });

  it("will rewrite every field when the server's generation changes", async () => {
    history.replaceState(null, "", "/tally");
    replies({ values: { total: 4, label: "a" }, version: "g:9" }, { value: undefined, patch: { total: 0 }, version: "h:1" });
    const tally = twin(["tally"], { reset: "default.reset" }, ["total", "label"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.label).toBe("a"));
    await tally.reset();

    expect(tally.total).toBe(0);
    expect(tally.label).toBeUndefined();
  });

  it("will suspend a required read until the snapshot arrives", async () => {
    history.replaceState(null, "", "/tally");
    replies({ values: { total: 7 }, version: "g:1" });
    const Tally = twin(["tally"], {}, ["total"], "Tally");
    const tally = Tally.new() as any;

    let thrown: unknown;
    try { tally.total; } catch (error) { thrown = error; }

    expect(thrown).toBeInstanceOf(Promise);
    await thrown;
    expect(tally.total).toBe(7);
  });
});
