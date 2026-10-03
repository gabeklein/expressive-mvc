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

  it("builds the node service with index.ts and every api module", async () => {
    const root = project({
      "app/index.tsx": PAGE,
      "app/api/greetings.ts": "export async function hello() { return 'hi'; }",
      "app/api/blog/posts.ts": "export const list = () => [];",
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
