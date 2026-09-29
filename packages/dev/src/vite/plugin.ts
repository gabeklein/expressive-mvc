import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerModuleRunner, type Plugin, type ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";

import type { AppConfig } from "../config";
import { GENERATED, SHELL, apiModules, bootstrap, ensureBootstrap, relImport, resolveProject, serverEntry, type Project } from "../project";
import { generateRoutes } from "../routes";
import { API_PREFIX, dispatch, send, text, type Api } from "../server";
import { scanExports } from "./scan";

const MAIN = "main.tsx";
const ROUTES = "routes.tsx";
const SERVER = "server.ts";

export interface Host {
  config(): Promise<AppConfig>;
}

const DEPS = [
  "@expressive/mvc",
  "@expressive/mvc/runtime",
  "@expressive/mvc/jsx-runtime",
  "@expressive/dom",
  "@expressive/dom/jsx-runtime",
  "@expressive/dom/jsx-dev-runtime",
  "@expressive/router",
  "@expressive/dev",
];

const HOSTED = ["@expressive/inspect/vite/client", "@expressive/inspect/install", "@expressive/inspect"];

export function expressive(): Plugin<Host> {
  let root = process.cwd();
  let project: Project;
  let generatedDir: string;
  let mainId: string;
  let routesId: string;
  let serverId: string;
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
      root = resolve(user.root ?? process.cwd());
      project = resolveProject(root);

      const entries = project.appDir ? ["app/**/*.{ts,tsx,js,jsx}"] : [relImport(root, project.appPath!)];

      return {
        appType: "custom",
        oxc: { jsx: { runtime: "automatic", importSource: "@expressive/dom" } },
        optimizeDeps: { entries, include: DEPS },
        resolve: { alias: hosted() },
        build: env.isSsrBuild ? undefined : { rollupOptions: { input: project.htmlPath ?? join(root, "index.html") } },
      };
    },

    configResolved(config) {
      root = config.root;
      generatedDir = join(root, GENERATED);
      mainId = join(generatedDir, MAIN);
      routesId = join(generatedDir, ROUTES);
      serverId = join(generatedDir, SERVER);
      htmlId = join(root, "index.html");
    },

    resolveId(id, importer) {
      const generated =
        id.startsWith(`/${GENERATED}/`) ? join(root, id)
        : importer?.startsWith(generatedDir) && id.startsWith(".") ? resolve(dirname(importer), id)
        : id;

      if (generated === mainId || generated === routesId || generated === serverId) return generated;
      if (id === htmlId && !existsSync(htmlId)) return htmlId;
    },

    async load(id) {
      if (id === mainId) {
        const app = project.appDir ? `./${ROUTES}` : relImport(generatedDir, project.appPath!);
        return bootstrap(app);
      }
      if (id === routesId) return generateRoutes(project.appDir!, generatedDir, scanExports);
      if (id === serverId) return serverEntry(project, apiModules(root), generatedDir);
      if (id === htmlId) return SHELL;
    },

    transformIndexHtml: {
      order: "pre",
      handler: html => ensureBootstrap(html),
    },

    configureServer(server) {
      runner = createServerModuleRunner(server.environments.ssr);
      watchRoutes(server, project, routesId);

      const load = runner;
      server.middlewares.use(API_PREFIX, async (req, res) => {
        const api: Api = {};
        for (const [key, file] of apiModules(root)) api[key] = () => load.import(file);

        send(res, await dispatch(api, req.method ?? "GET", req.url!.split("?")[0], () => text(req)));
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
