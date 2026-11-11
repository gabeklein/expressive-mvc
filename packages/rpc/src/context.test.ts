import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Context, get, set, Model } from "@expressive/mvc";

import { construct, Current, headersOf, install, onBuild, seated, within, type Seat } from "./context";

const request = (url = "/", cookie = "") => new Request(`http://localhost${url}`, { headers: { cookie } });
const call = <T>(segments: string[], run: () => T) => within(request("/" + segments.join("/")), segments, run);

beforeAll(() => install());
afterEach(() => vi.useRealTimers());

const walk = <T>(req: Request, segments: string[], seats: (Seat | undefined)[], run: () => T) => within(req, segments, run, seats);

describe("server get", () => {
  it("will leave a bare context lookup outside a call to the host", async () => {
    expect(Context.get()).toBe(Context.root);
    expect(await call(["bare"], () => Context.get())).not.toBe(Context.root);
  });

  it("will throw outside a call", () => {
    class Tally extends Model {}
    expect(() => Tally.get()).toThrow("Server Model resolves only within a call.");
  });

  it("will find what context provides, or throw if missing unless optional", async () => {
    class Missing extends Model {}

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
    class Blog extends Model { static ttl = 60; }

    const here = await walk(request(), ["blog"], [undefined, Blog], () => Blog.get());
    const below = await walk(request(), ["blog", "a"], [undefined, Blog], () => Blog.get());

    expect(below).toBe(here);
    await expect(walk(request(), ["docs"], [], () => Blog.get())).rejects.toThrow("Could not find Blog in context.");
  });

  it("will drop a seat after its last call by default", async () => {
    class Tally extends Model {}

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will keep a seat after its last call for the ttl install() names", async () => {
    vi.useFakeTimers();
    install({ ttl: 300 });
    class Tally extends Model {}

    try {
      const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

      vi.advanceTimersByTime(299_000);
      expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).toBe(first);

      vi.advanceTimersByTime(300_000);
      expect(first.get(null)).toBe(true);
      expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
    } finally {
      install();
    }
  });

  it("will keep a seat between calls for its ttl", async () => {
    vi.useFakeTimers();
    class Tally extends Model { static ttl = 60; }

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).toBe(first);

    vi.advanceTimersByTime(60_000);
    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will drop a seat after its call with a ttl of zero", async () => {
    class Tally extends Model { static ttl = 0; }

    const first = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

    expect(first.get(null)).toBe(true);
    expect(await walk(request(), ["tally"], [undefined, Tally], () => Tally.get())).not.toBe(first);
  });

  it("will keep a seat while another call holds it", async () => {
    class Tally extends Model { static ttl = 0; }
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
    class Before extends Model { static ttl = 60; }
    class After extends Model { static ttl = 60; }
    class Post extends Model { static ttl = 60; }

    const [before, post] = await walk(request(), ["blog", "a"], [undefined, Before, Post], () => [Before.get(), Post.get()]);
    const after = await walk(request(), ["blog"], [undefined, After], () => After.get());

    expect(before.get(null)).toBe(true);
    expect(post.get(null)).toBe(true);
    expect(after).toBeInstanceOf(After);
    expect(await walk(request(), ["blog", "a"], [undefined, After, Post], () => Post.get())).not.toBe(post);
  });

  it("will give each layer its own seat, a deeper one over one above", async () => {
    class Page extends Model { static ttl = 60; }

    const above = await walk(request(), ["blog"], [undefined, Page], () => Page.get());
    const a = await walk(request(), ["blog", "a"], [undefined, Page, Page], () => Page.get());
    const b = await walk(request(), ["blog", "b"], [undefined, Page, Page], () => Page.get());

    expect(a).not.toBe(above);
    expect(b).not.toBe(a);
    expect(await walk(request(), ["blog", "a", "x"], [undefined, Page, Page], () => Page.get())).toBe(a);
    expect(await walk(request(), ["blog", "c"], [undefined, Page], () => Page.get())).toBe(above);
  });

  it("will resolve fields from the context the seat lives in", async () => {
    class Tally extends Model { current = get(Current); }

    const url = await walk(request("/tally"), ["tally"], [undefined, Tally], () => Tally.get().current.url.pathname);
    expect(url).toBe("/tally");
  });

  it("will provide a seat's children there and below, a lazy one once its owner reads it", async () => {
    class Total extends Model { value = 0; }
    class Draft extends Model {}
    class Tally extends Model {
      static ttl = 60;
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
    class Session extends Model { static key() { return Current.get().cookies.user; } }
    class Cart extends Model {}

    const a = await walk(as("a"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()]);
    const b = await walk(as("b"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()]);

    expect(b[0]).not.toBe(a[0]);
    expect(b[1]).not.toBe(a[1]);
    expect(await walk(as("a"), ["shop"], [Session, Cart], () => [Session.get(), Cart.get()])).toEqual(a);
  });

  it("will pass the location through when a key is undefined", async () => {
    class Shared extends Model { static ttl = 60; static key() { return undefined; } }

    const a = await walk(as("a"), ["docs"], [undefined, Shared], () => Shared.get());
    expect(await walk(as("b"), ["docs"], [undefined, Shared], () => Shared.get())).toBe(a);
  });

  it("will run a key with the seats above it in reach", async () => {
    class Session extends Model { static key() { return Current.get().cookies.user; } org = "acme"; }
    class Org extends Model { static key() { return Session.get().org; } }

    const org = await walk(as("a"), ["org"], [Session, Org], () => Org.get());
    expect(org).toBeInstanceOf(Org);
  });

  it("will deny a call whose key throws, creating nothing", async () => {
    class Gate extends Model { static key(): string { throw new Error("Denied"); } }
    const run = vi.fn();

    await expect(walk(request(), ["gate"], [undefined, Gate], run)).rejects.toThrow("Denied");
    expect(run).not.toHaveBeenCalled();
  });

  it("will wait for a new seat's async new() before the layers below and the call", async () => {
    let done!: () => void;
    class Session extends Model {
      user?: string = undefined;

      protected async new() {
        await new Promise<void>(resolve => (done = resolve));
        this.user = "ada";
      }
    }
    class Account extends Model { static key() { return Session.get().user; } }

    const ran = vi.fn(() => Session.get().user);
    const first = walk(request(), ["account"], [Session, Account], ran);
    const second = walk(request(), ["account"], [Session, Account], ran);

    await new Promise(resolve => setTimeout(resolve));
    expect(ran).not.toHaveBeenCalled();

    done();
    expect(await first).toBe("ada");
    expect(await second).toBe("ada");
  });

  it("will deny the calls walking through a seat whose async new() rejects, unreported, and build afresh after", async () => {
    let attempt = 0;
    class Denied extends Error { status = 403; }
    class Gate extends Model {
      protected async new() {
        if (!attempt++) throw new Denied("Not yours");
      }
    }
    const run = vi.fn();
    const failed = vi.fn();

    process.on("uncaughtException", failed);

    try {
      const walks = [walk(request(), ["gate"], [undefined, Gate], run), walk(request(), ["gate"], [undefined, Gate], run)];

      for (const denied of walks) await expect(denied).rejects.toBeInstanceOf(Denied);
      expect(run).not.toHaveBeenCalled();

      await walk(request(), ["gate"], [undefined, Gate], run);
      await new Promise(resolve => setTimeout(resolve));
    } finally {
      process.off("uncaughtException", failed);
    }

    expect(run).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
  });

  it("will report a seat's other errors as usual", async () => {
    class Tally extends Model {
      static ttl = 60;
      total = 0;
    }
    const caught = vi.fn();
    const stop = Model.on({ catch: (_error, kind) => void caught(kind) });

    try {
      const tally = await walk(request(), ["tally"], [undefined, Tally], () => Tally.get());

      tally.get(({ total }) => {
        if (total) throw new Error("effect");
      });
      tally.total = 1;
      await new Promise(resolve => setTimeout(resolve));
    } finally {
      stop();
    }

    expect(caught).toHaveBeenCalledWith("effect");
  });

  it("will throw if a key is not a string, a number or undefined", async () => {
    class Bad extends Model { static key() { return {} as any; } }

    await expect(walk(request(), ["bad"], [undefined, Bad], () => {})).rejects.toThrow("Bad.key() returned [object Object] - a key is a string, a number or undefined.");
  });

  it("will evict a seat's layer and everything below when it ends", async () => {
    class Blog extends Model {}
    class Post extends Model { static ttl = 60; }

    const [blog, post] = await walk(request(), ["blog", "a"], [undefined, Blog, Post], () => [Blog.get(), Post.get()]);
    blog.set(null);

    expect(post.get(null)).toBe(true);

    const [again, fresh] = await walk(request(), ["blog", "a"], [undefined, Blog, Post], () => [Blog.get(), Post.get()]);
    expect(again).not.toBe(blog);
    expect(fresh).not.toBe(post);
  });

  it("will evict the unseated layers below a seat that ends", async () => {
    class Shop extends Model {}
    class Cart extends Model {}

    const [shop, cart] = await walk(request(), ["shop", "a"], [undefined, Shop], () => [Shop.get(), construct(Cart)] as const);
    shop.set(null);

    expect(cart.instance.get(null)).toBe(true);
  });
});

describe("Current", () => {
  it("will read the request in progress", async () => {
    const seen = await within(request("/tally?x=1", "a=1; b=x%20y"), ["tally"], () => {
      const { url, cookies, request } = Current.get();
      return { path: url.pathname, query: url.searchParams.get("x"), cookies, method: request.headers.get("cookie") };
    });

    expect(seen).toEqual({ path: "/tally", query: "1", cookies: { a: "1", b: "x y" }, method: "a=1; b=x%20y" });
  });

  it("will read no cookies from a request without them", async () => {
    expect(await within(new Request("http://localhost/"), [], () => Current.get().cookies)).toEqual({});
  });

  it("will refuse writes", async () => {
    await call([], () => {
      const current = Current.get() as any;
      expect(() => { current.request = {}; }).toThrow("Current is read-only.");
      expect(() => { current.url = {}; }).toThrow("Current is read-only.");
      expect(() => { current.cookies = {}; }).toThrow("Current is read-only.");
    });
  });
  it("will gather headers for the reply", async () => {
    const req = new Request("https://example.com/");

    expect(headersOf(req)).toBeUndefined();

    await within(req, [], () => {
      const current = Current.get();

      current.setHeader("cache-control", "no-store");
      current.setHeader("cache-control", "private");
      current.setHeader("Set-Cookie", "raw=1");
      current.setHeader("set-cookie", "raw=2");
    });

    const headers = headersOf(req)!;

    expect(headers.get("cache-control")).toBe("private");
    expect(headers.getSetCookie()).toEqual(["raw=1", "raw=2"]);
  });
});

describe("pool", () => {
  class Cart extends Model {}

  const parentOf = (state: Model) => Context.get(state).parent;

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

describe("hooks", () => {
  it("will find the seat of the call's layer", async () => {
    class Blog extends Model {}

    expect(await within(request(), ["unseated"], () => seated())).toBeUndefined();
    expect(await walk(request(), ["blog"], [undefined, Blog], () => seated() === Blog.get())).toBe(true);
  });

  it("will hand each seat and construction it builds to the build hook", async () => {
    class Blog extends Model {}
    class Cart extends Model {}
    const built = vi.fn();

    onBuild(built);

    const seat = await walk(request(), ["shelf"], [undefined, Blog], () => Blog.get());
    const cart = await call(["shelf"], () => construct(Cart));

    expect(built.mock.calls).toEqual([[seat], [cart.instance]]);
    cart.drop();
  });
});
