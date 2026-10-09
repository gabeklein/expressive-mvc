import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerModuleRunner, type Plugin, type ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";

import type { AppConfig } from "../server/config";
import { GENERATED, SHELL, bootstrap, ensureBootstrap, importRel, resolveProject, serverEntry, type Project, type SidecarEntry } from "./project";
import { call } from "../client/call";
import { generateRoutes, sidecarPattern, sidecars, type Sidecar } from "./routes";
import { dispatch, isCall, type Endpoint } from "../server/call";
import { scanExports, scanSidecar } from "./scan";

const MAIN = "main.tsx";
const ROUTES = "routes.tsx";
const SERVER = "server.ts";
const CALL = "call.ts";
const SCRIPT = /\.[cm]?[jt]sx?$/;
const SIDECAR_IMPORT = /(^|\/)api(\.[cm]?[jt]s)?$/;

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

      const entries = project.appDir
        ? ["app/**/*.{ts,tsx,js,jsx}", "!app/**/*.{spec,test}.*", "!app/**/api.*"]
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

    async resolveId(id, importer, options) {
      const generated =
        id.startsWith(`/${GENERATED}/`) ? join(root, id)
        : importer?.startsWith(generatedDir) && id.startsWith(".") ? resolve(dirname(importer), id)
        : id;

      switch (generated) {
        case mainId:
        case routesId:
        case serverId:
        case callId:
          return generated;
      }

      if (id === htmlId && !existsSync(htmlId)) return htmlId;
      if (options.ssr || !importer || !project.appDir || !SIDECAR_IMPORT.test(id) || !SCRIPT.test(importer.split("?")[0])) return;

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });

      if (!resolved || !sidecarPattern(project.appDir, resolved.id)) return resolved;

      const folder = dirname(resolved.id);

      if (!importer.split("?")[0].startsWith(folder + sep))
        this.error(`${relative(root, importer)} imports ${relative(root, resolved.id)} - only modules in ${relative(root, folder)}/ and below may call it.`);

      return "scan" in options && options.scan ? { id: resolved.id, external: true } : resolved;
    },

    load(id, options) {
      const file = id.split("?")[0];
      const pattern = !options?.ssr && project.appDir && sidecarPattern(project.appDir, file);

      if (pattern) {
        const { calls, errors } = scanSidecar(readFileSync(file, "utf8"), file);
        if (errors.length) this.error(`${relative(root, file)}: ${errors.join(" ")}`);
        return stub(pattern, calls);
      }

      switch (id) {
        case callId:
          return `export ${call}`;
        case mainId:
          return bootstrap(project.appDir ? `./${ROUTES}` : importRel(generatedDir, project.appPath!));
        case routesId:
          return generateRoutes(project.appDir!, generatedDir, scanExports);
        case serverId:
          return serverEntry(project, generatedDir, project.appDir ? sidecars(project.appDir).map(scanned) : []);
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
      watchRoutes(server, project, routesId);

      const endpoints = () => (project.appDir ? sidecars(project.appDir) : []).map(({ pattern, file }): Endpoint => ({
        pattern,
        calls: async () => {
          const mod = await host.import(file);
          const { calls } = scanSidecar(readFileSync(file, "utf8"), file);

          return Object.fromEntries(calls.map(name => [name, mod[name]]));
        },
      }));

      server.middlewares.use((req, res, next) => {
        if (!isCall(req)) return next();

        dispatch(req, res, endpoints, true).catch(next);
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

function scanned(sidecar: Sidecar): SidecarEntry {
  return { ...sidecar, calls: scanSidecar(readFileSync(sidecar.file, "utf8"), sidecar.file).calls };
}

function stub(pattern: string[], calls: string[]): string {
  return [
    `import { call } from "/${GENERATED}/${CALL}";`,
    `const at = ${JSON.stringify(pattern)};`,
    ...calls.map(name => `export const ${name} = (...args) => call(at, ${JSON.stringify(name)}, args);`),
    "",
  ].join("\n");
}
