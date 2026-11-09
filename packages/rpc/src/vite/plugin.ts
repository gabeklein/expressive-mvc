import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve as resolvePath } from "node:path";
import type { Plugin, RunnableDevEnvironment } from "vite";

import type { Endpoint, Seats } from "../call";
import { toNode } from "../http/node";
import { guardScript } from "./guard";
import { Manifest, locate, type Exposed, type Located } from "./manifest";
import { scanModule } from "./scan";

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

export function rpc({ dir = "api", opaque = true, entry, env }: Options = {}): Plugin {
  let root = "";
  let folder = "";
  let main: string | undefined;
  let manifest = new Manifest();


  const located = (file: string) => locate(folder, file);

  async function scanned(at: Located, resolve: Resolve) {
    const { calls, errors, gate, problems } = await scanModule(at.file, readFileSync(at.file, "utf8"), { resolve, read: file => readFileSync(file, "utf8") }, file => !!located(file));

    if (problems.length) throw new Error(`${relative(root, at.file)}: ${problems.join(" ")}`);

    return { calls, errors, gate };
  }

  async function gateAt(pattern: string[], resolve: Resolve): Promise<Located | undefined> {
    const file = INDEX.map(name => join(folder, ...pattern, name)).find(existsSync);
    const at = file && located(file);

    if (at && (await scanned(at, resolve)).gate) return at;
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
      return {
        builder: command === "build" ? {} : undefined,
        build: user.build?.outDir ? undefined : { outDir: "dist/client" },
        optimizeDeps: { include: ["@expressive/rpc"] },
        environments: {
          [ENV]: {
            consumer: "server",
            resolve: command === "build" ? { noExternal: true } : { external: SHARED },
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
      if (id === RUNTIME) return `export { handler, scoped } from "@expressive/rpc/http";\nexport { install, verify } from "@expressive/rpc/protocol";\n`;
      if (this.environment.config.consumer !== "client") return;

      const at = located(id.split("?")[0]);

      if (!at) return;

      const exposed: Exposed = { ...at, ...(await scanned(at, resolve)) };

      manifest.modules.set(at.file, exposed);

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
