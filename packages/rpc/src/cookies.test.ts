import { beforeAll, describe, expect, it } from "vitest";
import { get, Model } from "@expressive/mvc";

import { headersOf, install, within } from "./context";
import { Cookies } from "./cookies";

beforeAll(install);

class Prefs extends Cookies {
  static options = { session: { maxAge: 60.5, domain: "example.com", sameSite: "Strict" as const, partitioned: true }, theme: { httpOnly: false, secure: false, path: "/app" } };
  session?: string = undefined;
  theme = "light";
  count?: number = undefined;
}

const at = (url: string, cookie?: string) => new Request(url, { headers: cookie ? { cookie } : {} });
const sent = (request: Request) => headersOf(request)?.getSetCookie() ?? [];

describe("Cookies", () => {
  it("will read the request's cookies as fields, with defaults for the rest", async () => {
    const request = at("http://localhost/", "session=a%20b; other=1; bad=%E0%A4%A; session=shadowed; flag");

    await within(request, [], () => {
      const prefs = Prefs.get();

      expect(prefs).toBe(Prefs.get());
      expect(prefs.get()).toEqual({ session: "a b", theme: "light", count: undefined });
    });

    expect(sent(request)).toEqual([]);
  });

  it("will keep a raw value that does not decode", async () => {
    class Raw extends Cookies {
      bad?: string = undefined;
    }

    await within(at("http://localhost/", "bad=%E0%A4%A"), [], () => expect(Raw.get().bad).toBe("%E0%A4%A"));
  });

  it("will send what changed, with each cookie's options", async () => {
    const request = at("https://example.com/", "theme=dark; count=2");

    await within(request, [], () => {
      Prefs.set({ session: "a b;c", theme: "dark" });
      Prefs.get().count = 3;
      expect(Prefs.get().session).toBe("a b;c");
    });

    expect(sent(request)).toEqual([
      "session=a%20b%3Bc; Path=/; Max-Age=60; Domain=example.com; Secure; HttpOnly; Partitioned; SameSite=Strict",
      "count=3; Path=/; Secure; HttpOnly; SameSite=Lax",
    ]);
    expect(sent(request)).toHaveLength(2);
  });

  it("will remove a cookie set to undefined or null, with the path and domain it was set with", async () => {
    const request = at("http://localhost/", "session=x; theme=dark");

    await within(request, [], () => Prefs.set({ session: undefined, theme: null as unknown as string }));

    expect(sent(request)).toEqual([
      "session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=example.com; HttpOnly; Partitioned; SameSite=Strict",
      "theme=; Path=/app; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax",
    ]);
  });

  it("will keep one instance per request and class", async () => {
    class Other extends Cookies {
      theme = "none";
    }

    const one = await within(at("http://localhost/", "theme=dark"), [], () => [Prefs.get(), Other.get()] as const);
    const two = await within(at("http://localhost/"), [], () => Prefs.get());

    expect(one[0]).not.toBe(two);
    expect(one[1].theme).toBe("dark");
    expect(two.theme).toBe("light");
  });

  it("will refuse outside a call, a bad field name, and a context lookup", async () => {
    class Bad extends Cookies {
      "a b" = "";
    }

    class Holder extends Model {
      prefs = get(Prefs);
    }

    expect(() => Prefs.get()).toThrow("Prefs.get() reads the request's cookies - call it within a call.");
    await within(at("http://localhost/"), [], () => {
      expect(() => Bad.get()).toThrow("Bad.a b is not a valid cookie name.");
      expect(() => Holder.new()).toThrow();
    });
  });
});
