import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { get, State } from "@expressive/mvc";

import { Current, install, within, type Seat } from "./context";

const request = (url = "/", cookie = "") => ({ url, headers: { cookie } }) as IncomingMessage;
const call = <T>(segments: string[], run: () => T) => within(request("/" + segments.join("/")), segments, run);

beforeAll(install);
afterEach(() => vi.useRealTimers());

describe("server use", () => {
  it("will throw outside a call", () => {
    class Tally extends State {}
    expect(() => Tally.use()).toThrow("Server State resolves only within a sidecar call.");
  });

  it("will give one instance per layer within a call", async () => {
    class Tally extends State {}

    await call(["tally"], () => {
      expect(Tally.use()).toBe(Tally.use());
    });
  });

  it("will keep an instance five minutes after its last call by default", async () => {
    vi.useFakeTimers();
    class Tally extends State {}

    const first = await call(["tally"], () => Tally.use());

    vi.advanceTimersByTime(299_000);
    expect(await call(["tally"], () => Tally.use())).toBe(first);

    vi.advanceTimersByTime(300_000);
    expect(first.get(null)).toBe(true);
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will keep an instance between calls for its ttl", async () => {
    vi.useFakeTimers();
    class Tally extends State { static ttl = 60; }

    const first = await call(["tally"], () => Tally.use());
    expect(await call(["tally"], () => Tally.use())).toBe(first);

    vi.advanceTimersByTime(60_000);
    expect(first.get(null)).toBe(true);
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will drop an instance after its call with a ttl of zero", async () => {
    class Tally extends State { static ttl = 0; }

    const first = await call(["tally"], () => Tally.use());

    expect(first.get(null)).toBe(true);
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will give each layer its own instance", async () => {
    class Page extends State { static ttl = 60; }

    const a = await call(["blog", "a"], () => Page.use());
    const b = await call(["blog", "b"], () => Page.use());

    expect(b).not.toBe(a);
    expect(await call(["blog", "a"], () => Page.use())).toBe(a);
  });

  it("will drop an instance the app destroys", async () => {
    class Tally extends State { static ttl = 60; }

    const first = await call(["tally"], () => Tally.use());
    first.set(null);

    await expect(call(["tally"], () => Tally.get())).rejects.toThrow("Could not find Tally in context.");
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will resolve fields from the context the instance lives in", async () => {
    class Tally extends State { current = get(Current); }

    const url = await call(["tally"], () => Tally.use().current.url.pathname);
    expect(url).toBe("/tally");
  });
});

describe("server get", () => {
  it("will find what context provides, or throw if missing unless optional", async () => {
    class Missing extends State {}

    await call([], () => {
      expect(Current.get()).toBeInstanceOf(Current);
      expect(Missing.get(false)).toBeUndefined();
      expect(() => Missing.get()).toThrow("Could not find");
    });
  });

  it("will not find a class before use() makes it", async () => {
    class Tally extends State {}

    await expect(call(["tally"], () => Tally.get())).rejects.toThrow("Could not find Tally in context.");
  });

  it("will find what use() made, in its layer and below", async () => {
    class Tally extends State { static ttl = 60; }

    const made = await call(["blog"], () => {
      const tally = Tally.use();
      expect(Tally.get()).toBe(tally);
      return tally;
    });

    expect(await call(["blog"], () => Tally.get())).toBe(made);
    expect(await call(["blog", "a"], () => Tally.get())).toBe(made);
    await expect(call(["docs"], () => Tally.get())).rejects.toThrow("Could not find Tally in context.");
  });

  it("will find what a deeper use() made over one above", async () => {
    class Tally extends State { static ttl = 60; }

    const above = await call(["blog"], () => Tally.use());
    const below = await call(["blog", "a"], () => Tally.use());

    expect(below).not.toBe(above);
    expect(await call(["blog", "a", "x"], () => Tally.get())).toBe(below);
    expect(await call(["blog", "b"], () => Tally.get())).toBe(above);
  });

  it("will not find what use() made once it expires", async () => {
    vi.useFakeTimers();
    class Tally extends State { static ttl = 60; }

    await call(["tally"], () => Tally.use());
    vi.advanceTimersByTime(60_000);

    await expect(call(["tally"], () => Tally.get())).rejects.toThrow("Could not find Tally in context.");
  });
});

describe("seats", () => {
  const as = (user: string) => request("/", `user=${user}`);
  const walk = <T>(req: IncomingMessage, segments: string[], seats: (Seat | undefined)[], run: () => T) => within(req, segments, run, seats);

  it("will seat a layer's default as a call walks through it, found by get() there and below", async () => {
    class Blog extends State {}

    const here = await walk(request(), ["blog"], [undefined, Blog], () => Blog.get());
    const below = await walk(request(), ["blog", "a"], [undefined, Blog], () => Blog.get());

    expect(below).toBe(here);
    expect(await walk(request(), ["blog"], [undefined, Blog], () => Blog.use())).toBe(here);
  });

  it("will narrow everything below by a seat's key", async () => {
    class Session extends State { static key() { return Current.get().cookies.user; } }
    class Cart extends State {}

    const a = await walk(as("a"), ["shop"], [Session], () => [Session.get(), Cart.use()]);
    const b = await walk(as("b"), ["shop"], [Session], () => [Session.get(), Cart.use()]);

    expect(b[0]).not.toBe(a[0]);
    expect(b[1]).not.toBe(a[1]);
    expect(await walk(as("a"), ["shop"], [Session], () => [Session.get(), Cart.use()])).toEqual(a);
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

    const [blog, post] = await walk(request(), ["blog", "a"], [undefined, Blog], () => [Blog.get(), Post.use()]);
    blog.set(null);

    expect(post.get(null)).toBe(true);

    const [again, fresh] = await walk(request(), ["blog", "a"], [undefined, Blog], () => [Blog.get(), Post.use()]);
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
