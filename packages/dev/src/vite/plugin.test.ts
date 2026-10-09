import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, createServerModuleRunner, type InlineConfig, type ViteDevServer } from "vite";

import { serverBuild } from "./build";
import { expressive } from "./plugin";

const PAGE = "export function Page(){ return <h1>hi</h1> }";
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

  it("will not scan specs, tests or sidecars beside routes for dependencies", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/index.spec.ts": "import '@playwright/test';" }));
    expect(server.config.optimizeDeps.entries).toEqual(["app/**/*.{ts,tsx,js,jsx}", "!app/**/*.{spec,test}.*", "!app/**/api.*"]);
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
    const root = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './api'; export const Page = () => add", "app/tally/api.ts": SIDECAR });
    const server = await serve(root);

    await server.transformRequest("/app/tally/index.tsx");
    const stub = (await server.transformRequest("/app/tally/api.ts"))?.code;

    expect(stub).toContain('const at = ["tally"]');
    expect(stub).toContain('call(at, "add", args)');
    expect(stub).toContain('define("/tally#Over", "Over")');
    expect(stub).not.toContain("a + b");
  });

  it("will stub a sidecar in a project reached through a symlink", async () => {
    const real = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './api'; export const Page = () => add", "app/tally/api.ts": SIDECAR });
    const link = join(mkdtempSync(join(tmpdir(), "link-")), "app");
    dirs.push(dirname(link));
    symlinkSync(real, link, "dir");

    const server = await serve(link);
    await server.transformRequest("/app/tally/index.tsx");

    expect((await server.transformRequest("/app/tally/api.ts"))?.code).not.toContain("a + b");
  });

  it("will throw if a module outside its folder imports a sidecar", async () => {
    const root = project({ "app/index.tsx": "import { add } from './tally/api'; export const Page = () => add", "app/tally/api.ts": SIDECAR });
    const server = await serve(root);

    await expect(server.transformRequest("/app/index.tsx")).rejects.toThrow("only modules in app/tally/ and below may call it");
  });

  it("will throw if a sidecar exports what the client cannot call", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/tally/index.tsx": "import { add } from './api'; export const Page = () => add", "app/tally/api.ts": "export const add = 1" });
    const server = await serve(root);

    await expect(server.transformRequest("/app/tally/api.ts")).rejects.toThrow("add is neither an async function nor an Error subclass");
  });

  it("will refuse in dev a sidecar class that is not an Error", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/tally/api.ts": "class Base {} export class Odd extends Base {} export async function a() {}" }));
    await server.listen(0);

    const res = await fetch(new URL("/tally", server.resolvedUrls!.local[0]), {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-call": "a" },
      body: "[]",
    });

    expect(res.status).toBe(500);
  });

  it("will dispatch a call on the module runner", async () => {
    const server = await serve(project({ "app/index.tsx": PAGE, "app/tally/api.ts": SIDECAR }));
    await server.listen(0);
    const url = new URL("/tally", server.resolvedUrls!.local[0]);

    const post = (body: string) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": "add" }, body });

    expect(await (await post("[2, 3]")).json()).toBe(5);

    const over = await post("[10, 0]");
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({ error: "/tally#Over", message: "Too big", status: 409 });

    const page = await fetch(url, { headers: { accept: "text/html" } });
    expect(await page.text()).toContain('<div id="root"></div>');
  });

  it("builds the node service with each sidecar's calls", async () => {
    const root = project({ "app/index.tsx": PAGE, "app/blog/[slug]/api.ts": SIDECAR });
    const config = serverBuild(root, { write: false });
    config.configFile = false;
    config.logLevel = "silent";
    config.resolve = SOURCES;
    config.build!.rollupOptions = { ...config.build!.rollupOptions, external: ["@expressive/dev"] };

    const out = await build(config);
    const { output } = Array.isArray(out) ? out[0] : (out as { output: any[] });
    const entry = output.find((o: any) => o.fileName === "index.js")?.code as string;

    expect(entry).toMatch(/pattern: \["blog", ":slug"\]/);
    expect(entry).toContain("a + b");
    expect(entry).toMatch(/classes: \{ Over \}/);
  });

  it("builds the node service with index.ts as its config", async () => {
    const root = project({
      "app/index.tsx": PAGE,
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
    expect(entry).toMatch(/port: 4(000|e3)/);
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
