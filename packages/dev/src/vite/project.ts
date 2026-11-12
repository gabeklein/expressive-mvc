import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { shapeOf, type Exposure } from "./remote";
import type { Remote } from "./routes";

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
  const indexTs = join(root, "index.ts");
  const indexHtml = join(root, "index.html");

  return {
    root,
    ...appEntry(root),
    configPath: existsSync(indexTs) ? indexTs : undefined,
    htmlPath: existsSync(indexHtml) ? indexHtml : undefined,
  };
}

function appEntry(root: string): Pick<Project, "appDir" | "appPath"> {
  const appDir = join(root, "app");
  const files = [join(root, "app.tsx"), join(root, "src", "app.tsx")].filter(file => existsSync(file));

  if (existsSync(appDir)) {
    if (files.length) throw new Error("Found both an app/ directory and app.tsx - pick routed mode or single-file.");
    return { appDir };
  }

  if (files.length > 1) throw new Error("Found both ./app.tsx and ./src/app.tsx - pick one.");
  if (!files.length) throw new Error("Missing app.tsx at project root or under src/ (or an app/ directory).");

  return { appPath: files[0] };
}

export function bootstrap(appImport: string): string {
  return `\
import { hydrate, render } from "@expressive/dev";
import { jsx } from "@expressive/dev/jsx-runtime";
import App from ${JSON.stringify(appImport)};

const el = document.getElementById("root");
if (!el) throw new Error("Missing #root element");

if (!el.hasChildNodes()) render(jsx(App, {}), el);
else {
  hydrate(jsx(App, {}), el);

  for (let node of [...document.head.childNodes].filter(node => node.data == "prerender"))
    while (node) {
      const next = node.data == "/prerender" ? null : node.nextSibling;
      node.remove();
      node = next;
    }
}
`;
}

export function prerenderEntry(appImport: string, routed: boolean, sources: string[] = []): string {
  const imports = sources.map((source, index) => `import { paths as p${index} } from ${JSON.stringify(source)};\n`).join("");
  const lists = sources.map((_, index) => `p${index}()`).join(", ");

  return `\
import { renderToString } from "@expressive/dom/server";
import { Router } from "@expressive/dev";
import { jsx } from "@expressive/dev/jsx-runtime";
import App from ${JSON.stringify(appImport)};
${imports}
export async function paths() {
  return (await Promise.all([${lists}])).flat();
}

export default async function page(path) {
  let router;
  const stop = Router.on({ setup(self) { router = self; } });

  try {
    const output = await renderToString(jsx(App, ${routed ? "{ path }" : "{}"}));
    return { ...output, path: router ? router.path : path };
  } finally {
    stop();
  }
}
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

export function serverEntry(project: Project, from: string, exposure: Exposure, seats: Remote[]): string {
  const configSpec = project.configPath && JSON.stringify(importRel(from, project.configPath));
  const files = [...new Set([...exposure.modules.keys(), ...seats.map(seat => seat.file)])];
  const modules = files.map(file => JSON.stringify(importRel(from, file)));
  const alias = (file: string) => `s${files.indexOf(file)}`;

  const entries = exposure.byPattern().map(group => {
    const pool = group.flatMap(remote => remote.pooled.map(twin =>
      `${JSON.stringify(exposure.classId(remote, twin.name))}: { Type: ${alias(remote.file)}.${twin.name}, ${props({ ...shapeOf(twin), methods: exposure.methodIds(remote, twin, true) })} }`)).join(", ");
    const seated = group.find(remote => remote.seat);
    const seat = seated && JSON.stringify({ ...shapeOf(seated.seat!), methods: exposure.methodIds(seated, seated.seat!, false) });

    return `    { pattern: ${JSON.stringify(group[0].pattern)}, async exports() { return { ${exposure.table(group, alias)}, pool: { ${pool} }${seat ? `, seat: ${seat}` : ""} }; } },`;
  });

  return [
    `import { fileURLToPath } from "node:url";`,
    `import { serve } from "@expressive/dev/server";`,
    configSpec ? `import config from ${configSpec};` : `const config = {};`,
    ...modules.map((m, i) => `import * as s${i} from ${m};`),
    "",
    "serve({",
    "  config,",
    `  client: fileURLToPath(new URL("../client/", import.meta.url)),`,
    "  sidecars: [", ...entries, "  ],",
    "  seats: [", ...seats.map(seat => `    { pattern: ${JSON.stringify(seat.pattern)}, Type: ${alias(seat.file)}.default },`), "  ],",
    "});",
    "",
  ].join("\n");
}

function props(object: object): string {
  return Object.entries(object).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ");
}

export function importRel(from: string, file: string): string {
  const rel = relative(from, file).replaceAll("\\", "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}
