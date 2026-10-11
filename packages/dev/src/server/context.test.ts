import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { get, State } from "@expressive/mvc";

import { Current, install, within } from "./context";

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
