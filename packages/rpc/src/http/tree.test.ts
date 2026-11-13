import { describe, expect, it } from "vitest";

import { Model } from "@expressive/mvc";

import { Current, install, type Params } from "../context";
import { Cookies } from "../cookies";
import { Forbidden, NotFound, Unauthorized } from "../errors";
import { unbased } from "../segments";
import { endpoints, find, gates, router, type Node } from "./tree";

install();

const route = (name: string, extra: Record<string, unknown> = {}) => async () => ({
  GET: (_: Request, params: Params) => Response.json({ name, params }),
  ...extra,
});

class Session extends Model {
  static ttl = 0;
  static key() {
    return Current.get().cookies.user;
  }

  user = "";

  protected async new() {
    await Promise.resolve();
    const user = Current.get().cookies.user;
    if (!user) throw new Unauthorized("Sign in.");
    this.user = user;
  }
}

class Job extends Model {
  static ttl = 0;
  static key() {
    return Current.get().params.id;
  }

  id = "";

  protected async new() {
    const { id } = Current.get().params;
    if (id === "gone") throw new NotFound(`No job ${id}.`);
    this.id = id;
  }
}

class Prefs extends Cookies {
  theme?: string = undefined;
}

const tree: Node = {
  index: route("root"),
  calls: async () => ({ calls: { ping: async () => "pong" }, classes: {} }),
  children: {
    files: {
      index: route("files"),
      children: {
        new: { file: route("new") },
        ":name": { file: route("named") },
        "*": { file: route("rest") },
      },
    },
    account: {
      gate: async () => Session,
      calls: async () => ({ calls: { who: async () => Session.get().user }, classes: {} }),
      children: {
        me: { file: async () => ({ GET: () => new Response(Session.get().user), POST: () => new Response("posted") }) },
        jobs: {
          children: {
            ":id": {
              gate: async () => Job,
              children: {
                events: { file: async () => ({ GET: (_: Request, { id }: Params) => new Response(`${Session.get().user}:${Job.get().id}:${id}`) }) },
              },
            },
          },
        },
        theme: { file: async () => ({ PUT: () => { Prefs.set({ theme: "dark" }); return new Response(null, { status: 204 }); } }) },
        odd: { file: async () => ({ GET: () => "text" }) },
        page: { file: async () => ({ GET: "<p>hi</p>" }) },
        node: { file: async () => ({ GET: (_req: unknown, _res: unknown, _next: unknown) => undefined }) },
        late: { file: async () => ({ GET: () => { throw new Forbidden("Not yours."); } }) },
      },
    },
    docs: {
      children: {
        ":slug": { children: { edit: { file: route("edit") } } },
        "*": { file: route("docs-rest") },
      },
    },
  },
};

const handle = router(tree);
const get = (path: string, init?: RequestInit) => handle(new Request(`http://localhost${path}`, init));
const json = async (path: string, init?: RequestInit) => (await get(path, init))!.json();

describe("find", () => {
  it("will take a static segment over a param, and a param over the rest", async () => {
    expect(await json("/files/new")).toEqual({ name: "new", params: {} });
    expect(await json("/files/report.pdf")).toEqual({ name: "named", params: { name: "report.pdf" } });
    expect(await json("/files/a/b%20c")).toEqual({ name: "rest", params: { "*": "a/b c" } });
    expect(await json("/files")).toEqual({ name: "files", params: {} });
    expect(await json("/")).toEqual({ name: "root", params: {} });
  });

  it("will take an empty rest at a folder with no index of its own", async () => {
    expect(await json("/docs")).toEqual({ name: "docs-rest", params: { "*": "" } });
    expect(await json("/files")).toEqual({ name: "files", params: {} });
  });

  it("will back off a param that ends short and take the rest instead", async () => {
    expect(await json("/docs/intro/edit")).toEqual({ name: "edit", params: { slug: "intro" } });
    expect(await json("/docs/intro/view")).toEqual({ name: "docs-rest", params: { "*": "intro/view" } });
  });

  it("will find nothing for a path the tree has no route at", () => {
    expect(find(tree, ["account"])).toBeUndefined();
    expect(find(tree, ["nowhere"])).toBeUndefined();
    expect(find({ children: { "*": {} } }, ["a"])).toBeUndefined();
    expect(find({ children: { "*": {} } }, [])).toBeUndefined();
  });
});

describe("router", () => {
  it("will give a path outside the tree undefined", async () => {
    expect(await get("/account")).toBeUndefined();
    expect(await get("/nowhere/at/all")).toBeUndefined();
  });

  it("will run a route behind the gates along it, keyed by its params", async () => {
    const cookie = { headers: { cookie: "user=ada" } };

    expect(await (await get("/account/me", cookie))!.text()).toBe("ada");
    expect(await (await get("/account/jobs/7/events", cookie))!.text()).toBe("ada:7:7");
    expect(await (await get("/account/me", { ...cookie, method: "POST" }))!.text()).toBe("posted");
  });

  it("will answer what a gate refuses with as a call would", async () => {
    const refused = (await get("/account/me"))!;
    const gone = (await get("/account/jobs/gone/events", { headers: { cookie: "user=ada" } }))!;

    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual({ error: "http:Unauthorized", message: "Sign in.", status: 401 });
    expect(gone.status).toBe(404);
    expect((await get("/account/late", { headers: { cookie: "user=ada" } }))!.status).toBe(403);
  });

  it("will answer a method the module does not export with 405 and what it allows, and HEAD with GET", async () => {
    const put = (await get("/account/me", { method: "PUT", headers: { cookie: "user=ada" } }))!;
    const head = (await get("/files", { method: "HEAD" }))!;

    expect(put.status).toBe(405);
    expect(put.headers.get("allow")).toBe("GET, POST");
    expect(head.status).toBe(200);
  });

  it("will refuse an unsupported method before revealing the route's methods", async () => {
    const response = (await get("/account/me", { method: "PUT" }))!;

    expect(response.status).toBe(401);
    expect(response.headers.has("allow")).toBe(false);
    expect((await response.json()).message).toBe("Sign in.");
  });

  it("will return a JSON failure when a route module cannot load", async () => {
    const broken = router({ children: { broken: { file: async () => { throw new Error("Import failed."); } } } }, { dev: true });
    const response = (await broken(new Request("http://localhost/broken")))!;

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Import failed.");
  });

  it("will add what a route set to its response", async () => {
    const response = (await get("/account/theme", { method: "PUT", headers: { cookie: "user=ada" } }))!;

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toEqual(["theme=dark; Path=/; HttpOnly; SameSite=Lax"]);
  });

  it("will fail a route that answers with something other than a Response", async () => {
    const dev = router(tree, { dev: true });
    const response = (await dev(new Request("http://localhost/account/odd", { headers: { cookie: "user=ada" } })))!;

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("GET /account/odd returned text - a route answers with a Response.");
    expect((await get("/account/odd", { headers: { cookie: "user=ada" } }))!.status).toBe(500);
  });

  it("will fail a method export that is not a function, and point a Node handler to fromNode", async () => {
    const dev = router(tree, { dev: true });
    const message = async (path: string) => (await (await dev(new Request(`http://localhost${path}`, { headers: { cookie: "user=ada" } })))!.json()).message;

    expect(await message("/account/page")).toBe("GET /account/page is string, not a function - a route answers GET requests with one.");
    expect(await message("/account/node")).toBe(
      `GET /account/node returned undefined - a route answers with a Response. It takes (req, res, next) - a Node handler? Wrap it in fromNode(handler), of @expressive/rpc/node.`,
    );
  });

  it("will answer a call at its folder, behind that folder's gates", async () => {
    const call = (path: string, name: string, cookie = "") =>
      get(path, { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": name, cookie }, body: "[]" });

    expect(await (await call("/", "ping"))!.json()).toEqual({ value: "pong" });
    expect(await (await call("/account", "who", "user=ada"))!.json()).toEqual({ value: "ada" });
    expect((await call("/account", "who"))!.status).toBe(401);
    expect((await call("/files", "ping"))!.status).toBe(404);
  });

  it("will serve the tree under a base, and nothing outside it", async () => {
    const based = router(() => tree, { base: "/api/" });
    const at = (path: string) => based(new Request(`http://localhost${path}`));

    expect(await (await at("/api/files/new"))!.json()).toEqual({ name: "new", params: {} });
    expect(await (await at("/api"))!.json()).toEqual({ name: "root", params: {} });
    expect(await at("/files/new")).toBeUndefined();
    expect(await at("/apis")).toBeUndefined();

    const call = await based(new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": "ping" }, body: "[]" }));

    expect(await call!.json()).toEqual({ value: "pong" });
  });

  it("will fail a request when the tree cannot be built", async () => {
    const broken = router(() => { throw new Error("Bad gate."); }, { dev: true });
    const response = (await broken(new Request("http://localhost/")))!;

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Bad gate.");
  });
});

describe("tree", () => {
  it("will list each folder's calls as an endpoint, and find a static folder's gate", async () => {
    expect(endpoints(tree).map(endpoint => endpoint.pattern)).toEqual([[], ["account"]]);
    expect(await gates(tree)(["account"])).toBe(Session);
    expect(await gates(tree)(["files"])).toBeUndefined();
    expect(await gates(tree)(["nowhere", "deeper"])).toBeUndefined();
  });

  it("will take a base off a path, or say it is not under it", () => {
    expect(unbased("/api/files", "/api")).toBe("/files");
    expect(unbased("/api", "/api")).toBe("/");
    expect(unbased("/files", "")).toBe("/files");
    expect(unbased("/apis", "/api")).toBeUndefined();
  });
});

it("will give a call no params", async () => {
  const handle = router({ calls: async () => ({ calls: { params: async () => Current.get().params }, classes: {} }) });
  const response = await handle(new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": "params" }, body: "[]" }));

  expect(await response!.json()).toEqual({ value: {} });
});

it("will not let a route's params be set", async () => {
  const handle = router({ file: undefined, children: { x: { file: async () => ({ GET: () => { (Current.get() as { params: unknown }).params = {}; return new Response(); } }) } } }, { dev: true });
  const response = await handle(new Request("http://localhost/x"));

  expect((await response!.json()).message).toBe("Current is read-only.");
});
