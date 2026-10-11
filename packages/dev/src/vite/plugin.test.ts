import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, createServerModuleRunner, type InlineConfig, type ViteDevServer } from "vite";

import { clientBuild, serverBuild } from "./build";
import { expressive } from "./plugin";

const PAGE = "export function Page(){ return <h1>hi</h1> }";
const TAB = crypto.randomUUID();
const PACKAGES = fileURLToPath(new URL("../../../", import.meta.url));

const SOURCES: InlineConfig["resolve"] = {
  alias: [
    { find: /^@expressive\/([^/]+)$/, replacement: `${PACKAGES}$1/src` },
    { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${PACKAGES}$1/src/$2` },
  ],
};

beforeAll(async () => {
  (globalThis as any).hostMvc = await import("@expressive/mvc");
});

describe("vite host", () => {
  const dirs: string[] = [];
  const servers: ViteDevServer[] = [];

  afterEach(async () => {
    while (servers.length) await servers.pop()!.close();
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  function project(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "host-"));
    dirs.push(root);

    for (const [path, src] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, src);
    }

    return root;
  }

  async function serve(root: string, host = expressive(), resolve = SOURCES) {
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [host],
      resolve,
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    servers.push(server);
    return server;
  }

  it("serves the shell with the mount point and the virtual entry", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE }));
    const html = await server.transformIndexHtml("/", "<html><body></body></html>");

    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/.expressive/main.tsx"></script>');
  });

  it("routed project: entry mounts the generated router module on @expressive/dom", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/blog/[slug].tsx": PAGE }));

    const main = await server.transformRequest("/.expressive/main.tsx");
    expect(main?.code).toContain("dev/src/index");
    expect(main?.code).toContain("/.expressive/routes.tsx");

    const routes = await server.transformRequest("/.expressive/routes.tsx");
    expect(routes?.code).toContain("/app/index.tsx");
    expect(routes?.code).toContain('to: ":slug"');
    expect(routes?.code).toMatch(/dev\/src\/jsx-dev-runtime/);
  });

  it("will not scan specs, tests or sidecars beside routes for dependencies", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/index.spec.ts": "import '@playwright/test';" }));
    expect(server.config.optimizeDeps.entries).toEqual(["app/**/*.{ts,tsx,js,jsx}", "!app/**/*.{spec,test}.*", "!app/**/remote.*", "!app/**/remote/**"]);
  });

  it("single-file project: entry mounts app.tsx directly", async () => {
    const server = await serve(project({ "app.tsx": "export default () => <h1>hi</h1>" }));

    const main = await server.transformRequest("/.expressive/main.tsx");
    expect(main?.code).toContain("/app.tsx");
    expect(main?.code).not.toContain("routes.tsx");
  });

  it("reads index.ts as the config on the module runner", async () => {
    const host = expressive();
    await serve(project({ "app/index.tsx": PAGE, "index.ts": "export default { port: 0 };" }), host);

    expect(await host.api!.config()).toEqual({ port: 0 });
  });

  it("will share linked Expressive packages between the host and the module runner", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "probe.ts": 'export { State } from "@expressive/mvc";',
      "linked/mvc/package.json": JSON.stringify({ name: "@expressive/mvc", type: "module", exports: "./index.js" }),
      "linked/mvc/index.js": "export class State {}",
    });
    mkdirSync(join(root, "node_modules/@expressive"), { recursive: true });
    symlinkSync(join(root, "linked/mvc"), join(root, "node_modules/@expressive/mvc"), "dir");

    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [expressive()],
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    servers.push(server);

    const runner = createServerModuleRunner(server.environments.ssr);
    const { State } = await runner.import(join(root, "probe.ts"));
    await runner.close();

    expect(State).toBe(createRequire(join(root, "index.js"))("@expressive/mvc").State);
  });

  const SIDECAR = `
    export class Over extends Error { status = 409 }
    export async function add(a: number, b: number) { if (a > 9) throw new Over("Too big"); return a + b }
  `;

  it("will serve a sidecar to the browser as a stub of its calls", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './remote'; export const Page = () => add", "app/tally/remote.ts": SIDECAR });
    const server = await serve(root);

    await server.transformRequest("/app/tally/index.tsx");
    const stub = (await server.transformRequest("/app/tally/remote.ts"))?.code;

    expect(stub).toContain('const at = ["tally"]');
    expect(stub).toContain('call(at, "add", args)');
    expect(stub).toContain('define("/tally#Over", "Over")');
    expect(stub).not.toContain("a + b");
  });

  it("will stub a sidecar in a project reached through a symlink", async () => {
    const real = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './remote'; export const Page = () => add", "app/tally/remote.ts": SIDECAR });
    const link = join(mkdtempSync(join(tmpdir(), "link-")), "app");
    dirs.push(dirname(link));
    symlinkSync(real, link, "dir");

    const server = await serve(link);
    await server.transformRequest("/app/tally/index.tsx");

    expect((await server.transformRequest("/app/tally/remote.ts"))?.code).not.toContain("a + b");
  });

  it("will throw if a module outside its folder imports a sidecar", async () => {
    const root = project({ "app/index.tsx": "import { add } from './tally/remote'; export const Page = () => add", "app/tally/remote.ts": SIDECAR });
    const server = await serve(root);

    await expect(server.transformRequest("/app/index.tsx")).rejects.toThrow("only modules in app/tally/ and below may call it");
  });

  const HOST = 'import { State } from "@expressive/mvc";';

  function hostMvc(root: string): InlineConfig["resolve"] {
    const shim = join(root, "host-mvc.ts");
    const names = Object.keys((globalThis as any).hostMvc).filter(name => name !== "default");
    writeFileSync(shim, `export const { ${names.join(", ")} } = (globalThis as any).hostMvc;`);

    return { alias: [{ find: /^@expressive\/mvc$/, replacement: shim }, ...(SOURCES!.alias as any[])] };
  }
  const SEAT = `
    ${HOST}
    export default class Tally extends State {
      static ttl = 60;
      total = 0;
      async add(by: number) { return (this.total += by); }
    }
    export async function peek() { return Tally.get().total; }
  `;

  it("will serve a remote default to the browser as a twin of its methods", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import Tally from './remote'; export const Page = () => Tally", "app/tally/remote.ts": SEAT });
    const server = await serve(root);

    const stub = (await server.transformRequest("/app/tally/remote.ts"))?.code;
    expect(stub).toContain('export default twin(at, { "add": "default.add" }, ["total"], "Tally")');
    expect(stub).not.toContain("this.total");
  });

  it("will twin the methods a seat inherits through imports", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/lib/counter.ts": `${HOST} export class Counter extends State { count = 0; async increment() { return ++this.count; } protected async secret() {} }`,
      "app/tally/remote.ts": `import { Counter } from "../lib/counter"; export default class Tally extends Counter { async add(by: number) { return by; } }`,
    });
    const server = await serve(root);

    const stub = (await server.transformRequest("/app/tally/remote.ts"))?.code;
    expect(stub).toMatch(/export default twin\(at, \{\s*"add": "default\.add",\s*"increment": "default\.increment"\s*\}, \["count"\], "Tally"\)/);
    expect(stub).not.toContain("secret");
  });

  it("will throw if a seat's base cannot be followed", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/remote.ts": `const mixin = (B: any) => B; ${HOST} export default class Tally extends mixin(State) {}` });
    const server = await serve(root);

    await expect(server.transformRequest("/app/tally/remote.ts")).rejects.toThrow("Tally extends an expression");
  });

  it("will let the route tree provide a folder's twin", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/tally/index.tsx": PAGE, "app/tally/remote.ts": SEAT }));

    const routes = await server.transformRequest("/.expressive/routes.tsx");
    expect(routes?.code).toContain("app/tally/remote.ts");

    const stub = await server.transformRequest("/app/tally/remote.ts");
    expect(stub?.code).toContain("export default twin(");
  });

  it("will call a seat's methods on the instance its folder holds", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/remote.ts": SEAT });
    const server = await serve(root, expressive(), hostMvc(root));
    await server.transformRequest("/app/tally/remote.ts");
    await server.listen(0);

    const post = async (headers: Record<string, string>, body = "[]") => (await fetch(new URL("/tally", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": TAB, ...headers },
      body,
    })).json();

    const twin = { "x-expressive-twin": "Tally-A" };

    expect(await post({ "x-expressive-get": "default", ...twin })).toEqual({ values: { total: 0 }, version: expect.any(String) });
    expect(await post({ "x-expressive-call": "default.add", ...twin }, "[2]")).toEqual({ value: 2, frame: { "Tally-A": { patch: { total: 2 }, version: expect.any(String) } } });
    expect(await post({ "x-expressive-call": "default.add", ...twin }, "[3]")).toEqual({ value: 5, frame: { "Tally-A": { patch: { total: 5 }, version: expect.any(String) } } });
    expect(await post({ "x-expressive-call": "peek" })).toEqual({ value: 5, frame: {} });
  });

  it("will seat a folder's default for calls below it, imported by the client or not", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/remote.ts": `${HOST} export default class Site extends State { static ttl = 60; name = "site"; }`,
      "app/tally/remote.ts": `import Site from "../remote"; export async function site() { return Site.get().name; }`,
    });
    const server = await serve(root, expressive(), hostMvc(root));
    await server.transformRequest("/app/tally/remote.ts");
    await server.listen(0);

    const res = await fetch(new URL("/tally", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": TAB, "x-expressive-call": "site" },
      body: "[]",
    });

    expect(await res.json()).toEqual({ value: "site", frame: {} });
  });

  it("will throw if a sidecar exports what the client cannot call", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './remote'; export const Page = () => add", "app/tally/remote.ts": "export const add = 1" });
    const server = await serve(root);

    await expect(server.transformRequest("/app/tally/remote.ts")).rejects.toThrow("add is neither an async function nor an Error subclass");
  });

  it("will refuse in dev a sidecar class that is not an Error", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/tally/remote.ts": "class Base {} export class Odd extends Base {} export async function a() {}" }));
    await server.transformRequest("/app/tally/remote.ts");
    await server.listen(0);

    const res = await fetch(new URL("/tally", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": TAB, "x-expressive-call": "a" },
      body: "[]",
    });

    expect(res.status).toBe(500);
  });

  it("will dispatch a call on the module runner", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/tally/remote.ts": SIDECAR }));
    await server.listen(0);
    const url = new URL("/tally", server.resolvedUrls!.local[0]);

    const post = (body: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-expressive-connection": TAB, "x-expressive-call": "add" }, body });

    expect((await post("[2, 3]")).status).toBe(404);

    await server.transformRequest("/app/tally/remote.ts");
    expect(await (await post("[2, 3]")).json()).toEqual({ value: 5, frame: {} });

    const over = await post("[10, 0]");
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({ error: "/tally#Over", message: "Too big", status: 409 });

    const page = await fetch(url, { headers: { accept: "text/html" } });
    expect(await page.text()).toContain('<div id="root"></div>');
  });

  const CALLER = "import { add, Over } from './remote'; export const Page = () => [add, Over]";

  it("will call a module inside a remote/ folder by its path", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/tally/index.tsx": "import { add } from './remote/math/sum'; export const Page = () => add",
      "app/tally/remote/math/sum.ts": SIDECAR,
    });
    const server = await serve(root);

    const stub = (await server.transformRequest("/app/tally/remote/math/sum.ts"))?.code;
    expect(stub).toContain('call(at, "math/sum:add", args)');
    expect(stub).toContain('define("/tally#math/sum:Over", "Over")');

    await server.listen(0);
    const res = await fetch(new URL("/tally", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": TAB, "x-expressive-call": "math/sum:add" },
      body: "[2, 3]",
    });

    expect(await res.json()).toEqual({ value: 5, frame: {} });
  });

  it("will throw if a module outside its folder imports a remote/ module", async () => {
    const root = project({ "app/index.tsx": "import { add } from './tally/remote/sum'; export const Page = () => add", "app/tally/remote/sum.ts": SIDECAR });
    const server = await serve(root);

    await expect(server.transformRequest("/app/index.tsx")).rejects.toThrow("only modules in app/tally/ and below may call it");
  });

  async function buildBoth(files: Record<string, string>) {
    const root = project(files);
    const quiet = (config: InlineConfig) => {
      config.configFile = false;
      config.logLevel = "silent";
      config.resolve = SOURCES;
      config.build!.rollupOptions = { ...config.build!.rollupOptions, external: ["@expressive/dev", "@expressive/dev/server"] };
      return config;
    };
    const code = (out: any) => (Array.isArray(out) ? out[0] : out).output.map((o: any) => o.code ?? "").join("\n");

    const client = code(await build(quiet(clientBuild(root, { write: false }))));
    const server = code(await build(quiet(serverBuild(root, { write: false }))));

    return { client, server };
  }

  it("builds the node service with the calls the client imports, by hashed ids", async () => {
    const { client, server } = await buildBoth({
      "app/index.tsx": PAGE,
      "app/blog/[slug]/index.tsx": CALLER,
      "app/blog/[slug]/remote/index.ts": SIDECAR,
      "app/blog/[slug]/remote/unused.ts": "export async function secret() { return 1 }",
    });

    expect(server).toMatch(/pattern: \["blog", ":slug"\]/);
    expect(server).toContain("a + b");
    expect(server).not.toContain("secret");

    const [, id] = /"([\w-]{16})": Over/.exec(server) ?? [];
    expect(id).toBeDefined();
    expect(client).toContain(id);
    expect(client).not.toContain("blog/:slug#Over");
  });

  it("builds the node service with each folder's seat and its methods", async () => {
    const { server } = await buildBoth({
      "index.ts": "export default { remote: { opaque: false } };",
      "app/index.tsx": PAGE,
      "app/remote.ts": `${HOST} export default class Site extends State {}`,
      "app/tally/index.tsx": "import Tally from './remote'; export const Page = () => Tally",
      "app/tally/remote.ts": SEAT,
    });

    expect(server).toMatch(/seats: \[\{\s*pattern: \[\],\s*Type: Site\s*\}, \{\s*pattern: \["tally"\],\s*Type: Tally\s*\}\]/);
    expect(server).toMatch(/seat: \{\s*"fields": \["total"\],\s*"methods": \{\s*"default\.add": "add"\s*\}\s*\}/);
  });

  it("builds readable ids when index.ts sets remote.opaque off", async () => {
    const { client, server } = await buildBoth({
      "index.ts": "export default { remote: { opaque: false } };",
      "app/index.tsx": PAGE,
      "app/blog/[slug]/index.tsx": CALLER,
      "app/blog/[slug]/remote.ts": SIDECAR,
    });

    expect(server).toMatch(/"\/blog\/:slug#Over": Over/);
    expect(server).toMatch(/"?add"?: add/);
    expect(client).toContain("/blog/:slug#Over");
  });

  it("will not build the node service before the client", async () => {
    const config = serverBuild(project({ "app/index.tsx": PAGE }), { write: false });
    config.configFile = false;
    config.logLevel = "silent";
    config.resolve = SOURCES;

    await expect(build(config)).rejects.toThrow("run the client build first");
  });

  it("builds the node service with index.ts as its config", async () => {
    const { server } = await buildBoth({ "app/index.tsx": PAGE, "index.ts": "export default { port: 4000 };" });

    expect(server).toContain('from "@expressive/dev/server"');
    expect(server).toMatch(/port: 4(000|e3)/);
  });

  it("builds a static site with a bundled entry and no dev script", async () => {
    const root = project({ "app.tsx": "export default () => <h1>hi</h1>" });
    const out = await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [expressive()],
      resolve: SOURCES,
      build: { write: false, outDir: "dist/client" },
    });
    const { output } = Array.isArray(out) ? out[0] : (out as { output: any[] });
    const html = output.find((o: any) => o.fileName === "index.html")?.source as string;

    expect(html).toContain('<div id="root"></div>');
    expect(html).toMatch(/<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/);
    expect(html).not.toContain(".expressive/main.tsx");
  });
});
