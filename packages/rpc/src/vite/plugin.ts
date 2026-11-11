import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, join, relative, resolve as resolvePath } from "node:path";
import type { Plugin, RunnableDevEnvironment } from "vite";

import type { Node } from "../http/tree";
import { METHODS } from "../segments";
import { toNode } from "../http/node";
import { guardScript } from "./guard";
import { Manifest, SCRIPT, isAddress, isDynamic, locate, pathOf, type Exposed, type Located, type Route } from "./manifest";
import { moduleOf, scanModule } from "./scan";

export interface Options {
  dir?: string;
  opaque?: boolean;
  /**
   * The app's own server module, Worker-shaped: `export default { fetch(request, env, ctx) }`.
   * It gets the calls from `@expressive/rpc/calls`, runs on the dev server and is bundled as
   * `dist/server/index.js`. Without one, the server answers calls and hands the rest to `env.ASSETS`.
   */
  entry?: string;
  /** Bindings the entry's `fetch` gets as `env` in dev - say, wrangler's `getPlatformProxy().env`. */
  env?: () => object | Promise<object>;
  /**
   * The path `dir` is served under: with `"/api"`, `api/todos.ts` answers at `/api/todos`, and the
   * client's calls go there. Anything outside it is the entry's, or the assets'.
   */
  base?: string;
}

interface Entry {
  fetch?: (request: Request, env: object, ctx: object) => Response | undefined | Promise<Response | undefined>;
}

type Resolve = (spec: string, importer: string) => Promise<string | undefined>;

interface Runtime {
  router: typeof import("../http/tree").router;
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
const INDEX = /^index\.[cm]?[jt]s$/;

export function rpc({ dir = "api", opaque = true, entry, env, base = "" }: Options = {}): Plugin {
  let root = "";
  let folder = "";
  let main: string | undefined;
  let manifest = new Manifest();


  const located = (file: string) => locate(folder, file);

  async function scanned(at: Located, resolve: Resolve) {
    const { calls, methods, errors, gate, problems } = await scanModule(at.file, readFileSync(at.file, "utf8"), { resolve, read: file => readFileSync(file, "utf8") }, file => !!located(file));
    const param = [...at.pattern, at.leaf ?? ""].find(isDynamic);

    if (methods.length && !isAddress(at)) {
      const name = basename(at.file).replace(SCRIPT, "");
      const instead = at.module ? `(${name})${extname(at.file)} or ${name}/(index)${extname(at.file)}` : `(index)${extname(at.file)}`;
      problems.push(`${methods.join(", ")} would make this a route, and only [name], [...] and (name) modules are - move ${methods.length > 1 ? "them" : "it"} to ${instead}.`);
    }
    if (calls.length && param) problems.push(`Calls answer at their folder's path, which the client has no ${param} to fill - export them from a static folder, or answer here with GET, POST...`);
    if (problems.length) throw new Error(`${relative(root, at.file)}: ${problems.join(" ")}`);

    return { calls, methods, errors, gate };
  }

  /** The folder's gates, and its route modules - those exporting `GET`, `POST`... */
  async function survey(resolve: Resolve): Promise<{ gates: Located[]; routes: Route[] }> {
    const scripts = existsSync(folder)
      ? readdirSync(folder, { recursive: true, withFileTypes: true }).filter(item => item.isFile()).map(item => located(join(item.parentPath, item.name)))
      : [];
    const gates: Located[] = [];
    const routes: Route[] = [];

    for (const at of scripts) {
      if (!at) continue;

      const source = readFileSync(at.file, "utf8");
      const exports = [...moduleOf(at.file, source).exports.keys()];
      const index = INDEX.test(basename(at.file));

      if (!(index && exports.includes("default")) && !exports.some(name => METHODS.includes(name))) continue;

      const { gate, methods } = await scanned(at, resolve);

      if (gate) gates.push(at);
      if (methods.length) routes.push({ ...at, methods });
    }

    return { gates, routes };
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
      if (this.environment.name === "client" && this.environment.mode === "build")
        manifest = new Manifest(opaque ? randomBytes(16).toString("base64url") : undefined);
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

      if (!("scan" in options && options.scan) || !/^[./]/.test(id)) return;

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });

      return resolved && located(resolved.id) ? { id: `\0${resolved.id}`, external: true } : resolved;
    },

    async load(id) {
      const resolve: Resolve = async (spec, importer) => (await this.resolve(spec, importer, { skipSelf: true }))?.id;

      if (id === ENTRY && main) {
        const from = JSON.stringify(main);
        return `import app from ${from};\nimport { scoped } from "@expressive/rpc/http";\n\nexport * from ${from};\nexport default scoped(app);\n`;
      }
      if (id === ENTRY) return `import { handle } from "@expressive/rpc/calls";\n\nexport default { async fetch(request, env) { return (await handle(request)) ?? env?.ASSETS?.fetch(request) ?? new Response("Not found.", { status: 404 }); } };\n`;
      if (id === RUNTIME) return `export { router, scoped } from "@expressive/rpc/http";\nexport { install, verify } from "@expressive/rpc/protocol";\n`;
      if (this.environment.config.consumer !== "client") return;

      const at = located(id.split("?")[0]);

      if (!at) return;

      const exposed: Exposed = { ...at, ...(await scanned(at, resolve)) };

      manifest.modules.set(at.file, exposed);

      return manifest.stub(exposed, located, { at: base.replace(/\/+$/, "") + pathOf(exposed) });
    },

    async transform(code, id) {
      const file = id.split("?")[0];

      if (this.environment.name === ENV && this.environment.mode === "build" && code.includes(CALLS)) {
        const resolve: Resolve = async (spec, importer) => (await this.resolve(spec, importer, { skipSelf: true }))?.id;
        const { gates, routes } = await survey(resolve);
        return { code: manifest.tree(gates, routes, { base }), map: null };
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
        const { router, install, scoped, verify } = await runner.import(RUNTIME);

        if (installed !== install) {
          installed = install;
          install();
        }

        return { router, scoped, verify };
      };

      const tree = async ({ verify }: Runtime): Promise<Node> => {
        const { gates, routes } = await survey(resolve);

        return manifest.branches<any>(gates, routes, {
          calls: group => () => manifest.exports(group, file => runner.import(file), (file, exports) => verify(relative(root, file), exports)),
          gate: gate => async () => (await runner.import(gate.file)).default,
          route: route => () => runner.import(route.file),
        });
      };

      const handle = async (request: Request) => {
        const loaded = await runtime();
        return loaded.router(() => tree(loaded), { dev: true, base })(request);
      };

      const calls = { handle };

      Object.assign(globalThis, { [Symbol.for(CALLS)]: calls });
      server.httpServer?.once("close", () => {
        if (Reflect.get(globalThis, Symbol.for(CALLS)) === calls) Reflect.deleteProperty(globalThis, Symbol.for(CALLS));
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
