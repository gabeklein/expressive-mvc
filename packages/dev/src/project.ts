import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";

import { classify } from "./routes";

export interface Project {
  root: string;
  appPath?: string;
  appDir?: string;
  configPath?: string;
  htmlPath?: string;
}

export const GENERATED = ".expressive";

export const SHELL = `\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${GENERATED}/main.tsx"></script>
  </body>
</html>
`;

export function resolveProject(root: string): Project {
  const appDir = join(root, "app");
  const routed = existsSync(appDir);

  const rootApp = join(root, "app.tsx");
  const srcApp = join(root, "src", "app.tsx");
  const rootHas = existsSync(rootApp);
  const srcHas = existsSync(srcApp);

  if (routed && (rootHas || srcHas))
    throw new Error("Found both an app/ directory and app.tsx - pick routed mode or single-file.");

  if (!routed) {
    if (rootHas && srcHas)
      throw new Error("Found both ./app.tsx and ./src/app.tsx - pick one.");
    if (!rootHas && !srcHas)
      throw new Error("Missing app.tsx at project root or under src/ (or an app/ directory).");
  }

  const indexTs = join(root, "index.ts");
  const indexHtml = join(root, "index.html");

  return {
    root,
    appPath: routed ? undefined : rootHas ? rootApp : srcApp,
    appDir: routed ? appDir : undefined,
    configPath: existsSync(indexTs) ? indexTs : undefined,
    htmlPath: existsSync(indexHtml) ? indexHtml : undefined,
  };
}

export function bootstrap(appImport: string): string {
  return `\
import { render } from "@expressive/dev";
import { jsx } from "@expressive/dev/jsx-runtime";
import App from ${JSON.stringify(appImport)};

const el = document.getElementById("root");
if (!el) throw new Error("Missing #root element");
render(jsx(App, {}), el);
`;
}

export function ensureBootstrap(html: string): string {
  let out = html;

  if (!/id=["']root["']/.test(out)) out = injectBeforeBody(out, `<div id="root"></div>`);
  if (!out.includes(`${GENERATED}/main.tsx`))
    out = injectBeforeBody(out, `<script type="module" src="/${GENERATED}/main.tsx"></script>`);

  return out;
}

function injectBeforeBody(html: string, tag: string): string {
  return html.includes("</body>")
    ? html.replace("</body>", `  ${tag}\n  </body>`)
    : html + "\n" + tag + "\n";
}

const API_EXT = new Set([".ts", ".js", ".mts", ".mjs"]);

export function apiModules(root: string): Map<string, string> {
  const dir = join(root, "app", "api");
  const out = new Map<string, string>();

  if (!existsSync(dir)) return out;

  (function walk(folder: string, prefix: string) {
    for (const entry of readdirSync(folder)) {
      const full = join(folder, entry);

      if (statSync(full).isDirectory()) {
        walk(full, prefix ? `${prefix}/${entry}` : entry);
        continue;
      }

      const ext = extname(entry);
      if (!API_EXT.has(ext) || /\.(test|spec)\.\w+$/.test(entry)) continue;

      const base = basename(entry, ext);
      out.set(base === "index" ? prefix : prefix ? `${prefix}/${base}` : base, full);
    }
  })(dir, "");

  return out;
}

export interface Sidecar {
  pattern: string[];
  file: string;
}

export function sidecars(appDir: string | undefined): Sidecar[] {
  const out: Sidecar[] = [];

  if (!appDir || !existsSync(appDir)) return out;

  (function walk(folder: string, pattern: string[]) {
    for (const entry of readdirSync(folder)) {
      const full = join(folder, entry);

      if (statSync(full).isDirectory()) {
        if (entry === "api" && folder === appDir) continue;
        walk(full, [...pattern, classify(entry, true)!.segment]);
        continue;
      }

      if (API_EXT.has(extname(entry)) && basename(entry, extname(entry)) === "api") out.push({ pattern, file: full });
    }
  })(appDir, []);

  return out;
}

export function lane(project: Project, file: string): string[] | undefined {
  const { appDir } = project;
  const ext = extname(file);

  if (!appDir || !file.startsWith(appDir + sep) || !API_EXT.has(ext) || /\.(test|spec)\.\w+$/.test(file)) return;

  const rel = relative(appDir, file).split(sep);

  if (rel[0] === "api") {
    const key = rel.slice(1).join("/").slice(0, -ext.length);
    return ["api", ...key.split("/").filter(part => part !== "index")];
  }

  if (basename(file, ext) !== "api") return;

  return rel.slice(0, -1).map(entry => classify(entry, true)!.segment);
}

export function serverEntry(project: Project, api: Map<string, string>, scopes: Sidecar[], from: string): string {
  const modules = [...api].map(([key, file], i) => ({ key, name: `api${i}`, spec: relImport(from, file) }));
  const sides = scopes.map(({ pattern, file }, i) => ({ pattern, name: `scope${i}`, spec: relImport(from, file) }));

  return [
    `import { fileURLToPath } from "node:url";`,
    `import { serve } from "@expressive/dev";`,
    project.configPath ? `import config from ${JSON.stringify(relImport(from, project.configPath))};` : `const config = {};`,
    ...modules.map(m => `import * as ${m.name} from ${JSON.stringify(m.spec)};`),
    ...sides.map(m => `import * as ${m.name} from ${JSON.stringify(m.spec)};`),
    "",
    "serve({",
    "  config,",
    `  client: fileURLToPath(new URL("../client/", import.meta.url)),`,
    "  api: {",
    ...modules.map(m => `    ${JSON.stringify(m.key)}: async () => ${m.name},`),
    "  },",
    "  scopes: [",
    ...sides.map(m => `    { pattern: ${JSON.stringify(m.pattern)}, load: async () => ${m.name} },`),
    "  ],",
    "});",
    "",
  ].join("\n");
}

export function relImport(from: string, file: string): string {
  const rel = relative(from, file).replaceAll("\\", "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}
