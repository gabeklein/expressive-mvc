import { existsSync } from "node:fs";
import { join, relative } from "node:path";

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

export interface SidecarEntry {
  pattern: string[];
  file: string;
  calls: string[];
  classes: string[];
}

export function serverEntry(project: Project, from: string, sidecars: SidecarEntry[] = []): string {
  const configSpec = project.configPath && JSON.stringify(importRel(from, project.configPath));
  const modules = sidecars.map((mod) => JSON.stringify(importRel(from, mod.file)));
  const entries = sidecars.map((mod, i) => {
    const pattern = JSON.stringify(mod.pattern);
    const pick = (names: string[]) => `{ ${names.map(name => `${name}: s${i}.${name}`).join(", ")} }`;

    return `    { pattern: ${pattern}, async exports() { return { calls: ${pick(mod.calls)}, classes: ${pick(mod.classes)} }; } },`;
  });

  return [
    `import { fileURLToPath } from "node:url";`,
    `import { serve } from "@expressive/dev";`,
    configSpec ? `import config from ${configSpec};` : `const config = {};`,
    ...modules.map((m, i) => `import * as s${i} from ${m};`),
    "",
    "serve({",
    "  config,",
    `  client: fileURLToPath(new URL("../client/", import.meta.url)),`,
    "  sidecars: [", ...entries, "  ],",
    "});",
    "",
  ].join("\n");
}

export function importRel(from: string, file: string): string {
  const rel = relative(from, file).replaceAll("\\", "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}
