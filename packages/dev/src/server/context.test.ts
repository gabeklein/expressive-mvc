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

  it("will give one instance per key within a call, gone after it by default", async () => {
    class Tally extends State { total = 0; }

    const first = await call(["tally"], () => {
      const tally = Tally.use();
      expect(Tally.use()).toBe(tally);
      return tally;
    });

    expect(first.get(null)).toBe(true);
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will keep an instance between calls for its ttl", async () => {
    vi.useFakeTimers();
    class Tally extends State { static ttl = 60; total = 0; }

    const first = await call(["tally"], () => Tally.use());
    expect(await call(["tally"], () => Tally.use())).toBe(first);

    vi.advanceTimersByTime(60_000);
    expect(first.get(null)).toBe(true);
    expect(await call(["tally"], () => Tally.use())).not.toBe(first);
  });

  it("will key by location unless the class keys itself", async () => {
    class Page extends State { static ttl = 60; }
    class Shared extends State { static ttl = 60; static key() { return "shared"; } }
    class Narrow extends State { static ttl = 60; static key(prefix: string) { return `${prefix}#narrow`; } }

    const a = await call(["blog", "a"], () => [Page.use(), Shared.use(), Narrow.use()]);
    const b = await call(["blog", "b"], () => [Page.use(), Shared.use(), Narrow.use()]);
    const again = await call(["blog", "a"], () => [Page.use(), Shared.use(), Narrow.use()]);

    expect(b[0]).not.toBe(a[0]);
    expect(b[1]).toBe(a[1]);
    expect(b[2]).not.toBe(a[2]);
    expect(again).toEqual(a);
    expect(a[2]).not.toBe(a[0]);
  });

  it("will throw if a key is neither a string nor a number", async () => {
    class Bad extends State { static key() { return undefined as any; } }
    await expect(call([], () => Bad.use())).rejects.toThrow("Bad.key() returned undefined - a key is a string or a number.");
  });

  it("will drop an instance the app destroys", async () => {
    class Tally extends State { static ttl = 60; }

    const first = await call(["tally"], () => Tally.use());
    first.set(null);

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
