// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { def, State } from "@expressive/mvc";

import { runtime } from "./call";

interface Reply {
  body: unknown | (() => unknown);
  status?: number;
  epoch?: string;
}

let call: ReturnType<typeof runtime>["call"];
let define: ReturnType<typeof runtime>["define"];
let twin: ReturnType<typeof runtime>["twin"];

beforeEach(() => {
  ({ call, define, twin } = runtime(State, def));
  history.replaceState(null, "", "/tally");
});

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

function serve(...replies: Reply[]) {
  const fetch = vi.fn(async (..._: unknown[]) => {
    const { body, status = 200, epoch = "e1" } = replies.shift()!;
    const json = status === 304 ? null : JSON.stringify(typeof body == "function" ? body() : body);

    return new Response(json, { status, headers: { "x-expressive-epoch": epoch } });
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const headers = (fetch: { mock: { calls: unknown[][] } }, at: number) => (fetch.mock.calls[at][1] as RequestInit).headers as Record<string, string>;
const idOf = (fetch: { mock: { calls: unknown[][] } }, at: number) => headers(fetch, at)["x-expressive-twin"];

describe("call", () => {
  it("will POST the arguments to the sidecar's folder on the tab's connection, params filled from the location", async () => {
    history.replaceState(null, "", "/blog/hello/edit?draft=1");
    const fetch = serve({ body: { value: 3, frame: {} } }, { body: { frame: {} } });

    expect(await call(["blog", ":slug"], "add", [1, 2])).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/blog/hello", {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": expect.stringMatching(/^[\da-f-]{36}$/), "x-expressive-call": "add" },
      body: "[1,2]",
    });

    await call(["blog", ":slug"], "add", []);
    expect(headers(fetch, 1)["x-expressive-connection"]).toBe(headers(fetch, 0)["x-expressive-connection"]);
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

  it("will apply the frame to the tab's twins before resolving", async () => {
    const fetch = serve(
      { body: { values: { total: 0 }, version: "g:1" } },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 4 }, version: "g:2" }, "Gone-X": { patch: { total: 9 }, version: "g:1" } } }) },
    );
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));
    await call(["tally"], "bump", []);

    expect(tally.total).toBe(4);
  });
});

describe("twin", () => {
  it("will make a named State that attaches on creation under its own id and holds the snapshot", async () => {
    const fetch = serve({ body: { values: { total: 4 }, version: "g:1" } });
    const Tally = twin(["tally"], {}, ["total"], "Tally");
    const tally = Tally.new() as any;

    expect(Tally.name).toBe("Tally");
    expect(tally).toBeInstanceOf(State);
    expect(fetch).toHaveBeenCalledWith("/tally", expect.objectContaining({ body: "[]" }));
    expect(headers(fetch, 0)).toMatchObject({ "x-expressive-get": "default", "x-expressive-twin": expect.stringMatching(/^Tally-[\dA-Z]{6}$/) });
    expect(headers(fetch, 0)).not.toHaveProperty("if-none-match");

    await vi.waitFor(() => expect(tally.total).toBe(4));
  });

  it("will give each twin its own id", () => {
    const fetch = serve({ body: { values: {}, version: "g:1" } }, { body: { values: {}, version: "g:1" } });
    const Tally = twin(["tally"], {}, [], "Tally");

    Tally.new();
    Tally.new();

    expect(idOf(fetch, 0)).not.toBe(idOf(fetch, 1));
  });

  it("will call through a method once attached, naming itself and its version, and apply the frame before resolving", async () => {
    const fetch = serve(
      { body: { values: { total: 0 }, version: "g:1" } },
      { body: () => ({ value: 5, frame: { [idOf(fetch, 0)]: { patch: { total: 5 }, version: "g:2" } } }) },
    );
    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;

    expect(await tally.add(2, 3)).toBe(5);
    expect(tally.total).toBe(5);
    expect(fetch).toHaveBeenLastCalledWith("/tally", expect.objectContaining({ body: "[2,3]" }));
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-call": "default.add", "x-expressive-twin": idOf(fetch, 0), "if-none-match": "g:1" });
  });

  it("will update another twin the call moved", async () => {
    history.replaceState(null, "", "/tally/sub");
    const fetch = serve(
      { body: { values: { total: 0 }, version: "a:1" } },
      { body: { values: { count: 0 }, version: "b:1" } },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 1 }, version: "a:2" }, [idOf(fetch, 1)]: { patch: { count: 1 }, version: "b:2" } } }) },
    );
    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;
    await vi.waitFor(() => expect(tally.total).toBe(0));
    const visits = twin([], {}, ["count"], "Visits").new() as any;
    await vi.waitFor(() => expect(visits.count).toBe(0));

    await tally.add();

    expect(visits.count).toBe(1);
  });

  it("will hold a frame that reaches a twin before its snapshot, then apply it", async () => {
    let attached!: (res: Response) => void;
    const epoch = { headers: { "x-expressive-epoch": "e1" } };
    const fetch = vi.fn()
      .mockReturnValueOnce(new Promise<Response>(resolve => (attached = resolve)))
      .mockImplementation(async () => new Response(JSON.stringify({ frame: { [idOf(fetch, 0)]: { patch: { total: 2 }, version: "g:3" } } }), epoch));
    vi.stubGlobal("fetch", fetch);

    const tally = twin(["tally"], {}, ["total", "label"], "Tally").new() as any;

    await call(["tally"], "bump", []);
    await call(["tally"], "bump", []);
    attached(new Response(JSON.stringify({ values: { total: 1, label: "a" }, version: "g:2" }), epoch));

    await vi.waitFor(() => expect(tally.total).toBe(2));
    expect(tally.label).toBe("a");
  });

  it("will throw if a twin field is assigned outside a reply", async () => {
    serve({ body: { values: { total: 0 }, version: "g:1" } });
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));

    expect(() => (tally.total = 1)).toThrow(/\.total is read-only - change it through a method\.$/);
    expect(() => tally.set({ total: 1 })).toThrow("read-only");
    expect(tally.total).toBe(0);
  });

  it("will resolve a field the snapshot leaves out as undefined", async () => {
    serve({ body: { values: {}, version: "g:1" } });
    const tally = twin(["tally"], {}, ["user"], "Tally").new() as any;

    let thrown: unknown;
    try { tally.user; } catch (error) { thrown = error; }

    expect(await thrown).toBeUndefined();
    expect(tally.user).toBeUndefined();
  });

  it("will ignore a patch older than the version it holds", async () => {
    const fetch = serve(
      { body: { values: { total: 3 }, version: "g:3" } },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 1 }, version: "g:1" } } }) },
    );
    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;

    await tally.add();
    expect(tally.total).toBe(3);
  });

  it("will rewrite every field when the server's generation changes", async () => {
    const fetch = serve(
      { body: { values: { total: 4, label: "a" }, version: "g:9" } },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 0 }, version: "h:1" } } }) },
    );
    const tally = twin(["tally"], { reset: "default.reset" }, ["total", "label"], "Tally").new() as any;

    await tally.reset();

    expect(tally.total).toBe(0);
    expect(tally.label).toBeUndefined();
  });

  it("will suspend a required read until the snapshot arrives", async () => {
    serve({ body: { values: { total: 7 }, version: "g:1" } });
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    let thrown: unknown;
    try { tally.total; } catch (error) { thrown = error; }

    expect(thrown).toBeInstanceOf(Promise);
    await thrown;
    expect(tally.total).toBe(7);
  });

  it("will release itself with the next request once destroyed, and only once", async () => {
    const fetch = serve(
      { body: { values: { total: 0 }, version: "g:1" } },
      { body: { frame: {} } },
      { body: { frame: {} } },
    );
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));
    tally.set(null);

    await call(["tally"], "bump", []);
    await call(["tally"], "bump", []);

    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-release": idOf(fetch, 0) });
    expect(headers(fetch, 2)).not.toHaveProperty("x-expressive-release");
  });

  it("will release itself again if destroyed before its snapshot arrives", async () => {
    let attached!: (res: Response) => void;
    const epoch = { headers: { "x-expressive-epoch": "e1" } };
    const fetch = vi.fn()
      .mockReturnValueOnce(new Promise<Response>(resolve => (attached = resolve)))
      .mockImplementation(async () => new Response(JSON.stringify({ frame: {} }), epoch));
    vi.stubGlobal("fetch", fetch);

    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;
    const id = idOf(fetch, 0);

    tally.set(null);
    await call(["tally"], "bump", []);
    attached(new Response(JSON.stringify({ values: { total: 0 }, version: "g:1" }), epoch));
    await new Promise(resolve => setTimeout(resolve));
    await call(["tally"], "bump", []);

    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-release": id });
    expect(headers(fetch, 2)).toMatchObject({ "x-expressive-release": id });
  });

  it("will re-attach every twin when the connection's epoch changes, before the call resolves, keeping one that is current", async () => {
    history.replaceState(null, "", "/tally/sub");
    const fetch = serve(
      { body: { values: { total: 0 }, version: "a:1" } },
      { body: { values: { count: 0 }, version: "b:1" } },
      { body: () => ({ value: 1, frame: { [idOf(fetch, 0)]: { patch: { total: 1 }, version: "a:2" } } }), epoch: "e2" },
      { body: { values: { total: 1 }, version: "a:2" }, epoch: "e2" },
      { body: null, status: 304, epoch: "e2" },
    );
    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;
    await vi.waitFor(() => expect(tally.total).toBe(0));
    const visits = twin([], {}, ["count"], "Visits").new() as any;
    await vi.waitFor(() => expect(visits.count).toBe(0));

    expect(await tally.add()).toBe(1);
    expect(tally.total).toBe(1);
    expect(visits.count).toBe(0);
    expect(headers(fetch, 3)).toMatchObject({ "x-expressive-get": "default", "x-expressive-twin": idOf(fetch, 0), "if-none-match": "a:1" });
    expect(headers(fetch, 4)).toMatchObject({ "x-expressive-get": "default", "x-expressive-twin": idOf(fetch, 1), "if-none-match": "b:1" });
  });
});
