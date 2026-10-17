import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { Context, get, set, State } from "@expressive/mvc";

import { construct, Current, install, within, type Seat } from "./context";

const request = (url = "/", cookie = "") => ({ url, headers: { cookie } }) as IncomingMessage;
const call = <T>(segments: string[], run: () => T) => within(request("/" + segments.join("/")), segments, run);

beforeAll(install);
afterEach(() => vi.useRealTimers());

const walk = <T>(req: IncomingMessage, segments: string[], seats: (Seat | undefined)[], run: () => T) => within(req, segments, run, seats);

describe("server get", () => {
  it("will throw outside a call", () => {
    class Tally extends State {}
    expect(() => Tally.get()).toThrow("Server State resolves only within a sidecar call.");
  });

  it("will find what context provides, or throw if missing unless optional", async () => {
    class Missing extends State {}

    await call([], () => {
      expect(Current.get()).toBeInstanceOf(Current);
      expect(Missing.get(false)).toBeUndefined();
      expect(() => Missing.get()).toThrow("Could not find");
    });
  });
});

describe("seats", () => {
  const as = (user: string) => request("/", `user=${user}`);

  it("will seat a layer's default as a call walks through it, found by get() there and below", async () => {
    class Blog extends State {}

    const here = await walk(request(), ["blog"], [undefined, Blog], () => Blog.get());
    const below = await walk(request(), ["blog", "a"], [undefined, Blog], () => Blog.get());

    expect(below).toBe(here);
    await expect(walk(request(), ["docs"], [], () => Blog.get())).rejects.toThrow("Could not find Blog in context.");
  });

  it("will keep a seat five minutes after its last call by default", async () => {
    vi.useFakeTimers();
    class Tally extends State {}

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

    vi.advanceTimersByTime(299_000);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).toBe(first);

    vi.advanceTimersByTime(300_000);
    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will keep a seat between calls for its ttl", async () => {
    vi.useFakeTimers();
    class Tally extends State { static ttl = 60; }

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).toBe(first);

    vi.advanceTimersByTime(60_000);
    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will drop a seat after its call with a ttl of zero", async () => {
    class Tally extends State { static ttl = 0; }

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will keep a seat while another call holds it", async () => {
    class Tally extends State { static ttl = 0; }
    let finish!: () => void;
    const open = new Promise<void>(resolve => (finish = resolve));

    const held = walk(request(), ["tally"], [undefined, Tally], async () => {
      await open;
      return Tally.get();
    });
    const quick = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

    expect(quick.get(null)).toBe(false);
    finish();
    expect(await held).toBe(quick);
    expect(quick.get(null)).toBe(true);
  });

  it("will replace a seat whose class changed, evicting the layers below", async () => {
    class Before extends State { static ttl = 60; }
    class After extends State { static ttl = 60; }
    class Post extends State { static ttl = 60; }

    const [before, post] = await walk(request(), ["blog", "a"], [undefined, Before, Post], () => [Before.get(), Post.get()]);
    const after = await walk(request(), ["blog"], [undefined, After], () => After.get());

    expect(before.get(null)).toBe(true);
    expect(post.get(null)).toBe(true);
    expect(after).toBeInstanceOf(After);
    expect(await walk(request(), ["blog", "a"], [undefined, After, Post], () => Post.get())).not.toBe(post);
  });

  it("will give each layer its own seat, a deeper one over one above", async () => {
    class Page extends State { static ttl = 60; }

    const above = await walk(request(), ["blog"], [undefined, Page], () => Page.get());
    const a = await walk(request(), ["blog", "a"], [undefined, Page, Page], () => Page.get());
    const b = await walk(request(), ["blog", "b"], [undefined, Page, Page], () => Page.get());

    expect(a).not.toBe(above);
    expect(b).not.toBe(a);
    expect(await walk(request(), ["blog", "a", "x"], [undefined, Page, Page], () => Page.get())).toBe(a);
    expect(await walk(request(), ["blog", "c"], [undefined, Page], () => Page.get())).toBe(above);
  });

  it("will resolve fields from the context the seat lives in", async () => {
    class Tally extends State { current = get(Current); }

    const url = await walk(request("/tally"), ["tally"], [undefined, Tally], () => Tally.get().current.url.pathname);
    expect(url).toBe("/tally");
  });

  it("will provide a seat's children there and below, a lazy one once its owner reads it", async () => {
    class Total extends State { value = 0; }
    class Draft extends State {}
    class Tally extends State {
      total = new Total();
      draft = set(() => new Draft());
    }

    const [tally, total] = await walk(request(), ["tally"], [undefined, Tally], () => [Tally.get(), Total.get()] as const);

    expect(total).toBe(tally.total);
    expect(await walk(request(), ["tally", "x"], [undefined, Tally], () => Total.get())).toBe(total);

    await expect(walk(request(), ["tally"], [undefined, Tally], () => Draft.get())).rejects.toThrow("Could not find Draft in context.");

    const draft = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get().draft);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Draft.get())).toBe(draft);

    tally.set(null);
    expect(total.get(null)).toBe(true);
    expect(draft.get(null)).toBe(true);
  });

  it("will narrow everything below by a seat's key", async () => {
    class Session extends State { static key() { return Current.get().cookies.user; } }
    class Cart extends State {}

    const a = await walk(as("a"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()]);
    const b = await walk(as("b"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()]);

    expect(b[0]).not.toBe(a[0]);
    expect(b[1]).not.toBe(a[1]);
    expect(await walk(as("a"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()])).toEqual(a);
  });

  it("will pass the location through when a key is undefined", async () => {
    class Shared extends State { static key() { return undefined; } }

    const a = await walk(as("a"), ["docs"], [undefined, Shared], () => Shared.get());
    expect(await walk(as("b"), ["docs"], [undefined, Shared], () => Shared.get())).toBe(a);
  });

  it("will run a key with the seats above it in reach", async () => {
    class Session extends State { static key() { return Current.get().cookies.user; } org = "acme"; }
    class Org extends State { static key() { return Session.get().org; } }

    const org = await walk(as("a"), ["org"], [Session, Org], () => Org.get());
    expect(org).toBeInstanceOf(Org);
  });

  it("will deny a call whose key throws, creating nothing", async () => {
    class Gate extends State { static key(): string { throw new Error("Denied"); } }
    const run = vi.fn();

    await expect(walk(request(), ["gate"], [undefined, Gate], run)).rejects.toThrow("Denied");
    expect(run).not.toHaveBeenCalled();
  });

  it("will throw if a key is not a string, a number or undefined", async () => {
    class Bad extends State { static key() { return {} as any; } }

    await expect(walk(request(), ["bad"], [undefined, Bad], () => {})).rejects.toThrow("Bad.key() returned [object Object] - a key is a string, a number or undefined.");
  });

  it("will evict a seat's layer and everything below when it ends", async () => {
    class Blog extends State {}
    class Post extends State { static ttl = 60; }

    const [blog, post] = await walk(request(), ["blog", "a"], [undefined, Blog, Post], () => [Blog.get(), Post.get()]);
    blog.set(null);

    expect(post.get(null)).toBe(true);

    const [again, fresh] = await walk(request(), ["blog", "a"], [undefined, Blog, Post], () => [Blog.get(), Post.get()]);
    expect(again).not.toBe(blog);
    expect(fresh).not.toBe(post);
  });
});

describe("Current", () => {
  it("will read the request in progress", async () => {
    const seen = await within(request("/tally?x=1", "a=1; b=x%20y"), ["tally"], () => {
      const { url, cookies, request } = Current.get();
      return { path: url.pathname, query: url.searchParams.get("x"), cookies, method: request.headers.cookie };
    });

    expect(seen).toEqual({ path: "/tally", query: "1", cookies: { a: "1", b: "x y" }, method: "a=1; b=x%20y" });
  });

  it("will refuse writes", async () => {
    await call([], () => {
      const current = Current.get() as any;
      expect(() => { current.request = {}; }).toThrow("Current is read-only.");
      expect(() => { current.url = {}; }).toThrow("Current is read-only.");
      expect(() => { current.cookies = {}; }).toThrow("Current is read-only.");
    });
  });
});

describe("pool", () => {
  class Cart extends State {}

  const parentOf = (state: State) => Context.get(state).parent;

  it("will build an instance of its own in the call's layer, holding the layer alive", async () => {
    const a = await call(["shop"], () => construct(Cart));
    const b = await call(["shop"], () => construct(Cart));

    expect(a.instance).not.toBe(b.instance);
    expect(parentOf(a.instance)).toBe(parentOf(b.instance));

    a.drop();
    a.drop();
    expect(a.instance.get(null)).toBe(true);

    const c = await call(["shop"], () => construct(Cart));
    expect(parentOf(c.instance)).toBe(parentOf(b.instance));

    expect(await call(["shop"], () => b.current())).toBe(true);
    expect(await call(["other"], () => b.current())).toBe(false);

    b.drop();
    expect(await call(["shop"], () => b.current())).toBe(false);
    c.drop();

    const d = await call(["shop"], () => construct(Cart));
    expect(parentOf(d.instance)).not.toBe(parentOf(b.instance));
    d.drop();
  });

  it("will build off any layer when detached", async () => {
    const a = construct(Cart, true);
    const b = construct(Cart, true);

    expect(parentOf(a.instance)).toBe(parentOf(b.instance));
    expect(Context.get(a.instance).get(Current)).toBeInstanceOf(Current);

    expect(await call(["any"], () => a.current())).toBe(true);
    a.drop();
    expect(a.instance.get(null)).toBe(true);
    expect(a.current()).toBe(false);
  });
});

