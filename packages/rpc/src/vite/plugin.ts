import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { transformWithOxc, type Plugin, type RunnableDevEnvironment } from "vite";

import type { Endpoint, Seats } from "../call";
import { guard } from "../guard";
import { toNode } from "../http/node";
import { Manifest, SCRIPT, locate, type Exposed, type Located } from "./manifest";
import { scanModule } from "./scan";

export interface Options {
  dir?: string;
  opaque?: boolean;
}

type Resolve = (spec: string, importer: string) => Promise<string | undefined>;

interface Runtime {
  handler: typeof import("../http/call").handler;
  verify: typeof import("../call").verify;
}

const ENV = "rpc";
const ENTRY = "\0@expressive/rpc/server";
const RUNTIME = "\0@expressive/rpc/runtime";
const HTTP = "@expressive/rpc/http";
const SHARED = ["@expressive/mvc", "@expressive/rpc"];
const INDEX = ["ts", "js", "mts", "mjs"].map(ext => `index.${ext}`);

export function rpc({ dir = "api", opaque = true }: Options = {}): Plugin {
  let root = "";
  let folder = "";
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
        optimizeDeps: { include: [HTTP] },
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
      if (name === ENV) config.build!.rolldownOptions = { input: { index: ENTRY } };
    },

    configResolved(config) {
      root = config.root;
      folder = join(realpathSync(root), dir);
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

      return resolved && located(resolved.id) ? { id: resolved.id, external: true } : resolved;
    },

    async load(id) {
      const resolve: Resolve = async (spec, importer) => (await this.resolve(spec, importer, { skipSelf: true }))?.id;

      if (id === ENTRY) return manifest.entry(await gates(resolve));
      if (id === RUNTIME) return `export { handler } from "${HTTP}";\nexport { install, verify } from "@expressive/rpc";\n`;
      if (this.environment.config.consumer !== "client") return;

      const at = located(id.split("?")[0]);

      if (!at) return;

      const exposed: Exposed = { ...at, ...(await scanned(at, resolve)) };

      manifest.modules.set(at.file, exposed);

      return manifest.stub(exposed, located);
    },

    async transform(code, id) {
      const file = id.split("?")[0];

      if (this.environment.config.consumer !== "client" || !SCRIPT.test(file) || !code.includes(HTTP)) return;

      const problem = guard((await transformWithOxc(code, file, { jsx: { runtime: "automatic" } })).code);

      if (problem) this.error(`${relative(root, file)} ${problem}`);
    },

    configureServer(server) {
      const environment = server.environments[ENV] as RunnableDevEnvironment;
      const { runner } = environment;
      const resolve: Resolve = async (spec, importer) => (await environment.pluginContainer.resolveId(spec, importer))?.id;
      let installed: unknown;

      const runtime = async (): Promise<Runtime> => {
        const { handler, install, verify } = await runner.import(RUNTIME);

        if (installed !== install) {
          installed = install;
          install();
        }

        return { handler, verify };
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

      server.middlewares.use(toNode(async request => {
        const loaded = await runtime();
        return loaded.handler(endpoints(loaded), { dev: true, seats })(request);
      }));
    },
  };
}
