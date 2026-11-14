import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as bundle, createBuilder, createServer, optimizeDeps, resolveConfig, type InlineConfig, type ViteDevServer } from "vite";

import { rpc, type Options } from "./plugin";

const PACKAGES = fileURLToPath(new URL("../../../", import.meta.url));

const SOURCES: InlineConfig["resolve"] = {
  alias: [
    { find: /^@expressive\/([^/]+)$/, replacement: `${PACKAGES}$1/src` },
    { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${PACKAGES}$1/src/$2` },
  ],
};

const GATE = (check: string, error: string) => `
  import { Model } from "@expressive/mvc";
  import { Current, ${error} } from "@expressive/rpc";
  export default class Gate extends Model {
    static key() {
      const token = Current.get().request.headers.get("authorization");
      if (${check}) throw new ${error}("Refused.");
      return token ?? undefined;
    }
  }
`;

const APP = {
  "package.json": `{ "type": "module" }`,
  "index.html": `<!doctype html><html><body><script type="module" src="/src/main.ts"></script></body></html>`,
  "src/main.ts": `import { list, Over } from "../api/todos"; import { stats } from "../api/admin/stats"; console.log(list, Over, stats);`,
  "api/index.ts": GATE("!token", "Unauthorized"),
  "api/errors.ts": `import { HttpError } from "@expressive/rpc"; export class Billing extends HttpError { status = 402 }`,
  "api/todos.ts": `
    import { HttpError, NotFound } from "@expressive/rpc";
    import { Billing } from "./errors";
    export class Over extends HttpError { status = 409 }
    export class Late extends Billing {}
    export async function list() { return ["one"]; }
    export async function add(title: string) { if (title.length > 3) throw new Over("Too long"); return title; }
    export async function done(id: string) { throw new NotFound(\`No todo \${id}\`); }
  `,
  "lib/admin.ts": GATE(`token !== "Bearer admin"`, "Forbidden").replace("export default class Gate", "export class Gate"),
  "api/admin/index.ts": `import { Gate } from "../../lib/admin"; export default class Admin extends Gate {}`,
  "api/admin/stats.ts": `export async function stats() { return { total: 1 }; }`,
};

const FUNCTION_GATE = {
  "lib/session.ts": `
    import { Model } from "@expressive/mvc";
    import { Current, Unauthorized } from "@expressive/rpc";
    export class Session extends Model {
      user = "";
      protected async new() {
        const token = Current.get().request.headers.get("authorization");
        if (!token) throw new Unauthorized("Sign in.");
        this.user = token.slice(7);
      }
    }
  `,
  "api/index.ts": `import { Session } from "../lib/session"; export default () => void Session.new();`,
  "api/whoami.ts": `import { Session } from "../lib/session"; export async function whoami() { return Session.get().user; }`,
};

const dirs: string[] = [];
const servers: ViteDevServer[] = [];

afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function project(files: Record<string, string> = {}): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "rpc-vite-")));
  dirs.push(root);

  for (const [path, src] of Object.entries({ ...APP, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), src);
  }

  return root;
}

async function install(root: string) {
  const lib = async (name: string, entry: Record<string, string>, exports: Record<string, unknown>) => {
    const outDir = join(root, "node_modules/@expressive", name);

    await bundle({
      root: join(PACKAGES, name),
      configFile: false,
      logLevel: "silent",
      publicDir: false,
      build: {
        outDir,
        minify: false,
        lib: { entry, formats: ["es"], fileName: (_, name) => `${name}.js` },
        rollupOptions: { external: [/^node:/, /^@expressive\//] },
      },
    });

    writeFileSync(join(outDir, "package.json"), JSON.stringify({ name: `@expressive/${name}`, type: "module", exports }));
  };

  await lib("mvc", { index: "src/index.ts", "jsx-runtime": "src/jsx-runtime.ts" }, { ".": "./index.js", "./jsx-runtime": "./jsx-runtime.js" });
  await lib(
    "rpc",
    { index: "src/server.ts", client: "src/client.ts", http: "src/http.ts", protocol: "src/protocol.ts", calls: "src/calls.ts" },
    { ".": { browser: "./client.js", default: "./index.js" }, "./http": "./http.js", "./protocol": "./protocol.js", "./calls": "./calls.js" },
  );
}

async function serve(root: string, config: InlineConfig = {}) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [rpc()],
    resolve: SOURCES,
    optimizeDeps: { noDiscovery: true, include: [] },
    // one address family: on a dual-stack host, "localhost" can reach another process holding the same port on the other
    server: { host: "127.0.0.1" },
    ...config,
  });

  servers.push(server);

  return server;
}

async function listen(root: string, config?: InlineConfig) {
  const server = await serve(root, config);

  await server.listen(0);

  const post = async (path: string, name: string, args: unknown[] = [], token?: string) => {
    const response = await fetch(new URL(path, server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": name, ...(token && { authorization: `Bearer ${token}` }) },
      body: JSON.stringify(args),
    });

    return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? await response.json() : undefined };
  };

  return { server, post };
}

describe("client", () => {
  it("will serve a server module to the client as a stub of the shared client", async () => {
    const server = await serve(project());
    const stub = (await server.transformRequest("/api/todos.ts"))!.code;

    expect(stub).toContain('const at = "/"');
    expect(stub).toContain('call(at, "todos:list", args)');
    expect(stub).toContain('define("/#todos:Over", "Over", "http:HttpError")');
    expect(stub).toContain('import "/api/errors.ts";');
    expect(stub).toContain('define("/#todos:Late", "Late", "/#errors:Billing")');
    expect(stub).toMatch(/import \{ call, define \} from ".*rpc\/src\/index\.ts"/);
    expect(stub).not.toContain("Too long");
    expect((await server.transformRequest("/api/admin/stats.ts"))!.code).toContain('const at = "/admin"');
  });

  it("will throw if a server module exports what the client cannot use", async () => {
    const server = await serve(project({ "api/bad.ts": `export function sync() {}`, "src/bad.ts": `import { sync } from "../api/bad"; sync();` }));

    await expect(server.transformRequest("/src/bad.ts").then(() => server.transformRequest("/api/bad.ts"))).rejects.toThrow(
      "api/bad.ts: sync() is not async - every call to it crosses the wire.",
    );
  });

  it("will throw if client code imports a server-only name, the host adapter or the plumbing, but not server code", async () => {
    const server = await serve(project({
      "src/server.ts": `import { Current } from "@expressive/rpc"; export const a = Current;`,
      "src/host.ts": `import { handler } from "@expressive/rpc/http"; export const a = handler;`,
      "src/plumbing.ts": `import { within } from "@expressive/rpc/protocol"; export const a = within;`,
      "src/calls.ts": `import { handle } from "@expressive/rpc/calls"; export const a = handle;`,
      "src/ok.ts": `import { NotFound, type Current } from "@expressive/rpc"; export const a: Current | string = NotFound.name;`,
    }));

    await expect(server.transformRequest("/src/server.ts")).rejects.toThrow("src/server.ts imports Current from @expressive/rpc, which only its server build exports.");
    await expect(server.transformRequest("/src/host.ts")).rejects.toThrow("src/host.ts imports @expressive/rpc/http, the host adapter - only a server entry uses it.");
    await expect(server.transformRequest("/src/plumbing.ts")).rejects.toThrow("src/plumbing.ts imports @expressive/rpc/protocol, server plumbing - only a server or host module uses it.");
    await expect(server.transformRequest("/src/calls.ts")).rejects.toThrow("src/calls.ts imports @expressive/rpc/calls, the server's calls - only its entry uses them.");
    expect((await server.transformRequest("/src/ok.ts"))!.code).toContain("NotFound");
    expect((await server.environments.rpc.transformRequest("/src/server.ts"))!.code).toContain("Current");
    expect((await server.environments.rpc.transformRequest("/src/host.ts"))!.code).toContain("handler");
    expect((await server.environments.rpc.transformRequest("/src/plumbing.ts"))!.code).toContain("within");
  });

  it("will keep the dependency scan out of the folder", async () => {
    const root = project();
    const server = await serve(root);
    const { pluginContainer } = server.environments.client;
    const main = join(root, "src/main.ts");
    const scan = (id: string, importer?: string) => pluginContainer.resolveId(id, importer, { scan: true } as {});

    expect(await scan("../api/todos", main)).toMatchObject({ id: `\0${join(root, "api/todos.ts")}`, external: true });
    expect(await scan("./main", main)).toMatchObject({ id: main });
    expect((await scan("./missing", main))?.external).toBeFalsy();
    expect(await scan("/api/todos.ts")).toMatchObject({ external: true });
    expect((await scan("vite", main))?.external).toBeFalsy();
  });

  it("will not crawl server modules during dependency discovery", async () => {
    const root = project({
      "src/main.ts": `import "client-dep"; import { list } from "../api/todos"; console.log(list);`,
      "api/todos.ts": `import { db } from "server-only-dep"; export async function list() { return db; }`,
      "node_modules/client-dep/package.json": `{ "name": "client-dep", "type": "module", "main": "index.js" }`,
      "node_modules/client-dep/index.js": `export default 1;`,
    });
    const config = await resolveConfig({ root, configFile: false, logLevel: "silent", plugins: [rpc()], resolve: SOURCES, optimizeDeps: { entries: ["src/main.ts"] } }, "serve");

    expect((await optimizeDeps(config, true)).optimized).toHaveProperty("client-dep");
  });

  it("will build the client into dist/client unless told otherwise", async () => {
    const root = project();

    expect((await serve(root)).config.build.outDir).toBe("dist/client");
    expect((await serve(root, { build: { outDir: "public" } })).config.build.outDir).toBe("public");
  });
});

describe("dev server", () => {
  it("will answer a call through its folder's gates", async () => {
    const { server, post } = await listen(project());

    await server.transformRequest("/src/main.ts");
    await server.transformRequest("/api/todos.ts");
    await server.transformRequest("/api/admin/stats.ts");

    expect(await post("/", "todos:list")).toEqual({ status: 401, body: { error: "http:Unauthorized", message: "Refused.", status: 401 } });
    expect(await post("/", "todos:list", [], "alice")).toEqual({ status: 200, body: { value: ["one"] } });
    expect(await post("/admin", "stats:stats", [], "alice")).toEqual({ status: 403, body: { error: "http:Forbidden", message: "Refused.", status: 403 } });
    expect(await post("/admin", "stats:stats", [], "admin")).toEqual({ status: 200, body: { value: { total: 1 } } });
  });

  it("will rebuild a thrown error as its id", async () => {
    const { server, post } = await listen(project());

    await server.transformRequest("/api/todos.ts");

    expect(await post("/", "todos:add", ["long"], "a")).toEqual({ status: 409, body: { error: "/#todos:Over", message: "Too long", status: 409 } });
    expect(await post("/", "todos:done", ["x"], "a")).toEqual({ status: 404, body: { error: "http:NotFound", message: "No todo x", status: 404 } });
  });

  it("will answer only what the client imported", async () => {
    const { server, post } = await listen(project());

    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 404, body: { message: "Not found." } });

    await server.transformRequest("/api/todos.ts");

    expect(await post("/", "todos:list", [], "a")).toMatchObject({ status: 200 });
    expect(await post("/admin", "stats:stats", [], "admin")).toEqual({ status: 404, body: { message: "Not found." } });
  });

  it("will leave other requests to Vite", async () => {
    const { server } = await listen(project());
    const response = await fetch(new URL("/src/main.ts", server.resolvedUrls!.local[0]));

    expect(response.status).toBe(200);
  });

  it("will take an edit to a server module on the next call", async () => {
    const root = project();
    const { server, post } = await listen(root);

    await server.transformRequest("/api/todos.ts");
    expect(await post("/", "todos:list", [], "a")).toMatchObject({ body: { value: ["one"] } });

    await new Promise(ready => setTimeout(ready, 300));
    writeFileSync(join(root, "api/todos.ts"), readFileSync(join(root, "api/todos.ts"), "utf8").replace(`["one"]`, `["two"]`));

    await vi.waitFor(async () => expect(await post("/", "todos:list", [], "a")).toMatchObject({ body: { value: ["two"] } }), { timeout: 5000 });
  }, 15_000);

  it("will keep one copy of installed @expressive packages across a reload", async () => {
    const root = project();

    await install(root);

    const { server, post } = await listen(root, { resolve: {} });
    const edit = (file: string, from: string, to: string) => writeFileSync(join(root, file), readFileSync(join(root, file), "utf8").replace(from, to));

    await server.transformRequest("/api/todos.ts");
    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 200, body: { value: ["one"] } });

    await new Promise(ready => setTimeout(ready, 300));
    edit("api/todos.ts", `["one"]`, `["two"]`);
    await vi.waitFor(async () => expect(await post("/", "todos:list", [], "a")).toEqual({ status: 200, body: { value: ["two"] } }), { timeout: 5000 });

    edit("api/index.ts", `"Refused."`, `"Sign in."`);
    await vi.waitFor(async () => expect(await post("/", "todos:list")).toMatchObject({ status: 401, body: { message: "Sign in." } }), { timeout: 5000 });
    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 200, body: { value: ["two"] } });
  }, 30_000);

  it("will run a folder's function gate, its Models in reach of the call", async () => {
    const { server, post } = await listen(project(FUNCTION_GATE));

    await server.transformRequest("/api/whoami.ts");

    expect(await post("/", "whoami:whoami")).toEqual({ status: 401, body: { error: "http:Unauthorized", message: "Sign in.", status: 401 } });
    expect(await post("/", "whoami:whoami", [], "ada")).toEqual({ status: 200, body: { value: "ada" } });
  });

  it("will refuse a call through a folder whose gate is not a Model", async () => {
    const { server, post } = await listen(project({ "api/odd/index.ts": `export default class Odd extends Error {}`, "api/odd/ping.ts": `export async function ping() {}` }));

    await server.transformRequest("/api/odd/ping.ts");

    expect(await post("/odd", "ping:ping", [], "a")).toMatchObject({ status: 500, body: { message: expect.stringContaining("api/odd/index.ts: An index's default is its folder's gate") } });
  });

  it("will fail a call to a folder exporting a class that is not an Error", async () => {
    const { server, post } = await listen(project({ "api/odd.ts": `import { EventEmitter } from "node:events"; export class Odd extends EventEmitter {} export async function ping() {}` }));

    await server.transformRequest("/api/odd.ts");

    expect((await post("/", "odd:ping", [], "a")).status).toBe(500);
  });
});

const ENTRY = {
  "src/main.ts": `import { tick } from "../api/tally"; console.log(tick);`,
  "lib/count.ts": `export let count = 0; export const bump = () => ++count;`,
  "lib/prefs.ts": `import { Cookies } from "@expressive/rpc"; export class Prefs extends Cookies { theme?: string = undefined; }`,
  "api/tally.ts": `
    import { bump } from "../lib/count";
    import { Prefs } from "../lib/prefs";
    export async function tick() { return bump(); }
    export async function dark() { Prefs.set({ theme: "dark" }); }
  `,
  "server.ts": `
    import { Current } from "@expressive/rpc";
    import { handle } from "@expressive/rpc/calls";
    import { count } from "./lib/count";
    import { Prefs } from "./lib/prefs";

    export class Room {}

    export default {
      async fetch(request: Request, env: any, ctx: any) {
        const { pathname } = new URL(request.url);

        if (pathname === "/count") return Response.json({ count, name: env?.NAME ?? null });
        if (pathname === "/theme") {
          const was = Prefs.get().theme ?? null;
          Prefs.set({ theme: "light" });
          return Response.json({ was, at: Current.get().url.pathname });
        }
        if (pathname === "/cf") return new Response(String(await import("cloudflare:workers")));
        if (pathname === "/later") {
          ctx.passThroughOnException();
          ctx.waitUntil(Promise.reject(new Error("late")));
          return new Response("ok");
        }
        if (pathname === "/stream") {
          const text = new TextEncoder();
          let more: () => void = () => {};
          const second = new Promise<void>(go => (more = go));
          (globalThis as any).more = more;

          return new Response(new ReadableStream({
            async start(controller) {
              controller.enqueue(text.encode("a\\n"));
              await second;
              controller.enqueue(text.encode("b\\n"));
              controller.close();
            },
          }), { headers: { "content-type": "application/x-ndjson" } });
        }

        return (await handle(request)) ?? env?.ASSETS?.fetch(request) ?? new Response("Not here.", { status: 404 });
      },
      async scheduled() {
        return "ran";
      },
    };
  `,
};

describe("build", () => {
  async function build(root: string, options?: Options, config: InlineConfig = {}) {
    const builder = await createBuilder({ root, configFile: false, logLevel: "silent", plugins: [rpc(options)], resolve: SOURCES, ...config }, null);

    await builder.buildApp();

    const server = (await import(pathToFileURL(join(root, "dist/server/index.js")).href)).default;
    const assets = join(root, "dist/client/assets");
    const client = readdirSync(assets).map(file => readFileSync(join(assets, file), "utf8")).join("\n");
    const post = async (path: string, name: string, token?: string, env?: unknown) => {
      const request = new Request(new URL(path, "http://localhost"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-expressive-call": name, ...(token && { authorization: `Bearer ${token}` }) },
        body: "[]",
      });
      const response: Response = await server.fetch(request, env);

      return { status: response.status, body: await response.json() };
    };

    return { server, client, post };
  }

  it("will emit the client and a server bundle answering the calls the client imports, by hashed id", async () => {
    const root = project();
    const { server, client, post } = await build(root);
    const ids = [...client.matchAll(/[`"']([\w-]{16})[`"']/g)].map(([, id]) => id);

    expect(existsSync(join(root, "dist/client/index.html"))).toBe(true);
    expect(client).not.toContain("todos:list");
    expect(client).not.toContain("Too long");

    const answers = await Promise.all(ids.map(id => post("/", id, "a")));
    const list = ids[answers.findIndex(answer => answer.status === 200 && answer.body.value?.[0] === "one")];

    expect(list).toBeDefined();
    expect(await post("/", list)).toMatchObject({ status: 401 });
    expect(await post("/", "todos:list", "a")).toEqual({ status: 404, body: { message: "Not found." } });
    expect((await server.fetch(new Request("http://localhost/"))).status).toBe(404);
  });

  it("will keep readable ids, and hand a request that is not a call to the Worker's assets", async () => {
    const { server, post } = await build(project(), { opaque: false });
    const ASSETS = { fetch: async () => new Response("asset") };

    expect(await post("/", "todos:list", "a")).toEqual({ status: 200, body: { value: ["one"] } });
    expect(await post("/admin", "stats:stats", "a")).toMatchObject({ status: 403 });
    expect(await post("/admin", "stats:stats", "admin")).toEqual({ status: 200, body: { value: { total: 1 } } });
    expect(await (await server.fetch(new Request("http://localhost/"), { ASSETS })).text()).toBe("asset");
  });

  it("will keep the client's rollup options out of the server bundle", async () => {
    const root = project({ "other.html": APP["index.html"] });
    const rollupOptions = { input: { main: join(root, "index.html"), other: join(root, "other.html") }, output: { entryFileNames: "assets/[name]-entry.js" } };
    const { post } = await build(root, { opaque: false }, { build: { rollupOptions } });

    expect(readdirSync(join(root, "dist/client")).sort()).toEqual(["assets", "index.html", "other.html"]);
    expect(readdirSync(join(root, "dist/server"))).toEqual(["index.js"]);
    expect(await post("/", "todos:list", "a")).toEqual({ status: 200, body: { value: ["one"] } });
  });

  it("will guard only scripts that mention @expressive/rpc", async () => {
    const root = project({
      "src/notes.json": `{ "server": "import { Current } from \\"@expressive/rpc\\";" }`,
      "src/main.ts": `import notes from "./notes.json"; import { list } from "../api/todos"; console.log(notes.server, list);`,
    });
    const { client } = await build(root);

    expect(client).toContain("import { Current } from");
  });

  describe("dependencies", () => {
    const LOUD = {
      "node_modules/shout/package.json": `{ "name": "shout", "type": "module", "exports": "./index.js" }`,
      "node_modules/shout/index.js": `export const shout = text => text.toUpperCase();`,
      "api/loud.ts": `import { shout } from "shout"; export async function loud() { return shout("hi"); }`,
      "src/main.ts": `import { loud } from "../api/loud"; console.log(loud);`,
    };

    it("will bundle every dependency into the server by default", async () => {
      const root = project(LOUD);
      const { post } = await build(root, { opaque: false });
      const code = readFileSync(join(root, "dist/server/index.js"), "utf8");

      expect(await post("/", "loud:loud", "a")).toEqual({ status: 200, body: { value: "HI" } });
      expect(code).not.toMatch(/from\s*"shout"/);
    });

    it("will leave dependencies installed when the app sets the server's externals, bundling only the calls", async () => {
      const root = project(LOUD);

      await install(root);

      const { post } = await build(root, { opaque: false }, { resolve: {}, environments: { rpc: { resolve: { noExternal: [] } } } });
      const code = readFileSync(join(root, "dist/server/index.js"), "utf8");

      expect(await post("/", "loud:loud", "a")).toEqual({ status: 200, body: { value: "HI" } });
      expect(await post("/", "loud:loud")).toMatchObject({ status: 401 });
      expect(code).toMatch(/from\s*"shout"/);
      expect(code).toMatch(/from\s*"@expressive\/rpc\/http"/);
      expect(code).not.toMatch(/from\s*"@expressive\/rpc\/calls"/);
    }, 30_000);

    it("will bundle what the app's noExternal names, leaving the rest installed", async () => {
      const root = project(LOUD);

      await install(root);

      const { post } = await build(root, { opaque: false }, { resolve: {}, environments: { rpc: { resolve: { noExternal: ["@expressive/rpc"] } } } });
      const code = readFileSync(join(root, "dist/server/index.js"), "utf8");

      expect(await post("/", "loud:loud", "a")).toEqual({ status: 200, body: { value: "HI" } });
      expect(code).toMatch(/from\s*"shout"/);
      expect(code).not.toMatch(/from\s*"@expressive\/rpc[/"]/);
    }, 30_000);
  });

  it("will build a function gate, its Models in reach of the call", async () => {
    const root = project({ ...FUNCTION_GATE, "src/main.ts": `import { whoami } from "../api/whoami"; whoami();` });
    const { post } = await build(root, { opaque: false });

    expect(await post("/", "whoami:whoami")).toEqual({ status: 401, body: { error: "http:Unauthorized", message: "Sign in.", status: 401 } });
    expect(await post("/", "whoami:whoami", "ada")).toEqual({ status: 200, body: { value: "ada" } });
  });

  it("will build calls with no gate in their folders", async () => {
    const root = project({ "api/index.ts": `export async function ping() { return "pong"; }`, "src/main.ts": `import { ping } from "../api"; ping();` });
    const { post } = await build(root, { opaque: false });

    expect(await post("/", "ping")).toEqual({ status: 200, body: { value: "pong" } });
  });

  it("will bundle the entry as the server, sharing its modules with the calls", async () => {
    const root = project(ENTRY);
    const { server, post } = await build(root, { entry: "server.ts", opaque: false });
    const bundled = await import(pathToFileURL(join(root, "dist/server/index.js")).href);
    const code = readFileSync(join(root, "dist/server/index.js"), "utf8");

    expect(await post("/", "tally:tick", "a")).toEqual({ status: 200, body: { value: 1 } });
    expect(await (await server.fetch(new Request("http://localhost/count"))).json()).toEqual({ count: 1, name: null });
    expect((await server.fetch(new Request("http://localhost/"))).status).toBe(404);
    expect(await server.scheduled()).toBe("ran");

    const theme: Response = await server.fetch(new Request("http://localhost/theme", { headers: { cookie: "theme=dark" } }));

    expect(await theme.json()).toEqual({ was: "dark", at: "/theme" });
    expect(theme.headers.getSetCookie()).toEqual(["theme=light; Path=/; HttpOnly; SameSite=Lax"]);
    expect(bundled.Room).toBeTypeOf("function");
    expect(code).toContain(`import("cloudflare:workers")`);
    expect(code).not.toMatch(/(?:from|import)\s*"@expressive\/rpc\/calls"/);
  });
});

describe("a folder beside the root", () => {
  // LFCP's shape: the Vite app in app/, its calls in a sibling workspace package.
  const beside = () => {
    const files = Object.fromEntries(
      Object.entries(APP).map(([path, src]) => [["package.json", "index.html", "src/main.ts"].includes(path) ? `app/${path}` : path, src]),
    );

    files["app/src/main.ts"] = files["app/src/main.ts"].replaceAll('"../api/', '"../../api/');

    const root = project(files);

    return { root, app: join(root, "app") };
  };

  it("will answer calls from a folder outside the Vite root in dev", async () => {
    const { root, app } = beside();
    const { server, post } = await listen(app, { plugins: [rpc({ dir: "../api" })] });

    await server.transformRequest("/src/main.ts");

    const stub = (await server.transformRequest(`/@fs${root}/api/todos.ts`))!.code;

    expect(stub).toContain('call(at, "todos:list", args)');
    expect(stub).not.toContain("Too long");
    expect(await post("/", "todos:list")).toMatchObject({ status: 401 });
    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 200, body: { value: ["one"] } });
  });

  it("will build calls from a folder outside the Vite root", async () => {
    const { app } = beside();
    const builder = await createBuilder({ root: app, configFile: false, logLevel: "silent", plugins: [rpc({ dir: "../api", opaque: false })], resolve: SOURCES }, null);

    await builder.buildApp();

    const server = (await import(pathToFileURL(join(app, "dist/server/index.js")).href)).default;
    const call = async (path: string, name: string, token: string) => {
      const response: Response = await server.fetch(
        new Request(new URL(path, "http://localhost"), {
          method: "POST",
          headers: { "content-type": "application/json", "x-expressive-call": name, authorization: `Bearer ${token}` },
          body: "[]",
        }),
      );

      return { status: response.status, body: await response.json() };
    };

    expect(await call("/", "todos:list", "a")).toEqual({ status: 200, body: { value: ["one"] } });
    expect(await call("/admin", "stats:stats", "a")).toMatchObject({ status: 403 });
    expect(await call("/admin", "stats:stats", "admin")).toEqual({ status: 200, body: { value: { total: 1 } } });
  });

  it("will resolve the folder's own tsconfig paths with resolve.tsconfigPaths", async () => {
    const { root, app } = beside();

    writeFileSync(join(root, "api/tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "data/*": ["./data/*"] } } }));
    mkdirSync(join(root, "api/data"));
    writeFileSync(join(root, "api/data/todos.ts"), `export const seed = ["seeded"];`);
    writeFileSync(join(root, "api/todos.ts"), `import { seed } from "data/todos"; export async function list() { return seed; }`);
    writeFileSync(join(root, "app/src/main.ts"), `import { list } from "../../api/todos"; console.log(list);`);

    const { server, post } = await listen(app, { plugins: [rpc({ dir: "../api" })], resolve: { ...SOURCES, tsconfigPaths: true } });

    await server.transformRequest("/src/main.ts");
    await server.transformRequest(`/@fs${root}/api/todos.ts`);

    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 200, body: { value: ["seeded"] } });
  });
});

describe("entry", () => {
  const get = (server: ViteDevServer, path: string) => fetch(new URL(path, server.resolvedUrls!.local[0]));

  it("will run the app's entry in dev, with the calls, its own routes and Vite for the rest", async () => {
    const { server, post } = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts", env: () => ({ NAME: "dev" }) })] });

    await server.transformRequest("/api/tally.ts");

    expect(await post("/", "tally:tick", [], "a")).toEqual({ status: 200, body: { value: 1 } });
    expect(await post("/", "tally:tick")).toMatchObject({ status: 401 });
    expect(await (await get(server, "/count")).json()).toEqual({ count: 1, name: "dev" });
    expect(await (await get(server, "/")).text()).toContain(`<script type="module"`);
  });

  it("will run the entry's routes in the request's scope, with what Cookies set on the response", async () => {
    const { server } = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts" })] });
    const theme = await fetch(new URL("/theme", server.resolvedUrls!.local[0]), { headers: { cookie: "theme=dark" } });

    expect(await theme.json()).toEqual({ was: "dark", at: "/theme" });
    expect(theme.headers.getSetCookie()).toEqual(["theme=light; Path=/; HttpOnly; SameSite=Lax"]);

    await server.transformRequest("/api/tally.ts");

    const call = await fetch(new URL("/", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "tally:dark", authorization: "Bearer a" },
      body: "[]",
    });

    expect(call.headers.getSetCookie()).toEqual(["theme=dark; Path=/; HttpOnly; SameSite=Lax"]);
    expect(await (await get(server, "/")).text()).toContain(`<script type="module"`);
  });

  it("will stream a route's response as it is written", async () => {
    const { server } = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts" })] });
    const reader = (await get(server, "/stream")).body!.getReader();
    const text = new TextDecoder();

    expect(text.decode((await reader.read()).value)).toBe("a\n");
    (globalThis as any).more();
    expect(text.decode((await reader.read()).value)).toBe("b\n");
    expect((await reader.read()).done).toBe(true);
  });

  it("will log a rejected waitUntil without failing the response", async () => {
    const { server } = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts" })] });
    const error = vi.spyOn(server.config.logger, "error");

    expect(await (await get(server, "/later")).text()).toBe("ok");
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith("server.ts waitUntil: Error: late"));
  });

  it("will take an edit to the entry on the next request", async () => {
    const root = project(ENTRY);
    const { server } = await listen(root, { plugins: [rpc({ entry: "server.ts" })] });

    expect(await (await get(server, "/count")).json()).toEqual({ count: 0, name: null });

    await new Promise(ready => setTimeout(ready, 300));
    writeFileSync(join(root, "server.ts"), readFileSync(join(root, "server.ts"), "utf8").replace("name: env?.NAME ?? null", `name: "edited"`));

    await vi.waitFor(async () => expect(await (await get(server, "/count")).json()).toEqual({ count: 0, name: "edited" }), { timeout: 5000 });
  }, 15_000);

  it("will keep the newer dev server's calls when an older one closes", async () => {
    const older = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts" })] });
    const { server, post } = await listen(project(ENTRY), { plugins: [rpc({ entry: "server.ts" })] });

    await server.transformRequest("/api/tally.ts");
    servers.splice(servers.indexOf(older.server), 1);
    await older.server.close();

    expect(await post("/", "tally:tick", [], "a")).toEqual({ status: 200, body: { value: 1 } });
  });

  it("will fail a request when the entry has no default fetch", async () => {
    const { server } = await listen(project({ ...ENTRY, "server.ts": `export default {};` }), { plugins: [rpc({ entry: "server.ts" })] });

    expect((await get(server, "/count")).status).toBe(500);
  });

});

describe("groups", () => {
  const GROUPS = {
    "src/main.ts": `import * as shop from "../api/shop"; import { list } from "../api/todos"; import type { Item } from "../api/shop/cart"; const item: Item | undefined = undefined; console.log(shop, list, item);`,
    "api/shop/index.ts": `
      import { Model } from "@expressive/mvc";
      import { Current, Forbidden } from "@expressive/rpc";
      import { list, add, Over } from "./cart";
      import { statistics } from "./admin";
      export type * as types from "./cart";
      export default class Shop extends Model {
        static key() { if (Current.get().request.headers.get("x-closed")) throw new Forbidden("Closed."); }
      }
      export async function hours() { return "9-5"; }
      export const cart = { list, add, errors: { Over } };
      export { statistics as stats };
    `,
    "api/shop/errors.ts": APP["api/errors.ts"],
    "api/shop/cart.ts": APP["api/todos.ts"] + `
      export type Item = { title: string };
      export const PAGE = 20;
      export function page() { return PAGE; }
      export async function internal() { return "secret"; }
    `,
    "api/shop/admin/index.ts": APP["api/admin/index.ts"].replace("../../lib", "../../../lib") + `\nexport { stats as statistics } from "./stats";`,
    "api/shop/admin/stats.ts": APP["api/admin/stats.ts"],
  };

  const INDEXES = (): InlineConfig => ({ plugins: [rpc({ test: /(^|\/)index\.ts$/ })] });

  it("will serve a module's groups and leaves from the stubs of the modules defining them, beside its own calls", async () => {
    const server = await serve(project(GROUPS), INDEXES());
    const shop = (await server.transformRequest("/api/shop/index.ts"))!.code;
    const cart = (await server.transformRequest("/api/shop/cart.ts?rpc"))!.code;

    expect(shop).toMatch(/import \{ list as t0, add as t1, Over as t2 \} from "\/api\/shop\/cart\.ts\?rpc";/);
    expect(shop).toMatch(/import \{ stats as t3 \} from "\/api\/shop\/admin\/stats\.ts\?rpc";/);
    expect(shop).toContain('call(at, "hours", args)');
    expect(shop).not.toContain("Closed.");
    expect(shop.replace(/\s+/g, "")).toContain(`constg0={"list":t0,"add":t1,"errors":{"Over":t2}};export{g0as"cart",t3as"stats"};`);
    expect(cart).toContain('const at = "/shop"');
    expect(cart).toContain('call(at, "cart:list", args)');
    expect(cart).toContain('call(at, "cart:add", args)');
    expect(cart).toMatch(/import "\/api\/shop\/errors\.ts\?rpc";/);
    expect(cart).not.toContain("internal");
    expect(cart).not.toContain("PAGE");
    expect(cart).toContain('define("/shop#cart:Late", "Late", "/shop#errors:Billing")');
  });

  it("will leave a module the test does not select plain, unless a server module reaches it", async () => {
    const server = await serve(project(GROUPS), INDEXES());

    expect((await server.transformRequest("/api/shop/cart.ts"))!.code).toContain("secret");
    expect((await server.transformRequest("/api/todos.ts"))!.code).toContain('"one"');
  });

  it("will group calls in any server module, every module a server module by default", async () => {
    const server = await serve(project({ ...GROUPS, "api/shop/cart.ts": APP["api/todos.ts"] + "export async function internal() {}" }));
    const shop = (await server.transformRequest("/api/shop/index.ts"))!.code;
    const cart = (await server.transformRequest("/api/shop/cart.ts"))!.code;

    expect(shop).toMatch(/import \{ list as t0, add as t1, Over as t2 \} from "\/api\/shop\/cart\.ts";/);
    expect(cart).toContain('call(at, "cart:internal", args)');
  });

  it("will answer only reached leaves, each through the gates of selected indexes along its folder", async () => {
    const { server, post } = await listen(project(GROUPS), INDEXES());

    await server.transformRequest("/src/main.ts");
    await server.transformRequest("/api/shop/index.ts");
    await server.transformRequest("/api/shop/cart.ts?rpc");
    await server.transformRequest("/api/shop/admin/stats.ts?rpc");

    const closed = await fetch(new URL("/shop", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "cart:list", authorization: "Bearer a", "x-closed": "1" },
      body: "[]",
    });

    expect(closed.status).toBe(403);
    expect(await post("/shop", "cart:list")).toMatchObject({ status: 401 });
    expect(await post("/shop", "cart:list", [], "a")).toEqual({ status: 200, body: { value: ["one"] } });
    expect(await post("/shop", "hours", [], "a")).toEqual({ status: 200, body: { value: "9-5" } });
    expect(await post("/shop", "cart:add", ["long"], "a")).toMatchObject({ status: 409, body: { error: "/shop#cart:Over" } });
    expect(await post("/shop", "cart:internal", [], "a")).toEqual({ status: 404, body: { message: "Not found." } });
    expect(await post("/shop/admin", "stats:stats", [], "a")).toMatchObject({ status: 403 });
    expect(await post("/shop/admin", "stats:stats", [], "admin")).toEqual({ status: 200, body: { value: { total: 1 } } });
    expect(await post("/", "todos:list", [], "a")).toEqual({ status: 404, body: { message: "Not found." } });
  });

  it("will take a folder's gate only from an index the test selects", async () => {
    const { server, post } = await listen(project(GROUPS), { plugins: [rpc({ test: path => path === "shop/index.ts" })] });

    await server.transformRequest("/api/shop/index.ts");
    await server.transformRequest("/api/shop/cart.ts?rpc");

    expect(await post("/shop", "cart:list")).toEqual({ status: 200, body: { value: ["one"] } });
  });

  const REACH = {
    "api/lib/p.ts": `export async function x() { return "x"; } export async function y() { return "y"; } export async function z() { return "z"; }`,
    "api/a/index.ts": `import { x } from "../lib/p"; export const a = { x };`,
    "api/b/index.ts": `import { y } from "../lib/p"; export const b = { y };`,
    "api/node_modules/dep/index.ts": `export const dep = 1;`,
  };

  it("will stub a plain module for every server module reaching it, whichever loads first", async () => {
    const root = project({ ...REACH, "api/c/index.ts": `export const c = {};` });
    const skip = new Set<string>();
    const { server, post } = await listen(root, { plugins: [rpc({ test: path => /(^|\/)index\.ts$/.test(path) && !skip.has(path) })] });
    const stub = async () => (await server.transformRequest("/api/lib/p.ts?rpc"))!.code;

    await server.transformRequest("/api/a/index.ts");
    expect(await stub()).toContain('call(at, "p:y", args)');
    expect(await stub()).not.toContain('"p:z"');

    await server.transformRequest("/api/b/index.ts");
    expect(await post("/lib", "p:y", [], "a")).toEqual({ status: 200, body: { value: "y" } });

    await new Promise(ready => setTimeout(ready, 300));
    writeFileSync(join(root, "api/c/index.ts"), `import { z } from "../lib/p"; export const c = { z };`);

    await vi.waitFor(async () => {
      await server.transformRequest("/api/c/index.ts");
      expect(await stub()).toContain('call(at, "p:z", args)');
    }, { timeout: 5000 });

    skip.add("b/index.ts");
    server.environments.client.moduleGraph.invalidateAll();
    expect(await stub()).not.toContain('"p:y"');
  }, 15_000);

  it("will build a plain module's stub with every server module's leaves, however late one is found", async () => {
    const root = project({
      ...REACH,
      "src/main.ts": `import { a } from "../api/a"; import { deep } from "./deep"; console.log(a, deep);`,
      "src/deep.ts": `export { deeper as deep } from "./deeper";`,
      "src/deeper.ts": `import { b } from "../api/b"; export const deeper = b;`,
    });
    const builder = await createBuilder({ root, configFile: false, logLevel: "silent", plugins: [rpc({ opaque: false, test: /(^|\/)index\.ts$/g })], resolve: SOURCES }, null);

    await builder.buildApp();

    const server = (await import(pathToFileURL(join(root, "dist/server/index.js")).href)).default;
    const post = async (name: string) => {
      const response: Response = await server.fetch(new Request("http://localhost/lib", {
        method: "POST",
        headers: { "content-type": "application/json", "x-expressive-call": name, authorization: "Bearer a" },
        body: "[]",
      }));

      return response.status;
    };

    expect([await post("p:x"), await post("p:y"), await post("p:z")]).toEqual([200, 200, 404]);
  });

  it("will stop answering a leaf its module drops", async () => {
    const root = project(GROUPS);
    const { server, post } = await listen(root, INDEXES());

    await server.transformRequest("/api/shop/index.ts");
    await server.transformRequest("/api/shop/cart.ts?rpc");
    expect(await post("/shop", "cart:add", ["a"], "a")).toEqual({ status: 200, body: { value: "a" } });

    await new Promise(ready => setTimeout(ready, 300));
    writeFileSync(join(root, "api/shop/index.ts"), GROUPS["api/shop/index.ts"].replace("list, add, Over }", "list, Over }").replace("list, add, errors", "list, errors"));

    await vi.waitFor(async () => {
      await server.transformRequest("/api/shop/index.ts");
      expect(await post("/shop", "cart:add", ["a"], "a")).toEqual({ status: 404, body: { message: "Not found." } });
    }, { timeout: 5000 });
    expect(await post("/shop", "cart:list", [], "a")).toMatchObject({ status: 200 });
  }, 15_000);

  it("will resolve a stub's import of a plain module in the folder to that module's stub", async () => {
    const root = project(GROUPS);
    const server = await serve(root, INDEXES());
    const main = join(root, "src/main.ts");
    const shop = join(root, "api/shop/index.ts");
    const resolve = (id: string, importer?: string, options = {}) => server.environments.client.pluginContainer.resolveId(id, importer, options);

    expect(await resolve("./cart", shop)).toMatchObject({ id: `${join(root, "api/shop/cart.ts")}?rpc` });
    expect(await resolve("./errors", `${join(root, "api/shop/cart.ts")}?rpc`)).toMatchObject({ id: `${join(root, "api/shop/errors.ts")}?rpc` });
    expect(await resolve("./admin", shop)).toMatchObject({ id: join(root, "api/shop/admin/index.ts") });
    expect(await resolve("./missing", shop)).toBeNull();
    expect(await resolve("../api/shop/cart", main)).toMatchObject({ id: join(root, "api/shop/cart.ts") });
    expect(await resolve("../api/shop", main, { scan: true })).toMatchObject({ external: true });
    expect(await resolve("../api/shop/cart", main, { scan: true })).toMatchObject({ id: join(root, "api/shop/cart.ts") });
    expect(await server.environments.rpc.pluginContainer.resolveId("./cart", shop)).toMatchObject({ id: join(root, "api/shop/cart.ts") });
  });

  it("will throw if a group is not an object of leaves from the folder", async () => {
    const server = await serve(project({ ...GROUPS, "api/shop/index.ts": `import { list } from "../../lib/list"; async function ping() {} export const api = { ping, list };`, "lib/list.ts": APP["api/admin/stats.ts"].replace("stats", "list") }));

    await expect(server.transformRequest("/api/shop/index.ts")).rejects.toThrow(
      "api/shop/index.ts: api.ping is not an imported name - a leaf is a function or Error class imported by name from the module under the folder that defines it. " +
        `api.list is defined outside the folder, in ${join(server.config.root, "lib/list.ts")}`,
    );

    const own = await serve(project({ ...GROUPS, "api/shop/index.ts": `import { list } from "./cart"; export const api = { list }; export const count = 1;` }));

    await expect(own.transformRequest("/api/shop/index.ts")).rejects.toThrow("api/shop/index.ts: count is neither an async function nor an Error subclass");
  });

  it("will build a server answering only reached leaves, behind their folders' gates", async () => {
    const root = project(GROUPS);
    const builder = await createBuilder({ root, configFile: false, logLevel: "silent", plugins: [rpc({ opaque: false, test: /(^|\/)index\.ts$/ })], resolve: SOURCES }, null);

    await builder.buildApp();

    const server = (await import(pathToFileURL(join(root, "dist/server/index.js")).href)).default;
    const post = async (path: string, name: string, token?: string) => {
      const response: Response = await server.fetch(new Request(new URL(path, "http://localhost"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-expressive-call": name, ...(token && { authorization: `Bearer ${token}` }) },
        body: "[]",
      }));

      return { status: response.status, body: await response.json() };
    };

    expect(await post("/shop", "cart:list")).toMatchObject({ status: 401 });
    expect(await post("/shop", "cart:list", "a")).toEqual({ status: 200, body: { value: ["one"] } });
    expect(await post("/shop", "cart:internal", "a")).toEqual({ status: 404, body: { message: "Not found." } });
    expect(await post("/shop", "hours", "a")).toEqual({ status: 200, body: { value: "9-5" } });
    expect(await post("/shop/admin", "stats:stats", "a")).toMatchObject({ status: 403 });
    expect(await post("/shop/admin", "stats:stats", "admin")).toEqual({ status: 200, body: { value: { total: 1 } } });
    expect(await post("/", "todos:list", "a")).toEqual({ status: 404, body: { message: "Not found." } });
  });
});
