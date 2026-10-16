// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Context, def, State } from "@expressive/mvc";

import { runtime } from "./call";

interface Reply {
  body: unknown | ((sent: Record<string, string>) => unknown);
  status?: number;
  epoch?: string;
}

let call: ReturnType<typeof runtime>["call"];
let define: ReturnType<typeof runtime>["define"];
let twin: ReturnType<typeof runtime>["twin"];

class Source {
  static opened: Source[] = [];
  listeners = new Map<string, (message: { data: string }) => void>();

  constructor(readonly url: string) {
    Source.opened.push(this);
  }

  addEventListener(event: string, listener: (message: { data: string }) => void) {
    this.listeners.set(event, listener);
  }

  emit(event: string, data: unknown) {
    this.listeners.get(event)!({ data: JSON.stringify(data) });
  }
}

class Spot extends State {
  base = "";
  to = "";
  router = { segment: (to: string) => (to ? "/" + to : "") };
}

class Registry {
  static made: Registry[] = [];
  held = new Map<object, string>();

  constructor(readonly cleanup: (id: string) => void) {
    Registry.made.push(this);
  }

  register(target: object, id: string) {
    this.held.set(target, id);
  }

  unregister(target: object) {
    this.held.delete(target);
  }
}

beforeEach(() => {
  Source.opened = [];
  Registry.made = [];
  vi.stubGlobal("EventSource", Source);
  vi.stubGlobal("FinalizationRegistry", Registry);
  ({ call, define, twin } = runtime(State, def, Context, Spot));
  history.replaceState(null, "", "/tally");
});

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

function serve(...replies: Reply[]) {
  const fetch = vi.fn(async (_path: unknown, init?: RequestInit) => {
    const { body, status = 200, epoch = "e1" } = replies.shift()!;
    const sent = (init?.headers ?? {}) as Record<string, string>;
    const json = status === 304 ? null : JSON.stringify(typeof body == "function" ? body(sent) : body);

    return new Response(json, { status, headers: { "x-expressive-epoch": epoch } });
  });

  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const snap = (patch: Record<string, unknown>, version: string) => (sent: Record<string, string>) => ({ frame: { [sent["x-expressive-twin"]]: { patch, version } } });

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
      { body: snap({ total: 0 }, "g:1") },
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
    const fetch = serve({ body: snap({ total: 4 }, "g:1") });
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
    const fetch = serve({ body: snap({}, "g:1") }, { body: snap({}, "g:1") });
    const Tally = twin(["tally"], {}, [], "Tally");

    Tally.new();
    Tally.new();

    expect(idOf(fetch, 0)).not.toBe(idOf(fetch, 1));
  });

  it("will call through a method once attached, naming itself and its version, and apply the frame before resolving", async () => {
    const fetch = serve(
      { body: snap({ total: 0 }, "g:1") },
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
      { body: snap({ total: 0 }, "a:1") },
      { body: snap({ count: 0 }, "b:1") },
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
    attached(new Response(JSON.stringify({ frame: { [idOf(fetch, 0)]: { patch: { total: 1, label: "a" }, version: "g:2" } } }), epoch));

    await vi.waitFor(() => expect(tally.total).toBe(2));
    expect(tally.label).toBe("a");
  });

  it("will throw if a twin field is assigned outside a reply", async () => {
    serve({ body: snap({ total: 0 }, "g:1") });
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));

    expect(() => (tally.total = 1)).toThrow(/\.total is read-only - change it through a method\.$/);
    expect(() => tally.set({ total: 1 })).toThrow("read-only");
    expect(tally.total).toBe(0);
  });

  it("will resolve a field the snapshot leaves out as undefined", async () => {
    serve({ body: snap({}, "g:1") });
    const tally = twin(["tally"], {}, ["user"], "Tally").new() as any;

    let thrown: unknown;
    try { tally.user; } catch (error) { thrown = error; }

    expect(await thrown).toBeUndefined();
    expect(tally.user).toBeUndefined();
  });

  it("will keep a field the server holds pending suspended until its value arrives, then keep it", async () => {
    const fetch = serve(
      { body: snap({ total: 1, user: { $pending: true } }, "g:1") },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { user: "ada" }, version: "g:2" } } }) },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { user: { $pending: true } }, version: "g:3" } } }) },
    );
    const tally = twin(["tally"], { touch: "default.touch" }, ["total", "user"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(1));

    let thrown: unknown;
    try { tally.user; } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(Promise);

    await tally.touch();
    await thrown;
    expect(tally.user).toBe("ada");

    await tally.touch();
    expect(tally.user).toBe("ada");
  });

  it("will ignore a patch older than the version it holds", async () => {
    const fetch = serve(
      { body: snap({ total: 3 }, "g:3") },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 1 }, version: "g:1" } } }) },
    );
    const tally = twin(["tally"], { add: "default.add" }, ["total"], "Tally").new() as any;

    await tally.add();
    expect(tally.total).toBe(3);
  });

  it("will rewrite every field when the server's generation changes", async () => {
    const fetch = serve(
      { body: snap({ total: 4, label: "a" }, "g:9") },
      { body: () => ({ frame: { [idOf(fetch, 0)]: { patch: { total: 0 }, version: "h:1" } } }) },
    );
    const tally = twin(["tally"], { reset: "default.reset" }, ["total", "label"], "Tally").new() as any;

    await tally.reset();

    expect(tally.total).toBe(0);
    expect(tally.label).toBeUndefined();
  });

  it("will suspend a required read until the snapshot arrives", async () => {
    serve({ body: snap({ total: 7 }, "g:1") });
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    let thrown: unknown;
    try { tally.total; } catch (error) { thrown = error; }

    expect(thrown).toBeInstanceOf(Promise);
    await thrown;
    expect(tally.total).toBe(7);
  });

  it("will release itself with the next request once destroyed, and only once", async () => {
    const fetch = serve(
      { body: snap({ total: 0 }, "g:1") },
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
    attached(new Response(JSON.stringify({ frame: { [id]: { patch: { total: 0 }, version: "g:1" } } }), epoch));
    await new Promise(resolve => setTimeout(resolve));
    await call(["tally"], "bump", []);

    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-release": id });
    expect(headers(fetch, 2)).toMatchObject({ "x-expressive-release": id });
  });

  it("will re-attach every twin when the connection's epoch changes, before the call resolves, keeping one that is current", async () => {
    history.replaceState(null, "", "/tally/sub");
    const fetch = serve(
      { body: snap({ total: 0 }, "a:1") },
      { body: snap({ count: 0 }, "b:1") },
      { body: () => ({ value: 1, frame: { [idOf(fetch, 0)]: { patch: { total: 1 }, version: "a:2" } } }), epoch: "e2" },
      { body: snap({ total: 1 }, "a:2"), epoch: "e2" },
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

describe("stream", () => {
  const settle = () => new Promise(resolve => setTimeout(resolve));

  function fnv(text: string) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
    return hash >>> 0;
  }

  async function attached(...replies: Reply[]) {
    const fetch = serve({ body: snap({ total: 0 }, "g:1") }, ...replies);
    const tally = twin(["tally"], {}, ["total"], "Tally").new() as any;

    await vi.waitFor(() => expect(tally.total).toBe(0));

    return { fetch, tally, source: Source.opened[0], id: idOf(fetch, 0) };
  }

  it("will open one stream per tab on the first twin, on the tab's connection", async () => {
    const { fetch } = await attached({ body: snap({}, "g:1") });
    twin(["tally"], {}, [], "Other").new();

    expect(Source.opened).toHaveLength(1);
    expect(Source.opened[0].url).toBe(`/.expressive/stream?connection=${headers(fetch, 0)["x-expressive-connection"]}`);
  });

  it("will pull a twin the stream calls stale, by its version", async () => {
    const { fetch, tally, source, id } = await attached({ body: snap({ total: 3 }, "g:2") });

    source.emit("stale", { [id]: ["total"], "Gone-X": ["total"] });
    await vi.waitFor(() => expect(tally.total).toBe(3));

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-get": "default", "x-expressive-twin": id, "if-none-match": "g:1" });
  });

  it("will pull once more for news that arrives during a pull, not once per notice", async () => {
    const { fetch, tally, source, id } = await attached(
      { body: snap({ total: 1 }, "g:2") },
      { body: snap({ total: 2 }, "g:3") },
    );

    source.emit("stale", { [id]: ["total"] });
    source.emit("stale", { [id]: ["total"] });
    source.emit("stale", { [id]: ["total"] });

    await vi.waitFor(() => expect(tally.total).toBe(2));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("will keep listening after a failed pull", async () => {
    const { tally, source, id } = await attached(
      { body: { message: "Internal error." }, status: 500 },
      { body: snap({ total: 5 }, "g:2") },
    );

    source.emit("stale", { [id]: ["total"] });
    await settle();
    source.emit("stale", { [id]: ["total"] });

    await vi.waitFor(() => expect(tally.total).toBe(5));
  });

  it("will re-attach every twin when the stream says hello from a new epoch", async () => {
    const { fetch, source, id } = await attached({ body: null, status: 304, epoch: "e2" });

    source.emit("hello", { epoch: "e1" });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);

    source.emit("hello", { epoch: "e2" });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-twin": id, "if-none-match": "g:1" });
  });

  it("will pull every twin when a heartbeat's checksum differs from its own", async () => {
    const { fetch, source, id } = await attached({ body: null, status: 304 });

    source.emit("beat", { sum: fnv(`${id}@g:1`) });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);

    source.emit("beat", { sum: 0 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});

describe("pooled twin", () => {
  const tick = () => new Promise(resolve => setTimeout(resolve));

  it("will build off any fiber at the detached root, naming its class", async () => {
    const fetch = serve({ body: snap({ items: 0 }, "c:1") });
    const Cart = twin(["shop"], { add: "/shop#Cart.add" }, ["items"], "Cart", "/shop#Cart");
    const cart = Cart.new() as any;

    expect(fetch).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(cart.items).toBe(0));

    expect(fetch).toHaveBeenCalledWith("/.expressive/detached", expect.anything());
    expect(headers(fetch, 0)).toMatchObject({ "x-expressive-get": "/shop#Cart", "x-expressive-twin": idOf(fetch, 0) });
  });

  it("will build under its nearest route, at that route's place in the location", async () => {
    history.replaceState(null, "", "/shop/42/edit");
    const fetch = serve(
      { body: snap({ items: 0 }, "c:1") },
      { body: () => ({ value: 1, frame: { [idOf(fetch, 0)]: { patch: { items: 1 }, version: "c:2" } } }) },
    );
    const Cart = twin(["shop"], { add: "/shop#Cart.add" }, ["items"], "Cart", "/shop#Cart");
    const context = Context.root.push();
    const route = Spot.new({ base: "/shop", to: ":id" });

    context.add(route);
    const cart = Cart.new() as any;
    context.push(cart);

    expect(await cart.add()).toBe(1);
    expect(cart.items).toBe(1);
    expect(fetch).toHaveBeenNthCalledWith(1, "/shop/42", expect.anything());
    expect(fetch).toHaveBeenNthCalledWith(2, "/shop/42", expect.anything());
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-call": "/shop#Cart.add", "x-expressive-twin": idOf(fetch, 0), "if-none-match": "c:1" });

    history.replaceState(null, "", "/elsewhere");
    serve({ body: { value: 2, frame: {} } });
    expect(await cart.add()).toBe(2);
  });

  it("will build one per new(), for a client subclass too, which adds members of its own", async () => {
    const fetch = serve({ body: snap({ items: 2 }, "c:1") }, { body: snap({ items: 3 }, "d:1") });
    const Cart = twin(["shop"], {}, ["items"], "Cart", "/shop#Cart") as any;

    class Local extends Cart {
      get double() { return this.items * 2; }
    }

    const local = Local.new() as any;
    await vi.waitFor(() => expect(local.double).toBe(4));

    const other = Cart.new();
    await vi.waitFor(() => expect(other.items).toBe(3));

    expect(headers(fetch, 0)).toMatchObject({ "x-expressive-get": "/shop#Cart" });
    expect(idOf(fetch, 0)).not.toBe(idOf(fetch, 1));
  });

  it("will release a twin collected without being destroyed", async () => {
    const fetch = serve({ body: snap({ items: 0 }, "c:1") }, { body: { frame: {} } });
    const Cart = twin(["shop"], {}, ["items"], "Cart", "/shop#Cart");
    const cart = Cart.new() as any;
    const [registry] = Registry.made;

    await vi.waitFor(() => expect(cart.items).toBe(0));
    const id = registry.held.get(cart)!;

    registry.cleanup(id);
    Source.opened[0].emit("stale", { [id]: ["items"] });
    await tick();
    await call([], "bump", []);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-release": id });
  });

  it("will stop watching for collection once destroyed", async () => {
    serve({ body: snap({ items: 0 }, "c:1") });
    const cart = twin(["shop"], {}, ["items"], "Cart", "/shop#Cart").new() as any;
    const [registry] = Registry.made;

    expect(registry.held.has(cart)).toBe(true);
    cart.set(null);
    expect(registry.held.has(cart)).toBe(false);
  });
});


describe("child twin", () => {
  const LINE = { name: "Line", fields: ["qty", "note"], methods: { bump: "default.line.bump" }, children: { note: { name: "Note", fields: ["text"], methods: {} } } };
  const Order = () => twin(["tally"], {}, ["line"], "Order", undefined, { line: LINE });
  const entries = (id: string, frame: Record<string, { patch: Record<string, unknown>; version: string }>) =>
    Object.fromEntries(Object.entries(frame).map(([path, entry]) => [path ? `${id}.${path}` : id, entry]));
  const reply = (frame: Record<string, { patch: Record<string, unknown>; version: string }>, value?: unknown) =>
    (sent: Record<string, string>) => ({ value, frame: entries(sent["x-expressive-twin"], frame) });

  it("will build a child its owner's patch marks, named for its class, and apply its own entries", async () => {
    serve({
      body: reply({
        "": { patch: { line: { $child: "l" } }, version: "o:1" },
        line: { patch: { qty: 1, note: { $child: "n" } }, version: "l:1" },
        "line.note": { patch: { text: "hi" }, version: "n:1" },
      }),
    });
    const order = Order().new() as any;

    await vi.waitFor(() => expect(order.line.qty).toBe(1));

    expect(order.line).toBeInstanceOf(State);
    expect(order.line.constructor.name).toBe("Line");
    expect(order.line.note.text).toBe("hi");
  });

  it("will keep a child through its own generation, replace it on another, and clear it on null", async () => {
    const fetch = serve(
      { body: reply({ "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) },
      { body: reply({ "": { patch: { line: { $child: "l" } }, version: "o:2" }, line: { patch: { qty: 2 }, version: "l:2" } }) },
      { body: reply({ "": { patch: { line: { $child: "m" } }, version: "o:3" }, line: { patch: { qty: 1 }, version: "m:1" } }) },
      { body: reply({ "": { patch: { line: null }, version: "o:4" } }) },
    );
    const order = twin(["tally"], { touch: "default.touch" }, ["line"], "Order", undefined, { line: LINE }).new() as any;

    await vi.waitFor(() => expect(order.line.qty).toBe(1));
    const first = order.line;

    await order.touch();
    expect(order.line).toBe(first);
    expect(first.qty).toBe(2);

    await order.touch();
    expect(order.line).not.toBe(first);
    expect(order.line.qty).toBe(1);
    expect(order.line.note).toBeUndefined();

    await order.touch();
    expect(order.line).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("will drop a late entry for a child since replaced, or one it does not hold", async () => {
    let late!: (res: Response) => void;
    const epoch = { headers: { "x-expressive-epoch": "e1" } };
    const fetch = vi.fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify({ frame: entries(idOf(fetch, 0), { "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) }), epoch))
      .mockReturnValueOnce(new Promise<Response>(resolve => (late = resolve)))
      .mockImplementationOnce(async () => new Response(JSON.stringify({ frame: entries(idOf(fetch, 0), { "": { patch: { line: { $child: "m" } }, version: "o:2" }, line: { patch: { qty: 7 }, version: "m:1" } }) }), epoch));
    vi.stubGlobal("fetch", fetch);

    const order = Order().new() as any;
    await vi.waitFor(() => expect(order.line.qty).toBe(1));

    const slow = call(["tally"], "slow", []);
    await call(["tally"], "fast", []);
    late(new Response(JSON.stringify({ frame: entries(idOf(fetch, 0), { line: { patch: { qty: 9 }, version: "l:3" }, "line.note": { patch: { text: "x" }, version: "n:1" } }) }), epoch));
    await slow;

    expect(order.line.qty).toBe(7);
    expect(order.line.note).toBeUndefined();
  });

  it("will throw if a child field is assigned outside a reply", async () => {
    serve({ body: reply({ "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) });
    const order = Order().new() as any;

    await vi.waitFor(() => expect(order.line.qty).toBe(1));

    expect(() => (order.line.qty = 2)).toThrow(/\.qty is read-only - change it through a method\.$/);
    expect(() => (order.line = undefined)).toThrow("read-only");
  });

  it("will call a child's method through its root twin, naming the root and its version", async () => {
    const fetch = serve(
      { body: reply({ "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) },
      { body: reply({ line: { patch: { qty: 3 }, version: "l:2" } }, 3) },
    );
    const order = Order().new() as any;

    await vi.waitFor(() => expect(order.line.qty).toBe(1));

    expect(await order.line.bump(2)).toBe(3);
    expect(order.line.qty).toBe(3);
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-call": "default.line.bump", "x-expressive-twin": idOf(fetch, 0), "if-none-match": "o:1" });
  });

  it("will hold a child's entry that reaches it before its owner's snapshot, then apply it", async () => {
    let attached!: (res: Response) => void;
    const epoch = { headers: { "x-expressive-epoch": "e1" } };
    const fetch = vi.fn()
      .mockReturnValueOnce(new Promise<Response>(resolve => (attached = resolve)))
      .mockImplementation(async () => new Response(JSON.stringify({ frame: entries(idOf(fetch, 0), { line: { patch: { qty: 2 }, version: "l:2" } }) }), epoch));
    vi.stubGlobal("fetch", fetch);

    const order = Order().new() as any;

    await call(["tally"], "bump", []);
    attached(new Response(JSON.stringify({ frame: entries(idOf(fetch, 0), { "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) }), epoch));

    await vi.waitFor(() => expect(order.line.qty).toBe(2));
  });

  it("will pull its root twin when the stream calls a child stale", async () => {
    const fetch = serve(
      { body: reply({ "": { patch: { line: { $child: "l" } }, version: "o:1" }, line: { patch: { qty: 1 }, version: "l:1" } }) },
      { body: reply({ line: { patch: { qty: 4 }, version: "l:2" } }) },
    );
    const order = Order().new() as any;

    await vi.waitFor(() => expect(order.line.qty).toBe(1));
    Source.opened[0].emit("stale", { [`${idOf(fetch, 0)}.line`]: ["qty"] });

    await vi.waitFor(() => expect(order.line.qty).toBe(4));
    expect(headers(fetch, 1)).toMatchObject({ "x-expressive-get": "default", "x-expressive-twin": idOf(fetch, 0), "if-none-match": "o:1" });
  });
});
