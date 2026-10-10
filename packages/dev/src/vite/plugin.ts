import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerModuleRunner, runnerImport, type Plugin, type ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";

import type { AppConfig } from "../server/config";
import { GENERATED, SHELL, bootstrap, ensureBootstrap, importRel, resolveProject, serverEntry, type Project } from "./project";
import { runtime } from "../client/call";
import { Exposure, type Exposed } from "./remote";
import { generateRoutes, remoteEntries, remoteOf, type Remote } from "./routes";
import { dispatch, isCall, verify, type Endpoint, type Seats } from "../server/call";
import { install } from "../server/context";
import { scanExports, scanSidecar } from "./scan";

const MAIN = "main.tsx";
const ROUTES = "routes.tsx";
const SERVER = "server.ts";
const CALL = "call.ts";
const SCRIPT = /\.[cm]?[jt]sx?$/;
const REMOTE_IMPORT = /(^|\/)remote(\/|\.[cm]?[jt]s$|$)/;

export interface Host {
  config(): Promise<AppConfig>;
}

const DEPS = [
  "@expressive/mvc",
  "@expressive/mvc/hot",
  "@expressive/mvc/jsx-runtime",
  "@expressive/dom",
  "@expressive/dom/jsx-runtime",
  "@expressive/dom/jsx-dev-runtime",
  "@expressive/router",
  "@expressive/dev",
  "@expressive/dev/jsx-runtime",
  "@expressive/dev/jsx-dev-runtime",
];

const HOSTED = ["@expressive/inspect/vite/client", "@expressive/inspect/install", "@expressive/inspect"];

const builds = new Map<string, Exposure>();

const SHARED = ["@expressive/mvc", "@expressive/dom", "@expressive/router", "@expressive/inspect", "@expressive/dev"];

export function expressive(): Plugin<Host> {
  let root = process.cwd();
  let project: Project;
  let generatedDir: string;
  let mainId: string;
  let routesId: string;
  let serverId: string;
  let callId: string;
  let htmlId: string;
  let runner: ModuleRunner | undefined;
  let exposure = new Exposure();
  let build: "client" | "server" | undefined;

  const generatedPath = (id: string, importer?: string) => {
    if (id.startsWith(`/${GENERATED}/`)) return join(root, id);
    if (importer?.startsWith(generatedDir) && id.startsWith(".")) return resolve(dirname(importer), id);

    return id;
  };

  const remoteAt = (file: string) => (project.appDir ? remoteOf(project.appDir, file) : undefined);

  const readShell = () =>
    project.htmlPath ? ensureBootstrap(readFileSync(project.htmlPath, "utf8")) : SHELL;

  return {
    name: "expressive",
    enforce: "pre",

    api: {
      async config() {
        if (!runner) throw new Error("The dev server is not running.");
        if (!project.configPath) return {};
        return ((await runner.import(project.configPath)).default as AppConfig) ?? {};
      },
    },

    config(user, env) {
      root = realpathSync(resolve(user.root ?? process.cwd()));
      project = resolveProject(root);
      build = env.command !== "build" ? undefined : env.isSsrBuild ? "server" : "client";

      const entries = project.appDir
        ? ["app/**/*.{ts,tsx,js,jsx}", "!app/**/*.{spec,test}.*", "!app/**/remote.*", "!app/**/remote/**"]
        : [importRel(root, project.appPath!)];

      return {
        root,
        appType: "custom",
        oxc: { jsx: { runtime: "automatic", importSource: "@expressive/dev" } },
        optimizeDeps: { entries, include: DEPS },
        resolve: { alias: hosted() },
        environments: { ssr: { resolve: { external: SHARED } } },
        build: env.isSsrBuild ? undefined : { rollupOptions: { input: project.htmlPath ?? join(root, "index.html") } },
      };
    },

    configResolved(config) {
      root = config.root;
      generatedDir = join(root, GENERATED);
      mainId = join(generatedDir, MAIN);
      routesId = join(generatedDir, ROUTES);
      serverId = join(generatedDir, SERVER);
      callId = join(generatedDir, CALL);
      htmlId = join(root, "index.html");
    },

    async buildStart() {
      if (build === "client") {
        const salt = (await buildConfig(project)).remote?.opaque === false ? undefined : randomBytes(16).toString("base64url");
        builds.set(root, (exposure = new Exposure(salt)));
      }

      if (build === "server") {
        const client = builds.get(root);
        if (!client) this.error("The server build needs the client build's remote calls - run the client build first.");
        exposure = client;
      }
    },

    async resolveId(id, importer, options) {
      const generated = generatedPath(id, importer);

      switch (generated) {
        case mainId:
        case routesId:
        case serverId:
        case callId:
          return generated;
      }

      if (id === htmlId && !existsSync(htmlId)) return htmlId;
      if (options.ssr || !importer || !REMOTE_IMPORT.test(id) || !SCRIPT.test(importer.split("?")[0])) return;

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
      const remote = resolved && remoteAt(resolved.id);

      if (!remote) return resolved;

      if (!importer.split("?")[0].startsWith(remote.folder + sep))
        this.error(`${relative(root, importer)} imports ${relative(root, resolved.id)} - only modules in ${relative(root, remote.folder)}/ and below may call it.`);

      return "scan" in options && options.scan ? { id: resolved.id, external: true } : resolved;
    },

    load(id, options) {
      const file = id.split("?")[0];
      const remote = !options?.ssr && remoteAt(file);

      if (remote) {
        const { calls, classes, seat, problems } = scanSidecar(readFileSync(file, "utf8"), file, !remote.module);
        if (problems.length) this.error(`${relative(root, file)}: ${problems.join(" ")}`);

        const exposed = { ...remote, calls, classes, seat };
        exposure.remotes.set(file, exposed);

        return stub(exposure, exposed);
      }

      switch (id) {
        case callId:
          return `import { State } from "@expressive/mvc";\nexport const { call, define, twin } = (${runtime})(State);`;
        case mainId:
          return bootstrap(project.appDir ? `./${ROUTES}` : importRel(generatedDir, project.appPath!));
        case routesId:
          return generateRoutes(project.appDir!, generatedDir, scanExports);
        case serverId:
          return serverEntry(project, generatedDir, exposure, seated(project));
        case htmlId:
          return SHELL;
      }
    },

    transformIndexHtml: {
      order: "pre",
      handler: html => ensureBootstrap(html),
    },

    configureServer(server) {
      const host = (runner = createServerModuleRunner(server.environments.ssr));
      install();
      watchRoutes(server, project, routesId);

      const endpoints = () => exposure.byPattern().map(group => endpointOf(host, root, exposure, group));

      server.middlewares.use((req, res, next) => {
        if (!isCall(req)) return next();

        dispatch(req, res, endpoints, true, seatsOf(host, project)).catch(next);
      });

      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== "GET" || !req.headers.accept?.includes("text/html")) return next();

          try {
            const html = await server.transformIndexHtml(req.originalUrl ?? req.url!, readShell());
            res.setHeader("Content-Type", "text/html");
            res.end(html);
          } catch (error) {
            next(error);
          }
        });
      };
    },
  };
}

function watchRoutes(server: ViteDevServer, project: Project, routesId: string) {
  const { appDir } = project;
  if (!appDir) return;

  server.watcher.add(appDir);

  const changed = (file: string) => {
    if (!file.startsWith(appDir)) return;

    const mod = server.moduleGraph.getModuleById(routesId);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: "full-reload" });
  };

  server.watcher.on("add", changed);
  server.watcher.on("unlink", changed);
}

function hosted() {
  const alias: { find: string; replacement: string }[] = [];

  for (const find of HOSTED)
    try {
      alias.push({ find, replacement: fileURLToPath(import.meta.resolve(find)) });
    } catch {}

  return alias;
}

function endpointOf(host: ModuleRunner, root: string, exposure: Exposure, group: Exposed[]): Endpoint {
  return {
    pattern: group[0].pattern,
    async exports() {
      const calls: Record<string, unknown> = {};
      const classes: Record<string, unknown> = {};

      for (const remote of group) {
        const mod = await host.import(remote.file);
        const own: Record<string, unknown> = {};

        for (const name of remote.calls) calls[exposure.callId(remote, name)] = mod[name];
        for (const name of remote.seat?.methods ?? []) calls[exposure.callId(remote, `default.${name}`)] = (...args: unknown[]) => mod.default.use()[name](...args);
        for (const name of remote.classes) own[exposure.classId(remote, name)] = mod[name];

        verify(relative(root, remote.file), { calls, classes: own });
        Object.assign(classes, own);
      }

      return { calls, classes };
    },
  };
}

function seated(project: Project): Remote[] {
  if (!project.appDir) return [];

  return remoteEntries(project.appDir).filter(remote => scanSidecar(readFileSync(remote.file, "utf8"), remote.file).seat);
}

function seatsOf(host: ModuleRunner, project: Project): Seats {
  return async pattern => {
    const remote = seated(project).find(remote => remote.pattern.join("/") === pattern.join("/"));
    return remote && (await host.import(remote.file)).default;
  };
}

function methodIds(exposure: Exposure, remote: Exposed): Record<string, string> {
  return Object.fromEntries(remote.seat!.methods.map(name => [name, exposure.callId(remote, `default.${name}`)]));
}

function stub(exposure: Exposure, remote: Exposed): string {
  const json = JSON.stringify;

  return [
    `import { call, define, twin } from "/${GENERATED}/${CALL}";`,
    `const at = ${json(remote.pattern)};`,
    ...remote.calls.map(name => `export const ${name} = (...args) => call(at, ${json(exposure.callId(remote, name))}, args);`),
    ...remote.classes.map(name => `export const ${name} = define(${json(exposure.classId(remote, name))}, ${json(name)});`),
    ...(remote.seat ? [`export default twin(at, ${json(methodIds(exposure, remote))}, ${json(remote.seat.name)});`] : []),
    "",
  ].join("\n");
}

async function buildConfig(project: Project): Promise<AppConfig> {
  if (!project.configPath) return {};

  const { module } = await runnerImport<{ default?: AppConfig }>(project.configPath, { root: project.root, configFile: false, logLevel: "silent" });
  return module.default ?? {};
}
