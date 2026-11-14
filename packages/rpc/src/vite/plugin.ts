import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve as resolvePath, sep } from "node:path";
import type { Plugin, RunnableDevEnvironment } from "vite";

import type { Endpoint, Seats } from "../call";
import { toNode } from "../http/node";
import { guardScript } from "./guard";
import { Manifest, locate, type Exposed, type Located } from "./manifest";
import { scanModule, type Sources } from "./scan";
import { leaves, scanSurface } from "./surface";

export interface Options {
  dir?: string;
  /**
   * Which modules under `dir` are server modules, by their path from it - say, `/(^|\/)index\.ts$/`. Defaults to every script.
   *
   * The rest stay plain modules: the client stubs one only where a server module's groups or re-exports reach it, and
   * serves only those calls. A folder's gate is the default of its index only when the index is a server module.
   */
  test?: RegExp | ((path: string) => boolean);
  opaque?: boolean;
  /**
   * The app's own server module, Worker-shaped: `export default { fetch(request, env, ctx) }`.
   * It gets the calls from `@expressive/rpc/calls`, runs on the dev server and is bundled as
   * `dist/server/index.js`. Without one, the server answers calls and hands the rest to `env.ASSETS`.
   */
  entry?: string;
  /** Bindings the entry's `fetch` gets as `env` in dev - say, wrangler's `getPlatformProxy().env`. */
  env?: () => object | Promise<object>;
}

interface Entry {
  fetch?: (request: Request, env: object, ctx: object) => Response | undefined | Promise<Response | undefined>;
}

type Resolve = (spec: string, importer: string) => Promise<string | undefined>;

interface Runtime {
  handler: typeof import("../http/call").handler;
  scoped: typeof import("../http/call").scoped;
  verify: typeof import("../call").verify;
}

const ENV = "rpc";
const ENTRY = "\0@expressive/rpc/server";
const RUNTIME = "\0@expressive/rpc/runtime";
// `@expressive/rpc/calls` holds this key: its dev server's handler, or - built - the module the calls replace.
const CALLS = "@expressive/rpc/calls#dev";
const SHARED = ["@expressive/mvc", "@expressive/rpc"];
const NEXT = "x-expressive-next";
const INDEX = ["ts", "js", "mts", "mjs"].map(ext => `index.${ext}`);
const REACHED = "rpc";

export function rpc({ dir = "api", test, opaque = true, entry, env }: Options = {}): Plugin {
  let root = "";
  let folder = "";
  let main: string | undefined;
  let manifest = new Manifest();
  const reach = new Map<string, Map<string, Set<string>>>();

  const located = (file: string) => locate(folder, file);
  const owned = (file: string) => !!located(file);
  const sources = (resolve: Resolve): Sources => ({ resolve, read: file => readFileSync(file, "utf8") });
  const indexAt = (pattern: string[]) => INDEX.map(name => join(folder, ...pattern, name)).find(existsSync);

  function selected(file: string): boolean {
    if (!located(file)) return false;

    const path = relative(folder, file).split(sep).join("/");

    return typeof test == "function" ? test(path) : test ? test.test(path) : true;
  }

  const reached = (id: string) => new URLSearchParams(id.split("?")[1]).has(REACHED);

  function allowed(file: string): Set<string> {
    return new Set([...reach.values()].flatMap(leaves => [...(leaves.get(file) ?? [])]));
  }

  function fail(file: string, problems: string[]) {
    if (problems.length) throw new Error(`${relative(root, file)}: ${problems.join(" ")}`);
  }

  async function scanned(at: Located, resolve: Resolve, only: ReadonlySet<string>) {
    const { calls, errors, gate, problems } = await scanModule(at.file, readFileSync(at.file, "utf8"), sources(resolve), owned, {}, only);

    fail(at.file, problems);

    return { calls, errors, gate };
  }

  /** A server module's own calls and Error classes, and the tree of calls it reaches elsewhere. */
  async function surfaced(at: Located, resolve: Resolve) {
    const { tree, own, problems } = await scanSurface(at.file, readFileSync(at.file, "utf8"), sources(resolve), owned);

    fail(at.file, problems);

    return { tree, exposed: { ...at, ...(await scanned(at, resolve, new Set([...own, "default"]))) } };
  }

  async function gateAt(pattern: string[], resolve: Resolve): Promise<Located | undefined> {
    const file = indexAt(pattern);
    const at = file && selected(file) && located(file);

    if (at && (await surfaced(at, resolve)).exposed.gate) return at;
  }

  async function gates(resolve: Resolve): Promise<Located[]> {
    const patterns = new Map<string, string[]>();

    for (const { pattern } of manifest.modules.values())
      for (let i = 0; i <= pattern.length; i++) patterns.set(pattern.slice(0, i).join("/"), pattern.slice(0, i));

    const found = await Promise.all([...patterns.values()].map(pattern => gateAt(pattern, resolve)));

    return found.filter(gate => gate !== undefined);
  }

  return {
    name: "expressive-rpc",
    enforce: "pre",
    sharedDuringBuild: true,

    config(user, { command }) {
      // Built, the server bundles every dependency - what a Worker needs - unless the app set the environment's own
      // externals, as a Node server does to keep node_modules (pg, firebase-admin) installed beside it.
      const { noExternal, external } = user.environments?.[ENV]?.resolve ?? {};
      const chosen = (noExternal ?? external) !== undefined;

      return {
        builder: command === "build" ? {} : undefined,
        build: user.build?.outDir ? undefined : { outDir: "dist/client" },
        optimizeDeps: { include: ["@expressive/rpc"] },
        environments: {
          [ENV]: {
            consumer: "server",
            resolve: command !== "build" ? { external: SHARED } : chosen ? {} : { noExternal: true },
            build: { outDir: "dist/server" },
          },
        },
      };
    },

    configEnvironment(name, config) {
      if (name === ENV) config.build!.rolldownOptions = { input: { index: ENTRY }, external: [/^cloudflare:/] };
    },

    configResolved(config) {
      root = config.root;
      folder = join(realpathSync(root), dir);
      main = entry && resolvePath(root, entry);
    },

    buildStart() {
      if (this.environment.name !== "client" || this.environment.mode !== "build") return;

      manifest = new Manifest(opaque ? randomBytes(16).toString("base64url") : undefined);
      reach.clear();
    },

    async buildApp(builder) {
      await builder.build(builder.environments.client);
      await builder.build(builder.environments[ENV]);
    },

    async resolveId(id, importer, options) {
      if (id === ENTRY || id === RUNTIME) return id;

      // The built calls replace this module, so it is bundled even when the rest of the package stays installed.
      if (id === "@expressive/rpc/calls" && this.environment.name === ENV && this.environment.mode === "build") {
        const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });

        if (!resolved?.external) return resolved;

        return { id: createRequire(join(root, "package.json")).resolve(id), external: false };
      }

      if (!/^[./]/.test(id)) return;

      const scan = "scan" in options && options.scan;
      const stub = !scan && importer && this.environment.config.consumer === "client" && (selected(importer.split("?")[0]) || reached(importer));

      if (!scan && !stub) return;

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });

      if (!resolved) return resolved;
      if (scan) return selected(resolved.id) ? { id: `\0${resolved.id}`, external: true } : resolved;

      // A stub's import of a plain module in the folder - a leaf's or an Error parent's - is that module's stub.
      return located(resolved.id) && !selected(resolved.id) ? { ...resolved, id: `${resolved.id}?${REACHED}` } : resolved;
    },

    async load(id) {
      const resolve: Resolve = async (spec, importer) => (await this.resolve(spec, importer, { skipSelf: true }))?.id;

      if (id === ENTRY && main) {
        const from = JSON.stringify(main);
        return `import app from ${from};\nimport { scoped } from "@expressive/rpc/http";\n\nexport * from ${from};\nexport default scoped(app);\n`;
      }
      if (id === ENTRY) return `import { handle } from "@expressive/rpc/calls";\n\nexport default { async fetch(request, env) { return (await handle(request)) ?? env?.ASSETS?.fetch(request) ?? new Response("Not found.", { status: 404 }); } };\n`;
      if (id === RUNTIME) return `export { handler, scoped } from "@expressive/rpc/http";\nexport { install, verify } from "@expressive/rpc/protocol";\n`;
      if (this.environment.config.consumer !== "client") return;

      const file = id.split("?")[0];
      const at = located(file);

      if (!at) return;

      if (selected(file)) {
        const { tree, exposed } = await surfaced(at, resolve);

        reach.set(file, leaves(tree));

        for (const other of manifest.modules.values())
          if (!selected(other.file)) other.calls = other.calls.filter(name => allowed(other.file).has(name));

        manifest.modules.set(file, exposed);

        return manifest.stub(exposed, located, { lines: tree.size ? manifest.groups(file, tree) : [] });
      }

      if (!reached(id)) return;

      for (const [from, leaves] of reach) if (leaves.has(file)) this.addWatchFile(from);

      const exposed: Exposed = { ...at, ...(await scanned(at, resolve, allowed(file))) };

      manifest.modules.set(file, exposed);

      return manifest.stub(exposed, located);
    },

    async transform(code, id) {
      const file = id.split("?")[0];

      if (this.environment.name === ENV && this.environment.mode === "build" && code.includes(CALLS)) {
        const resolve: Resolve = async (spec, importer) => (await this.resolve(spec, importer, { skipSelf: true }))?.id;
        return { code: manifest.calls(await gates(resolve)), map: null };
      }

      const problem = this.environment.config.consumer === "client" && (await guardScript(code, file));

      if (problem) this.error(`${relative(root, file)} ${problem}`);
    },

    configureServer(server) {
      const environment = server.environments[ENV] as RunnableDevEnvironment;
      const { runner } = environment;
      const resolve: Resolve = async (spec, importer) => (await environment.pluginContainer.resolveId(spec, importer))?.id;
      let installed: unknown;

      const runtime = async (): Promise<Runtime> => {
        const { handler, install, scoped, verify } = await runner.import(RUNTIME);

        if (installed !== install) {
          installed = install;
          install();
        }

        return { handler, scoped, verify };
      };

      const endpoints = ({ verify }: Runtime): Endpoint[] =>
        manifest.byPattern().map(group => ({
          pattern: group[0].pattern,
          exports: () => manifest.exports(group, file => runner.import(file), (file, exports) => verify(relative(root, file), exports)),
        }));

      const seats: Seats = async pattern => {
        const gate = await gateAt(pattern, resolve);
        return gate && (await runner.import(gate.file)).default;
      };

      const handle = async (request: Request) => {
        const loaded = await runtime();
        return loaded.handler(endpoints(loaded), { dev: true, seats })(request);
      };

      Object.assign(globalThis, { [Symbol.for(CALLS)]: handle });
      server.httpServer?.once("close", () => {
        if (Reflect.get(globalThis, Symbol.for(CALLS)) === handle) Reflect.deleteProperty(globalThis, Symbol.for(CALLS));
      });

      if (!main) return void server.middlewares.use(toNode(handle));

      const file = main;
      const ctx = {
        waitUntil: (promise: unknown) => void Promise.resolve(promise).catch((error: unknown) => server.config.logger.error(`${relative(root, file)} waitUntil: ${error}`)),
        passThroughOnException() {},
      };
      let bindings: Promise<object> | undefined;

      server.middlewares.use(toNode(async request => {
        const { default: app }: { default?: Entry } = await runner.import(file);

        if (typeof app?.fetch != "function") throw new Error(`${relative(root, file)} must default-export { fetch(request, env, ctx) }.`);

        // ASSETS hands the request back to Vite - marked, since the scope may rebuild the response to add cookies
        const ASSETS = { fetch: async () => new Response(null, { status: 404, headers: { [NEXT]: "1" } }) };
        const { scoped } = await runtime();
        const response = await scoped(app).fetch!(request, { ...(await (bindings ??= Promise.resolve(env?.() ?? {}))), ASSETS }, ctx);

        return response?.headers.has(NEXT) ? undefined : response;
      }));
    },
  };
}
