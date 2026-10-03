import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerModuleRunner, type Plugin, type ViteDevServer } from "vite";
import type { ModuleRunner } from "vite/module-runner";

import type { AppConfig } from "../config";
import { GENERATED, SHELL, apiModules, bootstrap, ensureBootstrap, lane, relImport, resolveProject, serverEntry, sidecars, type Project } from "../project";
import { generateRoutes } from "../routes";
import { call } from "../rpc";
import { API_PREFIX, dispatch, dispatchScope, send, text, type Api } from "../server";
import { scanExports } from "./scan";

const MAIN = "main.tsx";
const ROUTES = "routes.tsx";
const SERVER = "server.ts";
const RPC = "rpc.ts";
const SCRIPT = /\.[cm]?[jt]sx?$/;

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
  let rpcId: string;
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

      const entries = project.appDir
        ? ["app/**/*.{ts,tsx,js,jsx}", "!app/api/**", "!app/**/api.{ts,js,mts,mjs}"]
        : [relImport(root, project.appPath!)];

      return {
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
      rpcId = join(generatedDir, RPC);
      htmlId = join(root, "index.html");
    },

    async resolveId(id, importer, options) {
      const generated =
        id.startsWith(`/${GENERATED}/`) ? join(root, id)
        : importer?.startsWith(generatedDir) && id.startsWith(".") ? resolve(dirname(importer), id)
        : id;

      if (generated === mainId || generated === routesId || generated === serverId || generated === rpcId) return generated;
      if (id === htmlId && !existsSync(htmlId)) return htmlId;

      if (options?.ssr || !importer || !SCRIPT.test(importer.split("?")[0]) || !/(^|[/.])api(\/|\.[cm]?[jt]s$|$)/.test(id)) return;

      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });

      if (!resolved || !lane(project, resolved.id)) return resolved;

      const shared = resolved.id.startsWith(join(project.appDir!, "api") + sep);
      const scope = dirname(resolved.id);
      const from = dirname(importer);

      if (!shared && from !== scope && !from.startsWith(scope + sep))
        this.error(
          `${relative(root, importer)} imports ${relative(root, resolved.id)}, which only its own folder and those below it may call. ` +
          `Move the function up to a shared ancestor, or into app/api/.`
        );

      return "scan" in options! && options.scan ? `\0lane:${resolved.id}` : resolved;
    },

    async load(id, options) {
      if (id === rpcId) return `export ${call}`;
      if (id === mainId) {
        const app = project.appDir ? `./${ROUTES}` : relImport(generatedDir, project.appPath!);
        return bootstrap(app);
      }
      if (id === routesId) return generateRoutes(project.appDir!, generatedDir, scanExports);
      if (id === serverId) return serverEntry(project, apiModules(root), sidecars(project.appDir), generatedDir);
      if (id === htmlId) return SHELL;

      const pattern = !options?.ssr && lane(project, id.split("?")[0]);

      if (pattern) return stub(id.split("?")[0], pattern);
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

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST") return next();

        const scopes = sidecars(project.appDir).map(({ pattern, file }) => ({ pattern, load: () => load.import(file) }));
        const reply = await dispatchScope(scopes, "POST", req.url!.split("?")[0], () => text(req));

        if (reply) send(res, reply);
        else next();
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

async function stub(file: string, pattern: string[]): Promise<string> {
  const { exports } = await scanExports(readFileSync(file, "utf8"), file);
  const names = [...exports].filter(name => name !== "default");

  return [
    `import { call } from "/${GENERATED}/${RPC}";`,
    `const scope = ${JSON.stringify(pattern)};`,
    ...names.map(name => `export const ${name} = (...args) => call(scope, ${JSON.stringify(name)}, args);`),
    "",
  ].join("\n");
}

function hosted() {
  const alias: { find: string; replacement: string }[] = [];

  for (const find of HOSTED)
    try {
      alias.push({ find, replacement: fileURLToPath(import.meta.resolve(find)) });
    } catch {}

  return alias;
}
