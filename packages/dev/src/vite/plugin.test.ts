import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer as listen, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, createServerModuleRunner, type InlineConfig, type ViteDevServer } from "vite";

import { serverBuild } from "./build";
import { expressive } from "./plugin";

const PAGE = "export function Page(){ return <h1>hi</h1> }";
const CALLS = (name: string) => `export function Page(){ ${name}(); return <h1>hi</h1> }`;
const PACKAGES = fileURLToPath(new URL("../../../", import.meta.url));

const SOURCES: InlineConfig["resolve"] = {
  alias: [
    { find: /^@expressive\/dev$/, replacement: `${PACKAGES}dev/src/browser.ts` },
    { find: /^@expressive\/([^/]+)$/, replacement: `${PACKAGES}$1/src` },
    { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${PACKAGES}$1/src/$2` },
  ],
};

describe("vite host", () => {
  const dirs: string[] = [];
  const servers: ViteDevServer[] = [];
  const sockets: Server[] = [];

  afterEach(async () => {
    while (sockets.length) await new Promise(done => sockets.pop()!.close(done));
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

  async function serve(root: string, host = expressive()) {
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [host],
      resolve: SOURCES,
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
    expect(main?.code).toContain("dev/src/browser");
    expect(main?.code).toContain("/.expressive/routes.tsx");

    const routes = await server.transformRequest("/.expressive/routes.tsx");
    expect(routes?.code).toContain("/app/index.tsx");
    expect(routes?.code).toContain('to: ":slug"');
    expect(routes?.code).toMatch(/dev\/src\/jsx-dev-runtime/);
  });

  it("single-file project: entry mounts app.tsx directly", async () => {
    const server = await serve(project({ "app.tsx": "export default () => <h1>hi</h1>" }));

    const main = await server.transformRequest("/.expressive/main.tsx");
    expect(main?.code).toContain("/app.tsx");
    expect(main?.code).not.toContain("routes.tsx");
  });

  it("serves app/api modules on the module runner and reads index.ts as the config", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/api/index.ts": "export const ping = () => 'pong';",
      "app/api/greetings.ts": "export async function hello(name = 'World') { return `Hello ${name}!`; }",
      "index.ts": "export default { port: 0 };",
    });
    const host = expressive();
    const server = await serve(root, host);

    expect(await host.api!.config()).toEqual({ port: 0 });

    const socket = listen(server.middlewares);
    sockets.push(socket);
    await new Promise<void>(ready => socket.listen(0, ready));
    const base = `http://localhost:${(socket.address() as AddressInfo).port}/`;

    expect(await fetch(base + "api/ping").then(r => r.json())).toBe("pong");
    expect(await fetch(base + "api/greetings/hello", { method: "POST", body: '["Gabe"]' }).then(r => r.json())).toBe("Hello Gabe!");
    expect((await fetch(base + "api/greetings/nope")).status).toBe(404);
  });

  it("will share linked Expressive packages between the host and the module runner", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/api/probe.ts": 'export { State } from "@expressive/mvc";',
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
    const { State } = await runner.import(join(root, "app/api/probe.ts"));
    await runner.close();

    expect(State).toBe(createRequire(join(root, "index.js"))("@expressive/mvc").State);
  });

  it("will give the browser a stub for each server module, and the server the module", async () => {
    const root = project({
      "app/index.tsx": "import { hello } from \"./api/greetings\";\n" + PAGE,
      "app/api/greetings.ts": "import { readFileSync } from 'node:fs';\nexport async function hello(name = 'World') { return `Hello ${name}!`; }\nexport default () => {};",
      "app/blog/[slug]/api.ts": "export const like = (n = 1) => n + 1;\nexport function share() {}",
      "app/blog/[slug]/index.tsx": "import { like } from \"./api\";\n" + PAGE,
    });
    const server = await serve(root);

    const client = await server.transformRequest("/app/api/greetings.ts");
    expect(client?.code).toMatch(/const scope = \["api",\s*"greetings"\]/);
    expect(client?.code).toContain('export const hello = (...args) => call(scope, "hello", args)');
    expect(client?.code).not.toContain("node:fs");
    expect(client?.code).not.toContain("default");

    const sidecar = await server.transformRequest("/app/blog/[slug]/api.ts");
    expect(sidecar?.code).toMatch(/const scope = \["blog",\s*":slug"\]/);
    expect(sidecar?.code).toContain('"like"');
    expect(sidecar?.code).toContain('"share"');

    const rpc = await server.transformRequest("/.expressive/rpc.ts");
    expect(rpc?.code).toContain("export async function call");

    const real = await server.environments.ssr.transformRequest(join(root, "app/blog/[slug]/api.ts"));
    expect(real?.code).toContain("n + 1");
  });

  it("will throw if a page imports a sidecar outside its own scope", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/blog/api.ts": "export const list = () => [];",
      "app/blog/index.tsx": "import { list } from \"./api\";\n" + CALLS("list"),
      "app/blog/[slug].tsx": "import { list } from \"./api\";\n" + CALLS("list"),
      "app/about/index.tsx": "import { list } from \"../blog/api\";\n" + CALLS("list"),
    });
    const server = await serve(root);

    await expect(server.transformRequest("/app/blog/index.tsx")).resolves.toBeTruthy();
    await expect(server.transformRequest("/app/blog/[slug].tsx")).resolves.toBeTruthy();
    await expect(server.transformRequest("/app/about/index.tsx")).rejects.toThrow("only its own folder and those below it may call");
  });

  it("serves sidecar functions by POST at the scope's path on the module runner", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/api.ts": "export const ping = () => 'pong';",
      "app/blog/[slug]/api.ts": "export default () => { if (globalThis.locked) throw new Error('locked'); };\nexport const like = (n = 1) => n + 1;",
      "app/blog/[slug]/index.tsx": PAGE,
    });
    const server = await serve(root);

    const socket = listen(server.middlewares);
    sockets.push(socket);
    await new Promise<void>(ready => socket.listen(0, ready));
    const base = `http://localhost:${(socket.address() as AddressInfo).port}/`;
    const post = (path: string, body = "[]") => fetch(base + path, { method: "POST", body });

    expect(await post("ping").then(r => r.json())).toBe("pong");
    expect(await post("blog/hello/like", "[2]").then(r => r.json())).toBe(3);
    expect((await post("blog/hello/nope")).status).toBe(404);

    (globalThis as any).locked = true;
    expect(await post("blog/hello/like").then(r => r.json())).toEqual({ error: "locked" });
    delete (globalThis as any).locked;
  });

  it("builds the node service with index.ts and every api module", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/api/greetings.ts": "export async function hello() { return 'hi'; }",
      "app/api/blog/posts.ts": "export const list = () => [];",
      "app/blog/[slug]/api.ts": "export const like = () => 1;",
      "index.ts": "export default { port: 4000 };",
    });
    const config = serverBuild(root, { write: false });
    config.configFile = false;
    config.logLevel = "silent";
    config.resolve = SOURCES;
    config.build!.rollupOptions = { ...config.build!.rollupOptions, external: ["@expressive/dev"] };

    const out = await build(config);
    const { output } = Array.isArray(out) ? out[0] : (out as { output: any[] });
    const entry = output.find((o: any) => o.fileName === "index.js")?.code as string;

    expect(entry).toContain('from "@expressive/dev"');
    expect(entry).toContain('"greetings"');
    expect(entry).toContain('"blog/posts"');
    expect(entry).toMatch(/port: 4(000|e3)/);
    expect(entry).toContain('pattern: ["blog", ":slug"]');
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
